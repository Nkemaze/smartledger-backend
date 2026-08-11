import fs from "fs";
import path from "path";
import multer from "multer";
import { prisma } from "@config/database";
import { NotFoundError } from "@utils/errors";

export const uploadsDir = path.resolve(process.cwd(), "uploads");

// Keep an uploaded file's original name, but prefix it so two receipts with
// the same name never overwrite each other.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error("Unsupported file type. Allowed: PDF, JPG, PNG, WEBP, CSV."));
    }
    cb(null, true);
  },
});

export async function listDocuments(businessId: string) {
  return prisma.document.findMany({
    where: { businessId },
    include: { transaction: { select: { id: true, amount: true, occurredAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocument(businessId: string, documentId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, businessId } });
  if (!document) throw new NotFoundError("Document");
  return document;
}

export async function createDocument(businessId: string, file: Express.Multer.File, input: { type: string; transactionId?: string | null }) {
  return prisma.document.create({
    data: {
      businessId,
      transactionId: input.transactionId ?? null,
      type: input.type,
      fileUrl: `/uploads/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
    },
  });
}

export async function deleteDocument(businessId: string, documentId: string) {
  const document = await getDocument(businessId, documentId);

  // Remove the local file too, so we don't leak orphaned bytes on disk.
  const filePath = path.join(uploadsDir, path.basename(document.fileUrl));
  fs.promises.unlink(filePath).catch(() => {});

  await prisma.document.delete({ where: { id: documentId } });
}
