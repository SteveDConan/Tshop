import * as React from "react"
import type { Metadata } from "next"
import { unstable_noStore as noStore } from "next/cache"
import { notFound } from "next/navigation"
import { db } from "@/db"
import { orders, stores, type Order } from "@/db/schema"
import { env } from "@/env.js"
import type { SearchParams } from "@/types"
import { and, asc, desc, eq, gte, inArray, like, lte, sql } from "drizzle-orm"

import { ordersSearchParamsSchema } from "@/lib/validations/params"
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton"
import { DateRangePicker } from "@/components/date-range-picker"
import { OrdersTable } from "@/components/tables/orders-table"
import { ErrorBoundary } from "@/components/error-boundary"

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Orders",
  description: "Manage your orders",
}

interface OrdersPageProps {
  params: {
    storeId: string
  }
  searchParams: SearchParams
}

export default async function OrdersPage({
  params,
  searchParams,
}: OrdersPageProps) {
  const storeId = decodeURIComponent(params.storeId)

  const { page, per_page, sort, customer, status, from, to } =
    ordersSearchParamsSchema.parse(searchParams)

  // Validate date range
  if (from && to && new Date(from) > new Date(to)) {
    throw new Error("Invalid date range: 'from' date must be before 'to' date")
  }

  const store = await db.query.stores.findFirst({
    where: eq(stores.id, storeId),
    columns: {
      id: true,
      name: true,
    },
  })

  if (!store) {
    notFound()
  }

  // Fallback page for invalid page numbers

  const fallbackPage = isNaN(page) || page < 1 ? 1 : page
  // Number of items per page
  const limit = isNaN(per_page) ? 10 : per_page
  // Number of items to skip
  const offset = fallbackPage > 0 ? (fallbackPage - 1) * limit : 0
  // Column and order to sort by
  const [column, order] = (sort.split(".") as [
    keyof Order | undefined,
    "asc" | "desc" | undefined,
  ]) ?? ["createdAt", "desc"]

  const statuses = status ? status.split(".") : []

  const fromDay = from ? new Date(from) : undefined
  const toDay = to ? new Date(to) : undefined

  // Transaction is used to ensure both queries are executed in a single transaction
  noStore()
  const ordersPromise = db.transaction(async (tx) => {
    try {
      console.log("Fetching orders for storeId:", storeId)
      const data = await tx
        .select({
          id: orders.id,
          storeId: orders.storeId,
          quantity: orders.quantity,
          amount: orders.amount,
          paymentIntentId: orders.stripePaymentIntentId,
          status: orders.stripePaymentIntentStatus,
          customer: orders.email,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .limit(limit)
        .offset(offset)
        .where(
          and(
            eq(orders.storeId, storeId),
            // Filter by email
            customer ? like(orders.email, `%${customer}%`) : undefined,
            // Filter by status
            statuses.length > 0
              ? inArray(orders.stripePaymentIntentStatus, statuses)
              : undefined,
            // Filter by createdAt
            fromDay && toDay
              ? and(
                  gte(orders.createdAt, fromDay),
                  lte(orders.createdAt, toDay)
                )
              : undefined
          )
        )
        .orderBy(
          column && column in orders
            ? order === "asc"
              ? asc(orders[column])
              : desc(orders[column])
            : desc(orders.createdAt)
        )

      console.log("Fetched orders data:", data)

      const count = await tx
        .select({
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, storeId),
            // Filter by email
            customer ? like(orders.email, `%${customer}%`) : undefined,
            // Filter by status
            statuses.length > 0
              ? inArray(orders.stripePaymentIntentStatus, statuses)
              : undefined,
            // Filter by createdAt
            fromDay && toDay
              ? and(
                  gte(orders.createdAt, fromDay),
                  lte(orders.createdAt, toDay)
                )
              : undefined
          )
        )
        .execute()
        .then((res) => res[0]?.count ?? 0)

      console.log("Total orders count:", count)

      const pageCount = Math.ceil(count / limit)

      return {
        data,
        pageCount,
      }
    } catch (err) {
      console.error("Error fetching orders:", err)
      return {
        data: [],
        pageCount: 0,
      }
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xs:flex-row xs:items-center xs:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
        <React.Suspense fallback={<div className="h-10 w-[200px] animate-pulse rounded-md bg-muted" />}>
          <DateRangePicker align="end" />
        </React.Suspense>
      </div>
      <ErrorBoundary>
        <React.Suspense fallback={<DataTableSkeleton columnCount={6} />}>
          <OrdersTable promise={ordersPromise} storeId={storeId} />
        </React.Suspense>
      </ErrorBoundary>
    </div>
  )
}
