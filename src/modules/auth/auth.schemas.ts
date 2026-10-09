import { z } from "zod";

export const registerSchema = z.object({
  companyName: z.string().min(2).max(255),
  rcNumber: z.string().max(120).optional(),
  fullName: z.string().min(2).max(255),
  email: z.email().max(255),
  phone: z.string().max(30).optional(),
  password: z.string().min(8).max(120),
  planTier: z.enum(["individual", "small_company", "big_construction_firm"]),
  billingCycle: z.enum(["monthly", "annual"]),
});

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(8).max(120),
});
