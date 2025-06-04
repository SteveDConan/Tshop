import * as React from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/db"
import { customers, stores } from "@/db/schema"
import { env } from "@/env.js"
import type { SearchParams } from "@/types"
import { and, asc, desc, eq, gte, like, lte, sql } from "drizzle-orm"

import { customersSearchParamsSchema } from "@/lib/validations/params"
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton"
import { DateRangePicker } from "@/components/date-range-picker"
import { CustomersTable } from "@/components/tables/customers-table"

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Customers",
  description: "Customers for your store",
}

interface CustomersPageProps {
  params: {
    storeId: string
  }
  searchParams: SearchParams
}

export default async function CustomersPage({
  params,
  searchParams,
}: CustomersPageProps) {
  const storeId = decodeURIComponent(params.storeId)

  const { page, per_page, sort, email, from, to } =
    customersSearchParamsSchema.parse(searchParams)

  const store = await db.query.stores.findFirst({
    where: eq(stores.id, storeId),
    columns: {
      id: true,
      name: true,
      description: true,
    },
  })

  if (!store) {
    notFound()
  }

  // Transaction is used to ensure both queries are executed in a single transaction
  const fallbackPage = isNaN(page) || page < 1 ? 1 : page
  // Number of items per page
  const limit = isNaN(per_page) ? 10 : per_page
  // Number of items to skip
  const offset = fallbackPage > 0 ? (fallbackPage - 1) * limit : 0

  const fromDay = from ? new Date(from) : undefined
  const toDay = to ? new Date(to) : undefined

  const customersPromise = db.transaction(async (tx) => {
    const data = await db
      .select({
        name: customers.name,
        email: customers.email,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .limit(limit)
      .offset(offset)
      .where(
        and(
          eq(customers.storeId, storeId),
          // Filter by email
          email ? like(customers.email, `%${email}%`) : undefined,
          // Filter by createdAt
          fromDay && toDay
            ? and(gte(customers.createdAt, fromDay), lte(customers.createdAt, toDay))
            : undefined
        )
      )
      .orderBy(
        sort === "name.asc"
          ? asc(customers.name)
          : sort === "name.desc"
            ? desc(customers.name)
            : sort === "email.asc"
              ? asc(customers.email)
              : sort === "email.desc"
                ? desc(customers.email)
                : sort === "createdAt.asc"
                  ? asc(customers.createdAt)
                  : sort === "createdAt.desc"
                    ? desc(customers.createdAt)
                    : desc(customers.createdAt)
      )

    const count = await tx
      .select({
        count: sql<number>`count(*)`,
      })
      .from(customers)
      .where(
        and(
          eq(customers.storeId, storeId),
          // Filter by email
          email ? like(customers.email, `%${email}%`) : undefined,
          // Filter by createdAt
          fromDay && toDay
            ? and(gte(customers.createdAt, fromDay), lte(customers.createdAt, toDay))
            : undefined
        )
      )
      .execute()
      .then((res) => res[0]?.count ?? 0)

    return {
      data,
      pageCount: Math.ceil(count / limit),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xs:flex-row xs:items-center xs:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
        <DateRangePicker align="end" />
      </div>
      <React.Suspense
        fallback={
          <DataTableSkeleton columnCount={3} filterableColumnCount={0} />
        }
      >
        <CustomersTable promise={customersPromise} storeId={store.id} />
      </React.Suspense>
    </div>
  )
}
