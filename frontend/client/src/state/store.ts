import { create } from 'zustand';
import type { Expense, Split, CashFlowArrow } from '@shared/schema';

interface ExpenseState {
  expenses: Expense[];
  splits: Split[];
  currentExpense: Expense | null;
  uploadedImage: string | null;
  
  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  setSplits: (splits: Split[]) => void;
  setCurrentExpense: (expense: Expense | null) => void;
  setUploadedImage: (image: string | null) => void;
  
  getCashFlowArrows: () => CashFlowArrow[];
  getTotalSpent: () => number;
  getCategoryBreakdown: () => { name: string; value: number; color: string }[];
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  splits: [],
  currentExpense: null,
  uploadedImage: null,
  
  setExpenses: (expenses) => set({ expenses }),
  addExpense: (expense) => set((state) => ({ 
    expenses: [expense, ...state.expenses] 
  })),
  setSplits: (splits) => set({ splits }),
  setCurrentExpense: (expense) => set({ currentExpense: expense }),
  setUploadedImage: (image) => set({ uploadedImage: image }),
  
  getCashFlowArrows: () => {
    const { splits } = get();
    const netFlows = new Map<string, Map<string, number>>();
    
    // Calculate net flows
    splits.forEach(split => {
      const unsettled = split.amount - split.settled;
      if (unsettled > 0) {
        if (!netFlows.has(split.from)) {
          netFlows.set(split.from, new Map());
        }
        const fromMap = netFlows.get(split.from)!;
        fromMap.set(split.to, (fromMap.get(split.to) || 0) + unsettled);
      }
    });
    
    // Convert to arrows
    const arrows: CashFlowArrow[] = [];
    netFlows.forEach((toMap, from) => {
      toMap.forEach((amount, to) => {
        if (amount > 0.01) {
          arrows.push({ from, to, amount });
        }
      });
    });
    
    return arrows.sort((a, b) => b.amount - a.amount);
  },
  
  getTotalSpent: () => {
    const { expenses } = get();
    return expenses.reduce((sum, exp) => sum + exp.total, 0);
  },
  
  getCategoryBreakdown: () => {
    const { expenses } = get();
    const categoryTotals = new Map<string, number>();
    
    expenses.forEach(exp => {
      const current = categoryTotals.get(exp.category) || 0;
      categoryTotals.set(exp.category, current + exp.total);
    });
    
    const colors = [
      'hsl(var(--chart-3))',
      'hsl(var(--chart-1))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))',
      'hsl(var(--chart-2))',
    ];
    
    return Array.from(categoryTotals.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  },
}));
