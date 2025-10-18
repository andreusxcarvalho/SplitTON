import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  total: real("total").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  payer: text("payer").notNull(),
  participants: jsonb("participants").$type<string[]>().notNull(),
  imageUrl: text("image_url"),
  items: jsonb("items").$type<{ name: string; price: number }[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Splits table
export const splits = pgTable("splits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  from: text("from").notNull(),
  to: text("to").notNull(),
  amount: real("amount").notNull(),
  settled: real("settled").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Friends table
export const friends = pgTable("friends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userEmail: text("user_email").notNull(),
  nickname: text("nickname").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const insertExpenseSchema = createInsertSchema(expenses, {
  total: z.number().positive(),
  category: z.string().min(1),
  payer: z.string().min(1),
  participants: z.array(z.string()).min(1),
  items: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })).optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertSplitSchema = createInsertSchema(splits, {
  expenseId: z.string(),
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.number().positive(),
  settled: z.number().min(0).optional(),
}).omit({
  id: true,
  createdAt: true,
});

// User schemas
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3).max(255),
  password: z.string().min(6),
}).omit({
  id: true,
  createdAt: true,
});

// Friend schemas
export const insertFriendSchema = createInsertSchema(friends, {
  userEmail: z.string().email(),
  nickname: z.string().min(1),
  email: z.string().email(),
}).omit({
  id: true,
  createdAt: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Split = typeof splits.$inferSelect;
export type InsertSplit = z.infer<typeof insertSplitSchema>;
export type Friend = typeof friends.$inferSelect;
export type InsertFriend = z.infer<typeof insertFriendSchema>;

// Frontend-only types for UI state
export interface CashFlowArrow {
  from: string;
  to: string;
  amount: number;
}

export interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export interface ReceiptParseResult {
  total: number;
  items?: { name: string; price: number }[];
  confidence: number;
  suggestedCategory?: string;
}
