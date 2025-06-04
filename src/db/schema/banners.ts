import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core"
import { generateId } from "@/lib/id"
import { lifecycleDates } from "./utils"

export const banners = pgTable("banners", {
  id: varchar("id", { length: 30 })
    .$defaultFn(() => generateId())
    .primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  link: text("link"),
  isActive: boolean("is_active").notNull().default(true),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  ...lifecycleDates,
}) 