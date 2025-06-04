import Link from "next/link"

import { siteConfig } from "@/config/site"
import { type getGithubStars } from "@/lib/queries/github"
import type { getCategories, getFeaturedProducts } from "@/lib/queries/product"
import { type getFeaturedStores } from "@/lib/queries/store"
import { type getBanners } from "@/lib/queries/banner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { ContentSection } from "@/components/content-section"
import { Icons } from "@/components/icons"
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { ProductCard } from "@/components/product-card"
import { Shell } from "@/components/shell"
import { StoreCard } from "@/components/store-card"
import { BannerCarousel } from "@/components/banner-carousel"
import { type StoredFile } from "@/types"

import { CategoryCard } from "./category-card"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
}

interface Product {
  id: string
  name: string
  images: StoredFile[] | null
  price: string
  inventory: number
  category: string | null
  description: string | null
  status: "active" | "draft" | "archived"
  createdAt: Date
  updatedAt: Date | null
  subcategoryId: string | null
  storeId: string
}

interface Store {
  id: string
  name: string
  slug: string
  description: string | null
  stripeAccountId: string | null
  productCount: number
}

interface LobbyProps {
  githubStarsPromise: ReturnType<typeof getGithubStars>
  productsPromise: ReturnType<typeof getFeaturedProducts>
  categoriesPromise: ReturnType<typeof getCategories>
  storesPromise: ReturnType<typeof getFeaturedStores>
  bannersPromise: ReturnType<typeof getBanners>
}

export async function Lobby({
  githubStarsPromise,
  productsPromise,
  categoriesPromise,
  storesPromise,
  bannersPromise,
}: LobbyProps) {
  // @see the "Parallel data fetching" docs: https://nextjs.org/docs/app/building-your-application/data-fetching/patterns#parallel-data-fetching
  const [githubStars, products, categories, stores, banners] = await Promise.all([
    githubStarsPromise,
    productsPromise,
    categoriesPromise,
    storesPromise,
    bannersPromise,
  ])
  return (
    <Shell className="max-w-6xl gap-0">
      <PageHeader
        as="section"
        className="mx-auto items-center gap-2 text-center"
        withPadding
      >
        {/* <Link
          href={siteConfig.links.github}
          target="_blank"
          rel="noreferrer"
          className="animate-fade-up"
          style={{ animationDelay: "0.10s", animationFillMode: "both" }}
        >
          <Badge
            aria-hidden="true"
            variant="secondary"
            className="rounded-full px-3.5 py-1.5"
          >
            <Icons.gitHub className="mr-2 size-3.5" aria-hidden="true" />
            {githubStars} stars on GitHub
          </Badge>
        </Link> */}
        <div className="flex w-full flex-col gap-8 md:flex-row md:items-center">
          <div className="animate-fade-up md:w-1/2" style={{ animationDelay: "0.40s", animationFillMode: "both" }}>
            <PageHeaderHeading
              className="animate-fade-up"
              style={{ animationDelay: "0.20s", animationFillMode: "both" }}
            >
              Foundation for your commerce platform
            </PageHeaderHeading>
            <PageHeaderDescription
              className="max-w-[46.875rem] animate-fade-up"
              style={{ animationDelay: "0.30s", animationFillMode: "both" }}
            >
              Tshop is an open-source platform for building and customizing your
              own commerce platform with ease.
            </PageHeaderDescription>
            <PageActions
              className="flex justify-center gap-4"
            >
              <Link href="/products" className={cn(buttonVariants())}>
                Buy now
              </Link>
              <Link
                href="/dashboard/stores"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Sell now
              </Link>
            </PageActions>
          </div>
          <div className="animate-fade-up md:w-1/2" style={{ animationDelay: "0.40s", animationFillMode: "both" }}>
            <BannerCarousel banners={banners} />
          </div>
        </div>
      </PageHeader>
      <section
        className="grid animate-fade-up grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-4"
        style={{ animationDelay: "0.50s", animationFillMode: "both" }}
      >
        {categories.map((category: Category) => (
          <CategoryCard key={category.name} category={category} />
        ))}
      </section>
      <ContentSection
        title="Featured products"
        description="Explore products from around the world"
        href="/products"
        linkText="View all products"
        className="pt-14 md:pt-20 lg:pt-24"
      >
        {products.map((product: Product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ContentSection>
      <ContentSection
        title="Featured stores"
        description="Explore stores from around the world"
        href="/stores"
        linkText="View all stores"
        className="py-14 md:py-20 lg:py-24"
      >
        {stores.map((store: Store) => (
          <StoreCard
            key={store.id}
            store={store}
            href={`/products?store_ids=${store.id}`}
          />
        ))}
      </ContentSection>
    </Shell>
  )
}
