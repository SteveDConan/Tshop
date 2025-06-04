import {
  revalidateItems,
  seedCategories,
  seedSubcategories,
} from "@/lib/actions/seed"
import { db } from "."
import { banners } from "./schema"

async function runSeed() {
  console.log("⏳ Running seed...")

  const start = Date.now()

  await seedCategories()

  await seedSubcategories()

  // Add more seed functions here

  await revalidateItems()

  try {
    await db.insert(banners).values([
      {
        id: "banner_1",
        title: "Summer Sale",
        description: "Get up to 50% off on selected items",
        imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da",
        link: "/products?category=summer",
        isActive: true,
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-08-31"),
      },
      {
        id: "banner_2",
        title: "New Arrivals",
        description: "Check out our latest collection",
        imageUrl: "https://images.unsplash.com/photo-1607082349566-187342175e2f",
        link: "/products?sort=newest",
        isActive: true,
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-12-31"),
      },
      {
        id: "banner_3",
        title: "Special Offer",
        description: "Free shipping on orders over $50",
        imageUrl: "https://images.unsplash.com/photo-1607082349566-187342175e2f",
        link: "/products",
        isActive: true,
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-12-31"),
      },
    ])
    console.log("✅ Seed data inserted")
  } catch (error) {
    console.error("❌ Seed failed")
    throw error
  }

  const end = Date.now()

  console.log(`✅ Seed completed in ${end - start}ms`)

  process.exit(0)
}

runSeed().catch((err) => {
  console.error("❌ Seed failed")
  console.error(err)
  process.exit(1)
})
