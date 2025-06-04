import { relations } from "drizzle-orm"
import { decimal, index, pgTable, text, varchar } from "drizzle-orm/pg-core"
import { generateId } from "@/lib/id"
import { lifecycleDates } from "./utils"
import { productVariants } from "./product_variants"
import { stocks } from "./stocks"

export const productVariantValues = pgTable(
  "product_variant_values",
  {
    id: varchar("id", { length: 30 })
      .$defaultFn(() => generateId())
      .primaryKey(),
    productVariantId: varchar("product_variant_id", { length: 30 })
      .references(() => productVariants.id, { onDelete: "cascade" })
      .notNull(),
    value: text("value").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    stockId: varchar("stock_id", { length: 30 })
      .references(() => stocks.id, { onDelete: "cascade" })
      .notNull(),
    ...lifecycleDates,
  },
  (table) => ({
    productVariantIdIdx: index("product_variant_values_product_variant_id_idx").on(
      table.productVariantId
    ),
    stockIdIdx: index("product_variant_values_stock_id_idx").on(table.stockId),
  })
)

export const productVariantValuesRelations = relations(
  productVariantValues,
  ({ one }) => ({
    productVariant: one(productVariants, {
      fields: [productVariantValues.productVariantId],
      references: [productVariants.id],
    }),
    stock: one(stocks, {
      fields: [productVariantValues.stockId],
      references: [stocks.id],
    }),
  })
) 