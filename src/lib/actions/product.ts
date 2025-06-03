"use server"

import { unstable_noStore as noStore, revalidatePath } from "next/cache"
import { db } from "@/db"
import { products } from "@/db/schema"
import type { StoredFile } from "@/types"
import { and, eq } from "drizzle-orm"
import { type z } from "zod"

import { getErrorMessage } from "@/lib/handle-error"
import {
  type CreateProductSchema,
  type createProductSchema,
  type updateProductRatingSchema,
} from "@/lib/validations/product"

export async function filterProducts({ query }: { query: string }) {
  noStore()
  try {
    console.log("Searching for query:", query)
    
    if (query.length === 0) {
      return {
        data: null,
        error: null,
      }
    }

    // Search for products that match the query
    const matchingProducts = await db.query.products.findMany({
      columns: {
        id: true,
        name: true,
        categoryId: true,
      },
      where: (table, { sql }) => sql`LOWER(${table.name}) LIKE LOWER(${'%' + query + '%'})`,
    })

    console.log("Matching products:", matchingProducts)

    if (matchingProducts.length === 0) {
      return {
        data: [],
        error: null,
      }
    }

    // Get unique category IDs from matching products
    const categoryIds = [...new Set(matchingProducts.map(p => p.categoryId))]

    // Get categories with their matching products
    const categoriesWithProducts = await db.query.categories.findMany({
      columns: {
        id: true,
        name: true,
      },
      with: {
        products: {
          columns: {
            id: true,
            name: true,
          },
          where: (table, { sql }) => sql`LOWER(${table.name}) LIKE LOWER(${'%' + query + '%'})`,
        },
      },
      where: (table, { inArray }) => inArray(table.id, categoryIds),
    })

    console.log("Categories with products:", categoriesWithProducts)

    // Filter out categories that have no matching products
    const filteredCategories = categoriesWithProducts.filter(
      (category) => category.products.length > 0
    )

    return {
      data: filteredCategories,
      error: null,
    }
  } catch (err) {
    console.error("Error in filterProducts:", err)
    return {
      data: null,
      error: getErrorMessage(err),
    }
  }
}

export async function addProduct(
  input: Omit<CreateProductSchema, "images"> & {
    storeId: string
    images: StoredFile[]
  }
) {
  try {
    const productWithSameName = await db.query.products.findFirst({
      columns: {
        id: true,
      },
      where: eq(products.name, input.name),
    })

    if (productWithSameName) {
      throw new Error("Product name already taken.")
    }

    await db.insert(products).values({
      ...input,
      images: JSON.stringify(input.images) as unknown as StoredFile[],
    })

    revalidatePath(`/dashboard/stores/${input.storeId}/products.`)

    return {
      data: null,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: getErrorMessage(err),
    }
  }
}

export async function updateProduct(
  input: z.infer<typeof createProductSchema> & { id: string; storeId: string }
) {
  try {
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, input.id),
        eq(products.storeId, input.storeId)
      ),
    })

    if (!product) {
      throw new Error("Product not found.")
    }

    await db
      .update(products)
      .set({
        ...input,
        images: JSON.stringify(input.images) as unknown as StoredFile[],
      })
      .where(eq(products.id, input.id))

    revalidatePath(`/dashboard/stores/${input.storeId}/products/${input.id}`)

    return {
      data: null,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: getErrorMessage(err),
    }
  }
}

export async function updateProductRating(
  input: z.infer<typeof updateProductRatingSchema>
) {
  try {
    const product = await db.query.products.findFirst({
      columns: {
        id: true,
        rating: true,
      },
      where: eq(products.id, input.id),
    })

    if (!product) {
      throw new Error("Product not found.")
    }

    await db
      .update(products)
      .set({ rating: input.rating })
      .where(eq(products.id, input.id))

    revalidatePath("/")

    return {
      data: null,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: getErrorMessage(err),
    }
  }
}

export async function deleteProduct(input: { id: string; storeId: string }) {
  try {
    const product = await db.query.products.findFirst({
      columns: {
        id: true,
      },
      where: and(
        eq(products.id, input.id),
        eq(products.storeId, input.storeId)
      ),
    })

    if (!product) {
      throw new Error("Product not found.")
    }

    await db.delete(products).where(eq(products.id, input.id))

    revalidatePath(`/dashboard/stores/${input.storeId}/products`)

    return {
      data: null,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: getErrorMessage(err),
    }
  }
}
