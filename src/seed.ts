/* eslint-disable no-console */
/**
 * Demo seed data for SmartLedger.
 *
 * Creates a demo business with a full month of realistic activity so the
 * dashboard, inventory, sales, VAT and tax modules render meaningful data
 * right after sign-in.
 *
 * Credentials:
 *   Login  : alex@example.com  (or 6512345678)
 *   Password: password123
 *
 * Idempotent: re-running exits early if the demo business already exists.
 */
import bcrypt from "bcryptjs";
import { Role, TransactionType } from "@prisma/client";
import { prisma } from "@config/database";
import { createTransaction } from "@modules/transactions/transactions.service";
import { createFiling } from "@modules/tax/tax.service";

const OWNER_PHONE = "6512345678";
const OWNER_PASSWORD = "password123";

function monthsAgo(n: number, day = 15, hour = 11, minute = 30): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function seed() {
  const existing = await prisma.user.findUnique({ where: { phone: OWNER_PHONE } });
  if (existing) {
    console.log("Demo business already exists (phone %s). Skipping.", OWNER_PHONE);
    return;
  }

  const business = await prisma.business.create({
    data: {
      name: "Nkemaze Stores",
      shopType: "grocery",
      currency: "XAF",
      taxId: "SRL-2026-00419",
      address: "Rue Mvog Mbi, Yaoundé",
      phone: "+237 651 234 567",
      vatRate: 7.5,
      filingFrequency: "MONTHLY",
    },
  });

  const owner = await prisma.user.create({
    data: {
      businessId: business.id,
      name: "Alex Sterling",
      phone: OWNER_PHONE,
      email: "alex@example.com",
      passwordHash: bcrypt.hashSync(OWNER_PASSWORD, 10),
      role: Role.OWNER,
      monthlyTarget: 5000000,
    },
  });

  const products = await Promise.all([
    prisma.product.create({ data: { businessId: business.id, name: "Rice 5kg", sku: "RCE-5", category: "Food & Staples", unitPrice: 4500, stockQuantity: 240, reorderThreshold: 20 } }),
    prisma.product.create({ data: { businessId: business.id, name: "Palm Oil 5L", sku: "OIL-5", category: "Food & Staples", unitPrice: 6800, stockQuantity: 140, reorderThreshold: 15 } }),
    prisma.product.create({ data: { businessId: business.id, name: "Sugar 2kg", sku: "SUG-2", category: "Food & Staples", unitPrice: 1500, stockQuantity: 380, reorderThreshold: 30 } }),
    prisma.product.create({ data: { businessId: business.id, name: "Flour 25kg", sku: "FLR-25", category: "Food & Staples", unitPrice: 16500, stockQuantity: 45, reorderThreshold: 8 } }),
    prisma.product.create({ data: { businessId: business.id, name: "Cooking Gas 12kg", sku: "GAS-12", category: "Household", unitPrice: 9500, stockQuantity: 18, reorderThreshold: 6 } }),
    prisma.product.create({ data: { businessId: business.id, name: "Laundry Detergent 3kg", sku: "DTG-3", category: "Household", unitPrice: 4200, stockQuantity: 96, reorderThreshold: 15 } }),
    prisma.product.create({ data: { businessId: business.id, name: "Soft Drinks (Crate)", sku: "DRK-C", category: "Beverages", unitPrice: 3800, stockQuantity: 180, reorderThreshold: 25 } }),
    prisma.product.create({ data: { businessId: business.id, name: "Beans 1kg", sku: "BEA-1", category: "Food & Staples", unitPrice: 1200, stockQuantity: 63, reorderThreshold: 20 } }),
  ]);

  const [rice, oil, sugar, flour, gas, detergent, drinks, beans] = products;

  const customers = await Promise.all([
    prisma.customer.create({ data: { businessId: business.id, name: "Marie Ngono", phone: "+237 699 111 222", email: "marie@example.com", address: "Bastos", balance: 0 } }),
    prisma.customer.create({ data: { businessId: business.id, name: "Jean Claude Mbala", phone: "+237 677 333 444", email: "jc@example.com", address: "Mvan", balance: 24000 } }),
    prisma.customer.create({ data: { businessId: business.id, name: "Amina Soule", phone: "+237 691 555 666", email: "amina@example.com", address: "Nlongkak", balance: 0 } }),
  ]);

  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { businessId: business.id, name: "Camfood Distribution", phone: "+237 655 777 888", email: "sales@camfood.cm", address: "Douala", balance: 0 } }),
    prisma.supplier.create({ data: { businessId: business.id, name: "Yaoundé Gas & Co", phone: "+237 690 999 000", email: "orders@ygas.cm", address: "Carrefour 4 Bras", balance: 0 } }),
  ]);

  const [marie, jean, amina] = customers;

  // --- Sales (income) across the last 6 months ----------------------------------
  const sales: Array<{
    monthsAgo: number;
    day: number;
    customerId: string;
    description: string;
    category: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  }> = [
    { monthsAgo: 5, day: 8, customerId: marie.id, description: "Retail sale – weekly groceries", category: "Sales", items: [{ productId: rice.id, quantity: 8, unitPrice: 4500 }, { productId: oil.id, quantity: 4, unitPrice: 6800 }, { productId: sugar.id, quantity: 10, unitPrice: 1500 }] },
    { monthsAgo: 5, day: 21, customerId: jean.id, description: "Wholesale order – Mvan bar", category: "Sales", items: [{ productId: drinks.id, quantity: 30, unitPrice: 3800 }, { productId: gas.id, quantity: 4, unitPrice: 9500 }] },
    { monthsAgo: 4, day: 6, customerId: amina.id, description: "Retail sale – pantry restock", category: "Sales", items: [{ productId: flour.id, quantity: 3, unitPrice: 16500 }, { productId: sugar.id, quantity: 8, unitPrice: 1500 }] },
    { monthsAgo: 4, day: 18, customerId: marie.id, description: "Retail sale – household goods", category: "Sales", items: [{ productId: detergent.id, quantity: 6, unitPrice: 4200 }, { productId: rice.id, quantity: 10, unitPrice: 4500 }] },
    { monthsAgo: 3, day: 10, customerId: jean.id, description: "Wholesale order – restaurant", category: "Sales", items: [{ productId: oil.id, quantity: 12, unitPrice: 6800 }, { productId: flour.id, quantity: 6, unitPrice: 16500 }, { productId: beans.id, quantity: 20, unitPrice: 1200 }] },
    { monthsAgo: 3, day: 24, customerId: amina.id, description: "Retail sale – gas cylinder", category: "Sales", items: [{ productId: gas.id, quantity: 2, unitPrice: 9500 }] },
    { monthsAgo: 2, day: 5, customerId: marie.id, description: "Retail sale – weekly groceries", category: "Sales", items: [{ productId: rice.id, quantity: 6, unitPrice: 4500 }, { productId: detergent.id, quantity: 4, unitPrice: 4200 }, { productId: drinks.id, quantity: 12, unitPrice: 3800 }] },
    { monthsAgo: 2, day: 19, customerId: jean.id, description: "Wholesale order – tontine", category: "Sales", items: [{ productId: drinks.id, quantity: 40, unitPrice: 3800 }, { productId: sugar.id, quantity: 20, unitPrice: 1500 }] },
    { monthsAgo: 1, day: 9, customerId: amina.id, description: "Retail sale – pantry restock", category: "Sales", items: [{ productId: flour.id, quantity: 4, unitPrice: 16500 }, { productId: beans.id, quantity: 10, unitPrice: 1200 }] },
    { monthsAgo: 1, day: 16, customerId: marie.id, description: "Retail sale – household goods", category: "Sales", items: [{ productId: detergent.id, quantity: 8, unitPrice: 4200 }, { productId: oil.id, quantity: 6, unitPrice: 6800 }] },
    { monthsAgo: 0, day: 3, customerId: jean.id, description: "Wholesale order – bar restock", category: "Sales", items: [{ productId: drinks.id, quantity: 25, unitPrice: 3800 }, { productId: gas.id, quantity: 6, unitPrice: 9500 }] },
    { monthsAgo: 0, day: 11, customerId: amina.id, description: "Retail sale – gas cylinder", category: "Sales", items: [{ productId: gas.id, quantity: 3, unitPrice: 9500 }, { productId: beans.id, quantity: 15, unitPrice: 1200 }] },
    { monthsAgo: 0, day: 18, customerId: marie.id, description: "Retail sale – weekly groceries", category: "Sales", items: [{ productId: rice.id, quantity: 12, unitPrice: 4500 }, { productId: sugar.id, quantity: 15, unitPrice: 1500 }] },
    { monthsAgo: 0, day: 24, customerId: jean.id, description: "Wholesale order – event catering", category: "Sales", items: [{ productId: rice.id, quantity: 20, unitPrice: 4500 }, { productId: oil.id, quantity: 15, unitPrice: 6800 }, { productId: drinks.id, quantity: 30, unitPrice: 3800 }] },
  ];

  for (const sale of sales) {
    const amount = sale.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    await createTransaction(
      business.id,
      owner.id,
      {
        type: TransactionType.INCOME,
        category: sale.category,
        amount,
        description: sale.description,
        customerId: sale.customerId,
        vatRate: 7.5,
        occurredAt: monthsAgo(sale.monthsAgo, sale.day),
        items: sale.items,
      }
    );
  }

  // --- Expenses (with VAT) ------------------------------------------------------
  const expenses = [
    { monthsAgo: 2, day: 28, category: "Rent", amount: 250000, description: "Shop rent – 2 months ago" },
    { monthsAgo: 1, day: 28, category: "Rent", amount: 250000, description: "Shop rent – last month" },
    { monthsAgo: 1, day: 15, category: "Utilities", amount: 64000, description: "Electricity (ENEO) + water" },
    { monthsAgo: 1, day: 22, category: "Inventory", amount: 385000, description: "Restock order from Camfood Distribution" },
    { monthsAgo: 0, day: 5, category: "Transport", amount: 27000, description: "Product pickup & delivery" },
    { monthsAgo: 0, day: 12, category: "Utilities", amount: 31200, description: "Mobile data + store wifi" },
    { monthsAgo: 0, day: 20, category: "Salaries", amount: 150000, description: "Part-time cashier advance" },
  ];

  for (const expense of expenses) {
    await createTransaction(business.id, owner.id, {
      type: TransactionType.EXPENSE,
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      vatRate: 7.5,
      occurredAt: monthsAgo(expense.monthsAgo, expense.day, 17, 45),
    });
  }

  // --- VAT filing for the previous month ----------------------------------------
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const prevPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const due = new Date();
  due.setMonth(due.getMonth() + 1);
  due.setDate(15);
  await createFiling(business.id, { period: prevPeriod, dueDate: due.toISOString().slice(0, 10) });

  // --- Notifications --------------------------------------------------------------
  await prisma.notification.createMany({
    data: [
      { businessId: business.id, type: "low_stock", message: '"Cooking Gas 12kg" is low on stock (3 left). Reorder soon.', channel: "in_app" },
      { businessId: business.id, type: "low_stock", message: '"Beans 1kg" is low on stock (18 left). Reorder soon.', channel: "in_app" },
      { businessId: business.id, type: "tax_deadline", message: `VAT filing for ${prevPeriod} is due on ${due.toISOString().slice(0, 10)}.`, channel: "in_app" },
      { businessId: business.id, type: "ai_insight", message: "Sales up 18% vs. last month – consider restocking Rice 5kg.", channel: "in_app" },
    ],
  });

  console.log("Seed complete for business '%s' (id %s)", business.name, business.id);
  console.log("  Login  : alex@example.com (or %s)", OWNER_PHONE);
  console.log("  Password: %s", OWNER_PASSWORD);
  console.log("  Products: %d, Sales: %d, Expenses: %d", products.length, sales.length, expenses.length);
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
