import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import { requireCompanyContext } from "../../middleware/tenant";
import {
  acceptCompanyInvite,
  createCompanyInvite,
  getCompanyProfile,
  listCompanyInvites,
  listCompanyUsers,
  updateCompanyProfile,
  updateCompanyUser,
} from "./company.controller";

export const companyRouter = Router();

companyRouter.post("/invites/accept", asyncHandler(acceptCompanyInvite));

companyRouter.use(requireAuth, requireCompanyContext);

companyRouter.get("/", asyncHandler(getCompanyProfile));
companyRouter.patch("/", requireRoles("owner"), asyncHandler(updateCompanyProfile));
companyRouter.get("/users", requireRoles("owner", "pm"), asyncHandler(listCompanyUsers));
companyRouter.patch(
  "/users/:userId",
  requireRoles("owner"),
  asyncHandler(updateCompanyUser),
);
companyRouter.get(
  "/invites",
  requireRoles("owner", "pm"),
  asyncHandler(listCompanyInvites),
);
companyRouter.post(
  "/invites",
  requireRoles("owner"),
  asyncHandler(createCompanyInvite),
);
