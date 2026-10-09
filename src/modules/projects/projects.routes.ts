import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import { requireCompanyContext } from "../../middleware/tenant";
import {
  createProject,
  createProjectSite,
  listProjects,
  listProjectSites,
  updateProject,
  updateProjectSite,
} from "./projects.controller";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requireCompanyContext);

projectsRouter.get(
  "/",
  requireRoles("owner", "pm", "engineer", "storekeeper", "accountant"),
  asyncHandler(listProjects),
);
projectsRouter.post("/", requireRoles("owner", "pm"), asyncHandler(createProject));
projectsRouter.patch(
  "/:projectId",
  requireRoles("owner", "pm"),
  asyncHandler(updateProject),
);
projectsRouter.get(
  "/:projectId/sites",
  requireRoles("owner", "pm", "engineer", "storekeeper", "accountant"),
  asyncHandler(listProjectSites),
);
projectsRouter.post(
  "/:projectId/sites",
  requireRoles("owner", "pm"),
  asyncHandler(createProjectSite),
);
projectsRouter.patch(
  "/:projectId/sites/:siteId",
  requireRoles("owner", "pm"),
  asyncHandler(updateProjectSite),
);
