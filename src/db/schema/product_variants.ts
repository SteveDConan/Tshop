import { relations } from "drizzle-orm"
import { index, pgTable, varchar } from "drizzle-orm/pg-core"
import { generateId } from "@/lib/id"
import { lifecycleDates } from "./utils"
import { products } from "./products"
import { variants } from "./variants"

export const productVariants = pgTable(
  "product_variants",
  {
    id: varchar("id", { length: 30 })
      .$defaultFn(() => generateId())
      .primaryKey(),
    productId: varchar("product_id", { length: 30 })
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    variantId: varchar("variant_id", { length: 30 })
      .references(() => variants.id, { onDelete: "cascade" })
      .notNull(),
    ...lifecycleDates,
  },
  (table) => ({
    productIdIdx: index("product_variants_product_id_idx").on(table.productId),
    variantIdIdx: index("product_variants_variant_id_idx").on(table.variantId),
  })
)

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  variant: one(variants, {
    fields: [productVariants.variantId],
    references: [variants.id],
  }),
})) 