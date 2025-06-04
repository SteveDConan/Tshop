import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { db } from "@/db"
import { stores } from "@/db/schema"
import { env } from "@/env.js"
import type { SearchParams } from "@/types"
import { format } from "date-fns"
import { eq } from "drizzle-orm"

import {
  getCustomers,
  getOrderCount,
  getSaleCount,
  getSales,
} from "@/lib/actions/order"
import { cn, formatNumber, formatPrice } from "@/lib/utils"
import { searchParamsSchema } from "@/lib/validations/params"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { DateRangePicker } from "@/components/date-range-picker"
import { Skeleton } from "@/components/ui/skeleton"

import { OverviewCard, OverviewCardSkeleton } from "./_components/overview-card"
import { SalesChart } from "./_components/sales-chart"

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Analytics",
  description: "Analytics for your store",
}

interface AnalyticsPageProps {
  params: {
    storeId: string
  }
  searchParams: SearchParams
}

async function AnalyticsContent({
  storeId,
  fromDay,
  toDay,
  page,
  from,
  to,
}: {
  storeId: string
  fromDay?: Date
  toDay?: Date
  page: number
  from?: string
  to?: string
}) {
  const dayCount =
    fromDay && toDay
      ? Math.round(
          (toDay.getTime() - fromDay.getTime()) / (1000 * 60 * 60 * 24)
        )
      : undefined

  const orderCountPromise = getOrderCount({
    storeId,
    fromDay: fromDay,
    toDay: toDay,
  })

  const saleCountPromise = getSaleCount({
    storeId,
    fromDay: fromDay,
    toDay: toDay,
  })

  const salesPromise = getSales({
    storeId,
    fromDay: fromDay,
    toDay: toDay,
  })

  const customersPromise = getCustomers({
    storeId,
    limit: 5,
    offset: (page - 1) * 5,
    fromDay: fromDay,
    toDay: toDay,
  })

  const [saleCount, orderCount, sales, { customers, customerCount }] =
    await Promise.all([
      saleCountPromise,
      orderCountPromise,
      salesPromise,
      customersPromise,
    ])

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-4 xs:flex-row xs:items-center xs:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <DateRangePicker align="end" dayCount={30} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          title="Total Revenue"
          value={formatPrice(saleCount, {
            notation: "standard",
          })}
          description={`Total revenue for the selected period`}
          icon="dollarSign"
        />
        <OverviewCard
          title="Orders"
          value={formatNumber(orderCount)}
          description={`Total orders for the selected period`}
          icon="cart"
        />
        <OverviewCard
          title="Average Order Value"
          value={formatPrice(
            orderCount > 0 ? saleCount / orderCount : 0,
            {
              notation: "standard",
            }
          )}
          description="Average amount per order"
          icon="credit"
        />
        <OverviewCard
          title="Customers"
          value={formatNumber(customerCount)}
          description="Total unique customers"
          icon="activity"
        />
      </div>
      <div className="flex flex-col gap-4 2xl:flex-row">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Sales</CardTitle>
            <CardDescription>
              {dayCount
                ? `Total sales in the last ${dayCount} days`
                : "Total sales over time"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart
              data={sales.map((sale) => ({
                name: format(new Date(sale.year, sale.month - 1), "MMM yyyy"),
                Total: sale.totalSales,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>
              {dayCount
                ? `Customers who purchased in the last ${dayCount} days`
                : "All customers by total spend"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {customers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No customers found
              </p>
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.email}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="size-9">
                      <AvatarFallback>
                        {customer.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="w-full space-y-1 text-sm">
                      <p className="font-medium leading-none">{customer.name}</p>
                      <p className="break-all leading-none text-muted-foreground">
                        {customer.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last order:{" "}
                        {format(new Date(customer.lastOrderDate), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-medium leading-none">
                    {formatPrice(customer.totalSpent)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
          <CardFooter>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={`?page=${page - 1}&from=${from}&to=${to}`}
                    scroll={false}
                    className={cn(
                      "transition-opacity",
                      page === 1 && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href={`?page=${page + 1}&from=${from}&to=${to}`}
                    scroll={false}
                    className={cn(
                      "transition-opacity",
                      Math.ceil(customerCount / 5) === page &&
                        "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-4 xs:flex-row xs:items-center xs:justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-[200px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <OverviewCardSkeleton key={i} />
        ))}
      </div>
      <div className="flex flex-col gap-4 2xl:flex-row">
        <Card className="flex-1">
          <CardHeader>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: AnalyticsPageProps) {
  const storeId = decodeURIComponent(params.storeId)

  const { page, from, to } = searchParamsSchema
    .omit({ per_page: true, sort: true })
    .parse(searchParams)

  const fromDay = from ? new Date(from) : undefined
  const toDay = to ? new Date(to) : undefined

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

  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent
        storeId={storeId}
        fromDay={fromDay}
        toDay={toDay}
        page={page}
        from={from}
        to={to}
      />
    </Suspense>
  )
}
