import { db } from "@/db"
import { banners } from "@/db/schema"
import { and, gte, lte, eq } from "drizzle-orm"

export async function getBanners() {
  try {
    const currentDate = new Date()
    console.log("Current date:", currentDate)

    const activeBanners = await db.query.banners.findMany({
      where: eq(banners.isActive, true),  // Sử dụng eq() để so sánh boolean
      orderBy: (banners, { desc }) => [desc(banners.createdAt)],
    })

    console.log("Found banners:", activeBanners)
    return activeBanners
  } catch (error) {
    console.error("[GET_BANNERS]", error)
    return []
  }
} 