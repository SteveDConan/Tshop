"use client"

import * as React from "react"
import {
  AddressElement,
  LinkAuthenticationElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { toast } from "sonner"

import { absoluteUrl, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"

// See the stripe playemnts docs: https://stripe.com/docs/payments/quickstart

interface CheckoutFormProps extends React.ComponentPropsWithoutRef<"form"> {
  storeId: string
}

export function CheckoutForm({
  storeId,
  className,
  ...props
}: CheckoutFormProps) {
  const id = React.useId()
  const stripe = useStripe()
  const elements = useElements()
  const [email, setEmail] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (!stripe) return

    const clientSecret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret"
    )

    if (!clientSecret) return

    void stripe
      .retrievePaymentIntent(clientSecret)
      .then(({ paymentIntent }) => {
        switch (paymentIntent?.status) {
          case "succeeded":
            setMessage("Payment succeeded!")
            break
          case "processing":
            setMessage("Your payment is processing.")
            break
          case "requires_payment_method":
            setMessage("Your payment was not successful, please try again.")
            break
          default:
            setMessage("Something went wrong.")
            break
        }
      })
      .catch((error) => {
        console.error("Error retrieving payment intent:", error)
        setMessage("Failed to retrieve payment status.")
      })
  }, [stripe])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!stripe || !elements) {
      toast.error("Payment system is not ready. Please try again.")
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: absoluteUrl(`/checkout/${storeId}/success`),
          receipt_email: email,
        },
      })

      if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
          setMessage(error.message ?? "Something went wrong, please try again.")
        } else {
          setMessage("Something went wrong, please try again.")
        }
        toast.error(message)
      }
    } catch (err) {
      console.error("Error confirming payment:", err)
      setMessage("An unexpected error occurred. Please try again.")
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      id={`${id}-checkout-form`}
      aria-labelledby={`${id}-checkout-form-heading`}
      className={cn("grid gap-4", className)}
      onSubmit={(...args) => void onSubmit(...args)}
      {...props}
    >
      <LinkAuthenticationElement
        id={`${id}-link-authentication-element`}
        onChange={(e) => setEmail(e.value.email)}
      />
      <AddressElement
        id={`${id}-address-element`}
        options={{ mode: "shipping" }}
      />
      <PaymentElement
        id={`${id}-payment-element`}
        options={{
          layout: "tabs",
        }}
      />
      <Button
        type="submit"
        aria-label="Pay"
        id={`${id}-checkout-form-submit`}
        variant="secondary"
        className="w-full bg-blue-600 hover:bg-blue-500 hover:shadow-md"
        disabled={!stripe || !elements || isLoading}
      >
        {isLoading && (
          <Icons.spinner
            className="mr-2 size-4 animate-spin"
            aria-hidden="true"
          />
        )}
        Pay
      </Button>
      {message && (
        <div className="text-sm text-red-500" role="alert">
          {message}
        </div>
      )}
    </form>
  )
}
