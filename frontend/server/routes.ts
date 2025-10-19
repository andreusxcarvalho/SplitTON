import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import OpenAI from "openai";
import { storage } from "./storage";
import { insertExpenseSchema, insertSplitSchema, insertFriendSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth } from "./auth";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize OpenAI with Replit AI Integrations
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication (blueprint:javascript_auth_all_persistance)
  setupAuth(app);

  // Parse receipt with OpenAI Vision
  app.post("/api/parse-receipt", upload.single("receipt"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No receipt image provided" });
      }

      const base64Image = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this receipt image and extract:
1. Total amount (as a number)
2. Individual items with prices (if visible)
3. Suggested category (one of: "Food & Drinks", "Transport", "Entertainment", "Shopping", "Bills", "Other")
4. Your confidence level (0-100)

Respond in JSON format:
{
  "total": number,
  "items": [{"name": string, "price": number}],
  "suggestedCategory": string,
  "confidence": number
}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return res.status(500).json({ error: "Failed to parse receipt" });
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: "Invalid response format" });
      }

      const result = JSON.parse(jsonMatch[0]);
      res.json(result);
    } catch (error) {
      console.error("Receipt parsing error:", error);
      res.status(500).json({ error: "Failed to parse receipt" });
    }
  });

  // Get all expenses
  app.get("/api/expenses", async (_req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error) {
      console.error("Get expenses error:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  // Create expense and calculate splits
  app.post("/api/expenses", async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validatedData);

      // Calculate equal split
      const splitAmount = expense.total / expense.participants.length;

      // Create splits for everyone who isn't the payer
      const splits = await Promise.all(
        expense.participants
          .filter((participant) => participant !== expense.payer)
          .map((participant) =>
            storage.createSplit({
              expenseId: expense.id,
              from: participant,
              to: expense.payer,
              amount: splitAmount,
              settled: 0,
            })
          )
      );

      res.json({ expense, splits });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Create expense error:", error);
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  // Get all splits
  app.get("/api/splits", async (_req, res) => {
    try {
      const splits = await storage.getSplits();
      res.json(splits);
    } catch (error) {
      console.error("Get splits error:", error);
      res.status(500).json({ error: "Failed to fetch splits" });
    }
  });

  // Update split settlement
  app.patch("/api/splits/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { settled } = req.body;

      if (typeof settled !== "number" || settled < 0) {
        return res.status(400).json({ error: "Invalid settled amount" });
      }

      const updated = await storage.updateSplit(id, settled);
      if (!updated) {
        return res.status(404).json({ error: "Split not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update split error:", error);
      res.status(500).json({ error: "Failed to update split" });
    }
  });

  // Get friends for a user
  app.get("/api/friends", async (req, res) => {
    try {
      const { userEmail } = req.query;
      
      if (!userEmail || typeof userEmail !== "string") {
        return res.status(400).json({ error: "User email is required" });
      }

      const friends = await storage.getFriends(userEmail);
      res.json(friends);
    } catch (error) {
      console.error("Get friends error:", error);
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  });

  // Add a friend
  app.post("/api/friends", async (req, res) => {
    try {
      const validatedData = insertFriendSchema.parse(req.body);
      const friend = await storage.createFriend(validatedData);
      res.json(friend);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Create friend error:", error);
      res.status(500).json({ error: "Failed to add friend" });
    }
  });

  // Delete a friend
  app.delete("/api/friends/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFriend(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Friend not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete friend error:", error);
      res.status(500).json({ error: "Failed to delete friend" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
