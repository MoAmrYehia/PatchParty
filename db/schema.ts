import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  hostHash: text("host_hash").notNull(),
  readHash: text("read_hash").notNull(),
  snapshot: text("snapshot").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
