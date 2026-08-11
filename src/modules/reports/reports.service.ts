import { prisma } from "@config/database";
import { TransactionType } from "@prisma/client";
import { getTotals } from "@modules/transactions/transactions.service";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(count: number): Date[] {
  const now = new Date();
  const months: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return months;
}

/**
 * One endpoint that powers the whole dashboard screen: headline KPIs,
 * a monthly revenue trend, expense split by category, low-stock warnings,
 * top-selling products, and the most recent transactions.
 */
export async function getDashboard(businessId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [totals, monthTotals, incomeTxns, lowStock, topProducts, recentTxns, productAgg, customerAgg, supplierAgg] =
    await Promise.all([
      getTotals(businessId),
      getTotals(businessId, monthStart.toISOString()),
      prisma.transaction.findMany({
        where: { businessId, type: TransactionType.INCOME, occurredAt: { gte: sixMonthsAgo } },
        select: { occurredAt: true, amount: true },
      }),
      prisma.product.findMany({
        where: { businessId },
        select: { id: true, name: true, stockQuantity: true, reorderThreshold: true, unitPrice: true },
        orderBy: { stockQuantity: "asc" },
      }),
      prisma.transactionItem.groupBy({
        by: ["productId"],
        where: { transaction: { businessId } },
        _sum: { quantity: true },
        _max: { unitPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.transaction.findMany({
        where: { businessId },
        include: { customer: { select: { name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 8,
      }),
      prisma.product.aggregate({ where: { businessId }, _sum: { unitPrice: true, stockQuantity: true }, _count: true }),
      prisma.customer.aggregate({ where: { businessId }, _sum: { balance: true } }),
      prisma.supplier.aggregate({ where: { businessId }, _sum: { balance: true } }),
    ]);

  // Bucket the last 6 months of income into a trend series.
  const bucket = new Map<string, number>();
  for (const t of incomeTxns) bucket.set(monthKey(t.occurredAt), (bucket.get(monthKey(t.occurredAt)) ?? 0) + Number(t.amount));
  const salesTrend = lastMonths(6).map((m) => ({ period: monthKey(m), revenue: Math.round((bucket.get(monthKey(m)) ?? 0) * 100) / 100 }));

  // Expense share by category for the dashboard donut.
  const expenseGroup = await prisma.transaction.groupBy({
    by: ["category"],
    where: { businessId, type: TransactionType.EXPENSE },
    _sum: { amount: true },
  });

  const productsMap = new Map(lowStock.map((p) => [p.id, p]));
  const topProductNames = topProducts
    .map((row) => {
      const product = productsMap.get(row.productId);
      return { productId: row.productId, name: product?.name ?? null, quantitySold: Number(row._sum.quantity ?? 0), revenue: Number(row._max.unitPrice ?? 0) * Number(row._sum.quantity ?? 0) };
    })
    .filter((p) => p.quantitySold > 0);

  const totalValue = Number(productAgg._sum.unitPrice ?? 0) * Number(productAgg._sum.stockQuantity ?? 0);

  return {
    totals,
    currentMonth: {
      revenue: monthTotals.revenue,
      expenses: monthTotals.expenses,
      profit: monthTotals.profit,
    },
    salesTrend,
    expenseShare: expenseGroup.map((e) => ({ category: e.category, amount: Number(e._sum.amount ?? 0) })),
    lowStockProducts: lowStock.filter((p) => p.stockQuantity <= p.reorderThreshold),
    topProducts: topProductNames,
    recentTransactions: recentTxns,
    inventory: {
      products: productAgg._count ?? 0,
      totalValue,
      lowStockCount: lowStock.filter((p) => p.stockQuantity <= p.reorderThreshold).length,
    },
    receivables: Number(customerAgg._sum.balance ?? 0),
    payables: Number(supplierAgg._sum.balance ?? 0),
  };
}

/** Profit & Loss statement over a date range (defaults to the current month). */
export async function getPnl(businessId: string, from?: string, to?: string) {
  const range = from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined;

  const [revenue, expenses, vatCollected, vatPaid] = await Promise.all([
    prisma.transaction.aggregate({ where: { businessId, type: TransactionType.INCOME, occurredAt: range }, _sum: { amount: true } }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { businessId, type: TransactionType.EXPENSE, occurredAt: range },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({ where: { businessId, type: TransactionType.INCOME, occurredAt: range }, _sum: { vatAmount: true } }),
    prisma.transaction.aggregate({ where: { businessId, type: TransactionType.EXPENSE, occurredAt: range }, _sum: { vatAmount: true } }),
  ]);

  const totalRevenue = Number(revenue._sum.amount ?? 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e._sum.amount ?? 0), 0);

  return {
    revenue: totalRevenue,
    expenseBreakdown: expenses.map((e) => ({ category: e.category, amount: Number(e._sum.amount ?? 0) })),
    totalExpenses: expenseTotal,
    grossProfit: totalRevenue - expenseTotal,
    vatCollected: Number(vatCollected._sum.vatAmount ?? 0),
    vatPaid: Number(vatPaid._sum.vatAmount ?? 0),
    netProfit: totalRevenue - expenseTotal - (Number(vatCollected._sum.vatAmount ?? 0) - Number(vatPaid._sum.vatAmount ?? 0)),
  };
}

/** Simple balance sheet: cash, inventory, receivables, payables, VAT owed. */
export async function getBalanceSheet(businessId: string) {
  const [income, expenses, productAgg, customerAgg, supplierAgg, vatCollected, vatPaid] = await Promise.all([
    prisma.transaction.aggregate({ where: { businessId, type: TransactionType.INCOME }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { businessId, type: TransactionType.EXPENSE }, _sum: { amount: true } }),
    prisma.product.findMany({ where: { businessId }, select: { unitPrice: true, stockQuantity: true } }),
    prisma.customer.aggregate({ where: { businessId }, _sum: { balance: true } }),
    prisma.supplier.aggregate({ where: { businessId }, _sum: { balance: true } }),
    prisma.transaction.aggregate({ where: { businessId, type: TransactionType.INCOME }, _sum: { vatAmount: true } }),
    prisma.transaction.aggregate({ where: { businessId, type: TransactionType.EXPENSE }, _sum: { vatAmount: true } }),
  ]);

  const inventoryValue = productAgg.reduce((sum, p) => sum + Number(p.unitPrice) * p.stockQuantity, 0);
  const cash = Number(income._sum.amount ?? 0) - Number(expenses._sum.amount ?? 0);
  const receivables = Number(customerAgg._sum.balance ?? 0);
  const payables = Number(supplierAgg._sum.balance ?? 0);
  const vatOwed = Number(vatCollected._sum.vatAmount ?? 0) - Number(vatPaid._sum.vatAmount ?? 0);

  return {
    assets: { cash, inventory: inventoryValue, receivables, total: cash + inventoryValue + receivables },
    liabilities: { payables, vatOwed, total: payables + vatOwed },
    equity: cash + inventoryValue + receivables - payables - vatOwed,
  };
}

/** Exports all transactions for the business as a CSV string. */
export async function exportTransactionsCsv(businessId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { businessId },
    include: { customer: { select: { name: true } } },
    orderBy: { occurredAt: "desc" },
  });

  const header = "id,date,type,category,amount,description,customer,vatAmount";
  const rows = transactions.map((t) =>
    [t.id, t.occurredAt.toISOString(), t.type, `"${t.category}"`, t.amount, `"${t.description ?? ""}"`, `"${t.customer?.name ?? ""}"`, t.vatAmount ?? ""].join(",")
  );

  return [header, ...rows].join("\n");
}
