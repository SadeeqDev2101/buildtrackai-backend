import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2).max(255),
  clientName: z.string().max(255).optional(),
  location: z.string().max(1000).optional(),
  contractSumNgn: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  status: z.enum(["planned", "active", "on_hold", "completed", "cancelled"]).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createProjectSiteSchema = z.object({
  name: z.string().min(2).max(255),
  address: z.string().max(1000).optional(),
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .transform((value) => value.toFixed(7))
    .optional(),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .transform((value) => value.toFixed(7))
    .optional(),
});

export const updateProjectSiteSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  address: z.string().max(1000).optional(),
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .transform((value) => value.toFixed(7))
    .nullable()
    .optional(),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .transform((value) => value.toFixed(7))
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});
