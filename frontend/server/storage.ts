import { type Expense, type InsertExpense, type Split, type InsertSplit, type User, type InsertUser, type Friend, type InsertFriend } from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Users (blueprint:javascript_auth_all_persistance)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  
  // Splits
  getSplits(): Promise<Split[]>;
  getSplitsByExpense(expenseId: string): Promise<Split[]>;
  createSplit(split: InsertSplit): Promise<Split>;
  updateSplit(id: string, settled: number): Promise<Split | undefined>;
  
  // Friends
  getFriends(userEmail: string): Promise<Friend[]>;
  createFriend(friend: InsertFriend): Promise<Friend>;
  deleteFriend(id: string): Promise<boolean>;
  
  // Session store (blueprint:javascript_auth_all_persistance)
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private userIdCounter: number;
  private expenses: Map<string, Expense>;
  private splits: Map<string, Split>;
  private friends: Map<string, Friend>;
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.userIdCounter = 1;
    this.expenses = new Map();
    this.splits = new Map();
    this.friends = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const expense: Expense = {
      ...insertExpense,
      description: insertExpense.description ?? null,
      imageUrl: insertExpense.imageUrl ?? null,
      items: insertExpense.items ?? null,
      id,
      createdAt: new Date(),
    };
    this.expenses.set(id, expense);
    return expense;
  }

  async getSplits(): Promise<Split[]> {
    return Array.from(this.splits.values());
  }

  async getSplitsByExpense(expenseId: string): Promise<Split[]> {
    return Array.from(this.splits.values()).filter(
      (split) => split.expenseId === expenseId
    );
  }

  async createSplit(insertSplit: InsertSplit): Promise<Split> {
    const id = randomUUID();
    const split: Split = {
      ...insertSplit,
      settled: insertSplit.settled ?? 0,
      id,
      createdAt: new Date(),
    };
    this.splits.set(id, split);
    return split;
  }

  async updateSplit(id: string, settled: number): Promise<Split | undefined> {
    const split = this.splits.get(id);
    if (!split) return undefined;
    
    const updated: Split = { ...split, settled };
    this.splits.set(id, updated);
    return updated;
  }

  async getFriends(userEmail: string): Promise<Friend[]> {
    return Array.from(this.friends.values())
      .filter(f => f.userEmail === userEmail)
      .sort((a, b) => a.nickname.localeCompare(b.nickname));
  }

  async createFriend(insertFriend: InsertFriend): Promise<Friend> {
    const id = randomUUID();
    const friend: Friend = {
      ...insertFriend,
      id,
      createdAt: new Date(),
    };
    this.friends.set(id, friend);
    return friend;
  }

  async deleteFriend(id: string): Promise<boolean> {
    return this.friends.delete(id);
  }
}

export const storage = new MemStorage();
