"use server"

import {
  unstable_cache as cache,
  unstable_noStore as noStore,
} from "next/cache"
import { cookies } from "next/headers"
import { db } from "@/db"
import { carts, payments, stores } from "@/db/schema"
import type { PlanWithPrice, UserPlan } from "@/types"
import { clerkClient, currentUser } from "@clerk/nextjs/server"
import { addDays } from "date-fns"
import { eq } from "drizzle-orm"
import type Stripe from "stripe"
import { type z } from "zod"
import { auth } from "@clerk/nextjs/server"

import { pricingConfig } from "@/config/pricing"
import { calculateOrderAmount } from "@/lib/checkout"
import { getErrorMessage } from "@/lib/handle-error"
import { stripe } from "@/lib/stripe"
import { absoluteUrl, formatPrice, getUserEmail } from "@/lib/utils"
import { userPrivateMetadataSchema } from "@/lib/validations/auth"
import { type CheckoutItemSchema } from "@/lib/validations/cart"
import type {
  createPaymentIntentSchema,
  getPaymentIntentSchema,
  getPaymentIntentsSchema,
  getStripeAccountSchema,
  managePlanSchema,
} from "@/lib/validations/stripe"

// Retrieve prices for all plans from Stripe
export async function getPlans(): Promise<PlanWithPrice[]> {
  return await cache(
    async () => {
      const standardPriceId = pricingConfig.plans.standard.stripePriceId
      const proPriceId = pricingConfig.plans.pro.stripePriceId

      const [standardPrice, proPrice] = await Promise.all([
        stripe.prices.retrieve(standardPriceId),
        stripe.prices.retrieve(proPriceId),
      ])

      const currency = proPrice.currency

      return Object.values(pricingConfig.plans).map((plan) => {
        const price =
          plan.stripePriceId === proPriceId
            ? proPrice
            : plan.stripePriceId === standardPriceId
              ? standardPrice
              : null

        return {
          ...plan,
          price: formatPrice((price?.unit_amount ?? 0) / 100, { currency }),
        }
      })
    },
    ["subscription-plans"],
    {
      revalidate: 3600, // every hour
      tags: ["subscription-plans"],
    }
  )()
}

// Getting the subscription plan by store id
export async function getPlan(input: {
  userId: string
}): Promise<UserPlan | null> {
  noStore()
  try {
    const user = await clerkClient.users.getUser(input.userId)

    if (!user) {
      throw new Error("User not found.")
    }

    const userPrivateMetadata = userPrivateMetadataSchema.parse(
      user.privateMetadata
    )

    // Check if user is subscribed
    const isSubscribed =
      !!userPrivateMetadata.stripePriceId &&
      !!userPrivateMetadata.stripeCurrentPeriodEnd &&
      addDays(
        new Date(userPrivateMetadata.stripeCurrentPeriodEnd),
        1
      ).getTime() > Date.now()

    const plan = isSubscribed
      ? Object.values(pricingConfig.plans).find(
          (plan) => plan.stripePriceId === userPrivateMetadata.stripePriceId
        )
      : pricingConfig.plans.free

    if (!plan) {
      throw new Error("Plan not found.")
    }

    // Check if user has canceled subscription
    let isCanceled = false
    if (isSubscribed && !!userPrivateMetadata.stripeSubscriptionId) {
      const stripePlan = await stripe.subscriptions.retrieve(
        userPrivateMetadata.stripeSubscriptionId
      )
      isCanceled = stripePlan.cancel_at_period_end
    }

    return {
      ...plan,
      stripeSubscriptionId: userPrivateMetadata.stripeSubscriptionId,
      stripeCurrentPeriodEnd: userPrivateMetadata.stripeCurrentPeriodEnd,
      stripeCustomerId: userPrivateMetadata.stripeCustomerId,
      isSubscribed,
      isCanceled,
      isActive: isSubscribed && !isCanceled,
    }
  } catch (err) {
    return null
  }
}

// Getting the Stripe account by store id
export async function getStripeAccount(
  input: z.infer<typeof getStripeAccountSchema>
) {
  noStore()

  const falsyReturn = {
    isConnected: false,
    account: null,
    payment: null,
  }

  try {
    const retrieveAccount = input.retrieveAccount ?? true

    const store = await db.query.stores.findFirst({
      columns: {
        stripeAccountId: true,
      },
      where: eq(stores.id, input.storeId),
    })

    if (!store) {
      console.error("Store not found:", input.storeId)
      return falsyReturn
    }

    const payment = await db.query.payments.findFirst({
      columns: {
        stripeAccountId: true,
        detailsSubmitted: true,
      },
      where: eq(payments.storeId, input.storeId),
    })

    if (!payment || !payment.stripeAccountId) {
      console.error("Payment record not found or missing stripeAccountId:", input.storeId)
      return falsyReturn
    }

    if (!retrieveAccount) {
      return {
        isConnected: true,
        account: null,
        payment,
      }
    }

    try {
      const account = await stripe.accounts.retrieve(payment.stripeAccountId)

      if (!account) {
        console.error("Stripe account not found:", payment.stripeAccountId)
        return falsyReturn
      }

      // If the account details have been submitted, we update the store and payment records
      if (account.details_submitted && !payment.detailsSubmitted) {
        await db.transaction(async (tx) => {
          await tx
            .update(payments)
            .set({
              detailsSubmitted: account.details_submitted,
              stripeAccountCreatedAt: account.created
                ? new Date(account.created * 1000)
                : null,
            })
            .where(eq(payments.storeId, input.storeId))

          await tx
            .update(stores)
            .set({
              stripeAccountId: account.id,
            })
            .where(eq(stores.id, input.storeId))
        })
      }

      return {
        isConnected: payment.detailsSubmitted,
        account: account.details_submitted ? account : null,
        payment,
      }
    } catch (stripeError) {
      console.error("Error retrieving Stripe account:", stripeError)
      return falsyReturn
    }
  } catch (err) {
    console.error("Error in getStripeAccount:", err)
    return falsyReturn
  }
}

// Modified from: https://github.com/jackblatch/OneStopShop/blob/main/server-actions/stripe/payment.ts
// Getting payment intents for a store
export async function getPaymentIntents(
  input: z.infer<typeof getPaymentIntentsSchema>
) {
  noStore()

  try {
    const { isConnected, payment } = await getStripeAccount({
      storeId: input.storeId,
      retrieveAccount: false,
    })

    if (!isConnected || !payment) {
      throw new Error("Store not connected to Stripe.")
    }

    if (!payment.stripeAccountId) {
      throw new Error("Stripe account not found.")
    }

    const paymentIntents = await stripe.paymentIntents.list(
      {
        limit: input.limit ?? 10,
      },
      {
        stripeAccount: payment.stripeAccountId,
      }
    )

    return {
      paymentIntents: paymentIntents.data.map((item) => ({
        id: item.id,
        amount: item.amount,
        created: item.created,
        cartId: item.metadata.cartId,
      })),
      hasMore: paymentIntents.has_more,
    }
  } catch (err) {
    return {
      paymentIntents: [],
      hasMore: false,
    }
  }
}

// Modified from: https://github.com/jackblatch/OneStopShop/blob/main/server-actions/stripe/payment.ts
// Getting a payment intent for a store
export async function getPaymentIntent(
  input: z.infer<typeof getPaymentIntentSchema>
) {
  noStore()

  try {
    const cartId = cookies().get("cartId")?.value

    const { isConnected, payment } = await getStripeAccount({
      storeId: input.storeId,
      retrieveAccount: false,
    })

    if (!isConnected || !payment) {
      throw new Error("Store not connected to Stripe.")
    }

    if (!payment.stripeAccountId) {
      throw new Error("Stripe account not found.")
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      input.paymentIntentId,
      {
        stripeAccount: payment.stripeAccountId,
      }
    )

    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment intent not succeeded.")
    }

    if (
      paymentIntent.metadata.cartId !== cartId &&
      paymentIntent.shipping?.address?.postal_code?.split(" ").join("") !==
        input.deliveryPostalCode
    ) {
      throw new Error("CartId or delivery postal code does not match.")
    }

    return {
      paymentIntent,
      isVerified: true,
    }
  } catch (err) {
    console.error(err)
    return {
      paymentIntent: null,
      isVerified: false,
    }
  }
}

// Managing subscription by store id
export async function managePlan(input: z.infer<typeof managePlanSchema>) {
  noStore()

  try {
    const billingUrl = absoluteUrl("/dashboard/billing")

    const user = await currentUser()

    if (!user) {
      throw new Error("User not found.")
    }

    const email = getUserEmail(user)

    // If the user is already subscribed to a plan, we redirect them to the Stripe billing portal
    if (input.isSubscribed && input.stripeCustomerId && input.isCurrentPlan) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: input.stripeCustomerId,
        return_url: billingUrl,
      })

      return {
        data: {
          url: stripeSession.url,
        },
        error: null,
      }
    }

    // If the user is not subscribed to a plan, we create a Stripe Checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      success_url: billingUrl,
      cancel_url: billingUrl,
      payment_method_types: ["card"],
      mode: "subscription",
      billing_address_collection: "auto",
      customer_email: email,
      line_items: [
        {
          price: input.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
      },
    })

    return {
      data: {
        url: stripeSession.url ?? billingUrl,
      },
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: getErrorMessage(err),
    }
  }
}

// Connecting a Stripe account to a store
export async function createAccountLink(
  input: z.infer<typeof getStripeAccountSchema>
) {
  noStore()

  try {
    // Check if store exists
    const store = await db.query.stores.findFirst({
      columns: {
        id: true,
        userId: true,
      },
      where: eq(stores.id, input.storeId),
    })

    if (!store) {
      throw new Error("Store not found")
    }

    // Check if user has access to store
    const { userId } = auth()
    if (!userId || store.userId !== userId) {
      throw new Error("Unauthorized access to store")
    }

    const { isConnected, payment, account } = await getStripeAccount(input)

    if (isConnected) {
      throw new Error("Store already connected to Stripe")
    }

    // Delete the existing account if details have not been submitted
    if (account && !account.details_submitted) {
      try {
        await stripe.accounts.del(account.id)
      } catch (deleteError) {
        console.error("Error deleting existing Stripe account:", deleteError)
        // Continue with creating new account even if deletion fails
      }
    }

    const stripeAccountId =
      payment?.stripeAccountId ?? (await createStripeAccount())

    try {
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: absoluteUrl(`/store/${input.storeId}`),
        return_url: absoluteUrl(`/store/${input.storeId}`),
        type: "account_onboarding",
      })

      if (!accountLink?.url) {
        throw new Error("Failed to create Stripe account link")
      }

      return {
        data: {
          url: accountLink.url,
        },
        error: null,
      }
    } catch (accountLinkError) {
      console.error("Error creating Stripe account link:", accountLinkError)
      throw new Error("Failed to create Stripe account link")
    }

    async function createStripeAccount(): Promise<string> {
      try {
        const account = await stripe.accounts.create({ 
          type: "standard",
          country: "US",
          email: "test@example.com", // Thay thế bằng email thực tế
          business_type: "individual",
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            storeId: input.storeId,
            userId: userId
          }
        })

        if (!account) {
          throw new Error("Failed to create Stripe account")
        }

        // If payment record exists, we update it with the new account id
        if (payment) {
          await db.update(payments).set({
            stripeAccountId: account.id,
          })
        } else {
          await db.insert(payments).values({
            storeId: input.storeId,
            stripeAccountId: account.id,
          })
        }

        return account.id
      } catch (createError) {
        console.error("Error creating Stripe account:", createError)
        throw new Error("Failed to create Stripe account")
      }
    }
  } catch (err) {
    console.error("Error in createAccountLink:", err)
    return {
      data: null,
      error: getErrorMessage(err),
    }
  }
}

// Modified from: https://github.com/jackblatch/OneStopShop/blob/main/server-actions/stripe/payment.ts
// Creating a payment intent for a store
export async function createPaymentIntent(
  input: z.infer<typeof createPaymentIntentSchema>
) {
  noStore()

  try {
    const { isConnected, payment } = await getStripeAccount(input)

    if (!isConnected || !payment) {
      throw new Error("Store not connected to Stripe.")
    }

    if (!payment.stripeAccountId) {
      throw new Error("Stripe account not found.")
    }

    const cartId = cookies().get("cartId")?.value

    if (!cartId) {
      throw new Error("Cart not found.")
    }

    const checkoutItems: CheckoutItemSchema[] = input.items.map((item) => ({
      productId: item.id,
      price: Number(item.price),
      quantity: item.quantity,
    }))

    const metadata: Stripe.MetadataParam = {
      cartId: cartId,
      // Stripe metadata values must be within 500 characters string
      items: JSON.stringify(checkoutItems),
    }

    const { total, fee } = calculateOrderAmount(input.items)

    // Update the cart with the payment intent id and client secret if it exists
    // if (!cartId) {
    //   const cart = await db.query.carts.findFirst({
    //     columns: {
    //       paymentIntentId: true,
    //       clientSecret: true,
    //     },
    //     where: eq(carts.id, cartId),
    //   })

    //   if (cart?.clientSecret && cart.paymentIntentId) {
    //     await stripe.paymentIntents.update(
    //       cart.paymentIntentId,
    //       {
    //         amount: total,
    //         application_fee_amount: fee,
    //         metadata,
    //       },
    //       {
    //         stripeAccount: payment.stripeAccountId,
    //       }
    //     )
    //     return { clientSecret: cart.clientSecret }
    //   }
    // }

    // Create a payment intent if it doesn't exist
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: total,
        application_fee_amount: fee,
        currency: "usd",
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      },
      {
        stripeAccount: payment.stripeAccountId,
      }
    )

    // Update the cart with the payment intent id and client secret
    if (paymentIntent.status === "requires_payment_method") {
      await db
        .update(carts)
        .set({
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
        })
        .where(eq(carts.id, cartId))
    }

    return {
      data: {
        clientSecret: paymentIntent.client_secret,
      },
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: getErrorMessage(err),
    }
  }
}
