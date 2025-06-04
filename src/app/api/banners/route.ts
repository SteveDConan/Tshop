import { db } from "@/db"
import { banners } from "@/db/schema"
import { and, gte, lte } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const activeBanners = await db.query.banners.findMany({
      where: and(
        lte(banners.startDate, new Date()),
        gte(banners.endDate, new Date()),
        banners.isActive
      ),
      orderBy: (banners, { desc }) => [desc(banners.createdAt)],
    })

    return NextResponse.json(activeBanners)
  } catch (error) {
    console.error("[BANNERS_GET]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
} 