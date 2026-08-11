import { prisma } from "@config/database";
import { TransactionType } from "@prisma/client";
import { getTotals } from "@modules/transactions/transactions.service";

type Insight = {
  id: string;
  type: "low_stock" | "cashflow" | "tax" | "sales" | "inventory";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  recommendation?: string;
};

/**
 * Rule-based business advisor. Generates actionable insights straight from
 * the business's own data, so SMEs get useful guidance without needing an
 * external LLM (an LLM can be layered on later if an API key is configured).
 */
export async function getInsights(businessId: string): Promise<{ insights: Insight[] }> {
  const insights: Insight[] = [];

  const [totals, lowStock, topProducts, filings, slowProducts, customerAgg, supplierAgg] = await Promise.all([
    getTotals(businessId),
    prisma.product.findMany({
      where: { businessId },
      select: { id: true, name: true, stockQuantity: true, reorderThreshold: true },
      orderBy: { stockQuantity: "asc" },
    }),
    prisma.transactionItem.groupBy({
      by: ["productId"],
      where: { transaction: { businessId, type: TransactionType.INCOME } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 3,
    }),
    prisma.taxFiling.findMany({ where: { businessId, status: { in: ["DRAFT", "SUBMITTED"] } }, orderBy: { dueDate: "asc" } }),
    prisma.product.findMany({
      where: { businessId },
      include: { transactionItems: { select: { id: true } } },
    }),
    prisma.customer.aggregate({ where: { businessId }, _sum: { balance: true } }),
    prisma.supplier.aggregate({ where: { businessId }, _sum: { balance: true } }),
  ]);

  // 1. Low stock warnings.
  for (const product of lowStock) {
    if (product.stockQuantity <= product.reorderThreshold) {
      insights.push({
        id: `stock-${product.id}`,
        type: "low_stock",
        severity: product.stockQuantity === 0 ? "critical" : "warning",
        title: product.stockQuantity === 0 ? `"${product.name}" is out of stock` : `"${product.name}" is running low`,
        message: product.stockQuantity === 0
          ? `You have no units of ${product.name} left to sell.`
          : `Only ${product.stockQuantity} units of ${product.name} remain (threshold ${product.reorderThreshold}).`,
        recommendation: product.stockQuantity === 0
          ? "Reorder immediately to avoid lost sales."
          : `Restock soon to keep up with demand.`,
      });
    }
  }

  // 2. Cash flow health.
  if (totals.profit < 0) {
    insights.push({
      id: "cashflow-negative",
      type: "cashflow",
      severity: "critical",
      title: "Expenses are exceeding income",
      message: `Your profit is currently negative (${totals.profit.toLocaleString()} ${"FCFA"}).`,
      recommendation: "Review your largest expense categories this month.",
    });
  } else if (totals.expenses > 0 && totals.expenses / totals.revenue > 0.8) {
    insights.push({
      id: "cashflow-tight",
      type: "cashflow",
      severity: "warning",
      title: "Profit margin is getting thin",
      message: "More than 80% of your revenue is going to expenses.",
      recommendation: "Look for ways to trim recurring costs.",
    });
  }

  // 3. Top sellers.
  const productMap = new Map(slowProducts.map((p) => [p.id, p]));
  const best = topProducts[0];
  if (best) {
    const product = productMap.get(best.productId);
    insights.push({
      id: `top-${best.productId}`,
      type: "sales",
      severity: "info",
      title: `"${product?.name ?? "Top product"}" is your best seller`,
      message: `This item sold ${best._sum.quantity} units and is driving most of your revenue.`,
      recommendation: "Consider stocking more of it and featuring it in promotions.",
    });
  }

  // 4. Slow-moving inventory.
  const slow = slowProducts.filter((p) => p.transactionItems.length === 0).slice(0, 3);
  if (slow.length > 0) {
    insights.push({
      id: "slow-movers",
      type: "inventory",
      severity: "info",
      title: "Some products haven't sold yet",
      message: `${slow.length} product${slow.length > 1 ? "s" : ""} have no recorded sales (e.g. ${slow.map((p) => `"${p.name}"`).join(", ")}).`,
      recommendation: "Run a discount or move them to a visible shelf.",
    });
  }

  // 5. Upcoming tax filing.
  const due = filings.find((f) => f.dueDate && f.dueDate.getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000);
  if (due) {
    insights.push({
      id: `tax-${due.id}`,
      type: "tax",
      severity: "warning",
      title: `VAT filing for ${due.period} is due soon`,
      message: `Due ${due.dueDate!.toLocaleDateString()}. Current status: ${due.status}.`,
      recommendation: "Submit your filing before the deadline to avoid penalties.",
    });
  }

  // 6. Receivables vs payables.
  const receivables = Number(customerAgg._sum.balance ?? 0);
  const payables = Number(supplierAgg._sum.balance ?? 0);
  if (receivables > 0) {
    insights.push({
      id: "receivables",
      type: "cashflow",
      severity: "info",
      title: `Customers owe ${receivables.toLocaleString()} FCFA`,
      message: "Outstanding customer balances are tying up your cash.",
      recommendation: "Send reminders or offer a small settlement discount.",
    });
  }
  if (payables > 0) {
    insights.push({
      id: "payables",
      type: "cashflow",
      severity: "info",
      title: `You owe suppliers ${payables.toLocaleString()} FCFA`,
      message: "Keep track of due payments to suppliers.",
      recommendation: "Schedule payments to protect your supplier relationships.",
    });
  }

  return { insights };
}
