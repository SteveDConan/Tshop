import { type Metadata } from "next"
import { env } from "@/env.js"
import type { SearchParams } from "@/types"

import { getProducts } from "@/lib/queries/product"
import { AlertCard } from "@/components/alert-card"
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { Shell } from "@/components/shell"
import { Products } from "@/components/products"

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Products",
  description: "Buy products from our stores",
}

interface ProductsPageProps {
  searchParams: SearchParams
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  console.log("Search params:", searchParams)
  const productsTransaction = await getProducts(searchParams)
  console.log("Products data:", productsTransaction)
  console.log("Products count:", productsTransaction.data.length)
  console.log("Page count:", productsTransaction.pageCount)

  return (
    <Shell>
      <PageHeader>
        <PageHeaderHeading size="sm">Products</PageHeaderHeading>
        <PageHeaderDescription size="sm">
          Buy products from our stores
        </PageHeaderDescription>
      </PageHeader>
      {/* <AlertCard /> */}
      <Products
        products={productsTransaction.data}
        pageCount={productsTransaction.pageCount}
      />
    </Shell>
  )
}
