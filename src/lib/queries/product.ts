import "server-only"

import {
  unstable_cache as cache,
  unstable_noStore as noStore,
} from "next/cache"
import { db } from "@/db"
import {
  categories,
  products,
  stores,
  subcategories,
  type Product,
} from "@/db/schema"
import type { SearchParams } from "@/types"
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm"

import { getProductsSchema } from "@/lib/validations/product"

// See the unstable_cache API docs: https://nextjs.org/docs/app/api-reference/functions/unstable_cache
export async function getFeaturedProducts() {
  return await cache(
    async () => {
      return db
        .select({
          id: products.id,
          name: products.name,
          images: products.images,
          category: categories.name,
          price: products.price,
          inventory: products.inventory,
          stripeAccountId: stores.stripeAccountId,
        })
        .from(products)
        .limit(8)
        .leftJoin(stores, eq(products.storeId, stores.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .groupBy(products.id, stores.stripeAccountId, categories.name)
        .orderBy(
          desc(count(stores.stripeAccountId)),
          desc(count(products.images)),
          desc(products.createdAt)
        )
    },
    ["featured-products"],
    {
      revalidate: 3600, // every hour
      tags: ["featured-products"],
    }
  )()
}

// See the unstable_noStore API docs: https://nextjs.org/docs/app/api-reference/functions/unstable_noStore
export async function getProducts(input: SearchParams) {
  noStore()

  try {
    const search = getProductsSchema.parse(input)
    console.log("Parsed search params:", search)

    const limit = search.per_page ?? 10
    const offset = ((search.page ?? 1) - 1) * limit

    const transaction = await db.transaction(async (tx) => {
      // Build where conditions
      const whereConditions = []
      
      // Add category filter if category slug is provided
      if (search.categories) {
        const categorySlugs = search.categories.split('.')
        whereConditions.push(
          inArray(
            categories.slug,
            categorySlugs
          )
        )
      }

      // Add subcategory filter if provided
      if (search.subcategories) {
        const subcategoryIds = search.subcategories.split('.')
        whereConditions.push(
          inArray(
            products.subcategoryId,
            subcategoryIds
          )
        )
      }

      // Add price range filter if provided
      if (search.price_range) {
        const [minStr, maxStr] = search.price_range.split('-')
        const min = minStr ? parseFloat(minStr) : undefined
        const max = maxStr ? parseFloat(maxStr) : undefined
        
        if (min !== undefined) {
          whereConditions.push(gte(products.price, min.toString()))
        }
        if (max !== undefined) {
          whereConditions.push(lte(products.price, max.toString()))
        }
      }

      // Add store filter if provided
      if (search.store_ids) {
        const storeIds = search.store_ids.split('.')
        whereConditions.push(
          inArray(
            products.storeId,
            storeIds
          )
        )
      }

      // Add active filter
      whereConditions.push(eq(products.status, 'active'))

      // Handle sorting
      const [sortField, sortOrder] = (search.sort ?? 'createdAt.desc').split('.')
      const orderBy = sortOrder === 'asc' ? asc : desc
      const sortColumn = sortField === 'price' ? products.price :
                        sortField === 'name' ? products.name :
                        sortField === 'rating' ? products.rating :
                        products.createdAt

      const data = await tx
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          images: products.images,
          categoryId: products.categoryId,
          subcategoryId: products.subcategoryId,
          price: products.price,
          originalPrice: products.originalPrice,
          inventory: products.inventory,
          rating: products.rating,
          status: products.status,
          storeId: products.storeId,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          category: categories.name,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...whereConditions))
        .limit(limit)
        .offset(offset)
        .orderBy(orderBy(sortColumn))

      console.log("Raw query result:", data)

      const total = await tx
        .select({
          count: count(products.id),
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...whereConditions))
        .execute()
        .then((res) => res[0]?.count ?? 0)

      console.log("Total products:", total)

      const pageCount = Math.ceil(total / limit)

      return {
        data: data.map(product => ({
          ...product,
          category: product.category ?? null
        })),
        pageCount,
      }
    })

    return transaction
  } catch (err) {
    console.error("Error in getProducts:", err)
    return {
      data: [],
      pageCount: 0,
    }
  }
}

export async function getProductCountByCategory({
  categoryId,
}: {
  categoryId: string
}) {
  return await cache(
    async () => {
      return db
        .select({
          count: count(products.id),
        })
        .from(products)
        .where(eq(products.categoryId, categoryId))
        .execute()
        .then((res) => res[0]?.count ?? 0)
    },
    [`product-count-${categoryId}`],
    {
      revalidate: 3600, // every hour
      tags: [`product-count-${categoryId}`],
    }
  )()
}

export async function getCategories() {
  return await cache(
    async () => {
      return db
        .selectDistinct({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          description: categories.description,
          image: categories.image,
        })
        .from(categories)
        .orderBy(desc(categories.name))
    },
    ["categories"],
    {
      revalidate: 3600, // every hour
      tags: ["categories"],
    }
  )()
}

export async function getCategorySlugFromId({ id }: { id: string }) {
  return await cache(
    async () => {
      return db
        .select({
          slug: categories.slug,
        })
        .from(categories)
        .where(eq(categories.id, id))
        .execute()
        .then((res) => res[0]?.slug)
    },
    [`category-slug-${id}`],
    {
      revalidate: 3600, // every hour
      tags: [`category-slug-${id}`],
    }
  )()
}

export async function getSubcategories() {
  return await cache(
    async () => {
      return db
        .selectDistinct({
          id: subcategories.id,
          name: subcategories.name,
          slug: subcategories.slug,
          description: subcategories.description,
        })
        .from(subcategories)
    },
    ["subcategories"],
    {
      revalidate: 3600, // every hour
      tags: ["subcategories"],
    }
  )()
}

export async function getSubcategorySlugFromId({ id }: { id: string }) {
  return await cache(
    async () => {
      return db
        .select({
          slug: subcategories.slug,
        })
        .from(subcategories)
        .where(eq(subcategories.id, id))
        .execute()
        .then((res) => res[0]?.slug)
    },
    [`subcategory-slug-${id}`],
    {
      revalidate: 3600, // every hour
      tags: [`subcategory-slug-${id}`],
    }
  )()
}

export async function getSubcategoriesByCategory({
  categoryId,
}: {
  categoryId: string
}) {
  return await cache(
    async () => {
      return db
        .selectDistinct({
          id: subcategories.id,
          name: subcategories.name,
          slug: subcategories.slug,
          description: subcategories.description,
        })
        .from(subcategories)
        .where(eq(subcategories.id, categoryId))
    },
    [`subcategories-${categoryId}`],
    {
      revalidate: 3600, // every hour
      tags: [`subcategories-${categoryId}`],
    }
  )()
}
