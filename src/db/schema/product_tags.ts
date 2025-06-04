import { relations } from "drizzle-orm"
import { index, pgTable, varchar } from "drizzle-orm/pg-core"
import { generateId } from "@/lib/id"
import { lifecycleDates } from "./utils"
import { products } from "./products"
import { tags } from "./tags"

export const productTags = pgTable(
  "product_tags",
  {
    id: varchar("id", { length: 30 })
      .$defaultFn(() => generateId())
      .primaryKey(),
    productId: varchar("product_id", { length: 30 })
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    tagId: varchar("tag_id", { length: 30 })
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
    ...lifecycleDates,
  },
  (table) => ({
    productIdTagIdIdx: index("product_tags_product_id_tag_id_idx").on(
      table.productId,
      table.tagId
    ),
  })
)

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, {
    fields: [productTags.productId],
    references: [products.id],
  }),
  tag: one(tags, {
    fields: [productTags.tagId],
    references: [tags.id],
  }),
})) 