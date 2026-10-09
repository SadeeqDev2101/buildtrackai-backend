import { z } from "zod";

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  rcNumber: z.string().max(120).nullable().optional(),
  approvalThresholdNgn: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const createInviteSchema = z.object({
  email: z.email().max(255),
  role: z.enum(["pm", "engineer", "storekeeper", "accountant", "subcontractor"]),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20),
  fullName: z.string().min(2).max(255),
  password: z.string().min(8).max(120),
  phone: z.string().max(30).optional(),
});

export const updateUserSchema = z.object({
  role: z
    .enum([
      "owner",
      "pm",
      "engineer",
      "storekeeper",
      "accountant",
      "subcontractor",
      "platform_admin",
    ])
    .optional(),
  isActive: z.boolean().optional(),
});
