import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { errorMiddleware } from "@middleware/error.middleware";

import authRoutes from "@modules/auth/auth.routes";
import userRoutes from "@modules/users/user.routes";
import businessRoutes from "@modules/business/business.routes";
import transactionRoutes from "@modules/transactions/transactions.routes";
import inventoryRoutes from "@modules/inventory/inventory.routes";
import customerRoutes from "@modules/customers/customers.routes";
import supplierRoutes from "@modules/suppliers/suppliers.routes";
import taxRoutes from "@modules/tax/tax.routes";
import advisorRoutes from "@modules/advisor/advisor.routes";
import whatsappRoutes from "@modules/whatsapp/whatsapp.routes";
import reportRoutes from "@modules/reports/reports.routes";
import notificationRoutes from "@modules/notifications/notifications.routes";
import syncRoutes from "@modules/sync/sync.routes";
import archiveRoutes from "@modules/archive/archive.routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(
  express.json({
    // Capture the raw body so WhatsApp webhook signatures can be verified.
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  })
);
app.use(morgan("dev"));

// Uploaded receipts/invoices are served from /uploads (local storage only;
// swap for S3/R2 via env.storage when you have bucket credentials).
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Public
app.use("/api/auth", authRoutes);

// Authenticated (each router applies its own auth/role middleware)
app.use("/api/staff", userRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/advisor", advisorRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/archive", archiveRoutes);

// Must be registered last
app.use(errorMiddleware);
