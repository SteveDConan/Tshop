import * as React from "react"

import { getGithubStars } from "@/lib/queries/github"
import { getCategories, getFeaturedProducts } from "@/lib/queries/product"
import { getFeaturedStores } from "@/lib/queries/store"
import { getBanners } from "@/lib/queries/banner"

import { Lobby } from "./_components/lobby"
import { LobbySkeleton } from "./_components/lobby-skeleton"

export default async function HomePage() {
  /**
   * To avoid sequential waterfall requests, multiple promises are passed to fetch data parallelly.
   * These promises are also passed to the `Lobby` component, making them hot promises. This means they can execute without being awaited, further preventing sequential requests.
   * @see https://www.youtube.com/shorts/A7GGjutZxrs
   * @see https://nextjs.org/docs/app/building-your-application/data-fetching/patterns#parallel-data-fetching
   */
  const [githubStars, products, categories, stores, banners] = await Promise.all([
    getGithubStars(),
    getFeaturedProducts(),
    getCategories(),
    getFeaturedStores(),
    getBanners(),
  ])

  return (
    <React.Suspense fallback={<LobbySkeleton />}>
      <Lobby
        githubStarsPromise={githubStars}
        productsPromise={products}
        categoriesPromise={categories}
        storesPromise={stores}
        bannersPromise={banners}
      />
    </React.Suspense>
  )
}
