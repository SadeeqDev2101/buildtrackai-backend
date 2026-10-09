import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../config/db";
import { projectSites, projects } from "../../config/schema";
import { writeAuditLog } from "../../lib/audit";
import { AppError } from "../../lib/app-error";
import {
  createProjectSchema,
  createProjectSiteSchema,
  updateProjectSchema,
  updateProjectSiteSchema,
} from "./projects.schemas";

function getCompanyIdOrThrow(req: Request): string {
  const companyId = req.user?.companyId;
  if (!companyId) {
    throw new AppError(403, "NO_COMPANY_CONTEXT", "User does not belong to a company");
  }
  return companyId;
}

function getRouteParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", `Invalid route parameter: ${key}`);
  }
  return value;
}

export async function createProject(req: Request, res: Response) {
  const companyId = getCompanyIdOrThrow(req);
  const payload = createProjectSchema.parse(req.body);
  const now = new Date();

  const [project] = await db
    .insert(projects)
    .values({
      companyId,
      name: payload.name,
      clientName: payload.clientName,
      location: payload.location,
      contractSumNgn: payload.contractSumNgn,
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      status: payload.status ?? "planned",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await writeAuditLog({
    companyId,
    actorUserId: req.user?.userId,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    payload,
  });

  return res.status(201).json({ data: project });
}

export async function listProjects(req: Request, res: Response) {
  const companyId = getCompanyIdOrThrow(req);
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.companyId, companyId))
    .orderBy(desc(projects.createdAt));

  return res.status(200).json({ data: rows });
}

export async function updateProject(req: Request, res: Response) {
  const companyId = getCompanyIdOrThrow(req);
  const payload = updateProjectSchema.parse(req.body);
  const projectId = getRouteParam(req, "projectId");

  if (Object.keys(payload).length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one field is required");
  }

  const [project] = await db
    .update(projects)
    .set({
      name: payload.name,
      clientName: payload.clientName,
      location: payload.location,
      contractSumNgn: payload.contractSumNgn,
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      status: payload.status,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
    .returning();

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  await writeAuditLog({
    companyId,
    actorUserId: req.user?.userId,
    action: "project.updated",
    entityType: "project",
    entityId: projectId,
    payload,
  });

  return res.status(200).json({ data: project });
}

export async function createProjectSite(req: Request, res: Response) {
  const companyId = getCompanyIdOrThrow(req);
  const projectId = getRouteParam(req, "projectId");
  const payload = createProjectSiteSchema.parse(req.body);
  const now = new Date();

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
    .limit(1);

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  const [site] = await db
    .insert(projectSites)
    .values({
      companyId,
      projectId,
      name: payload.name,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await writeAuditLog({
    companyId,
    actorUserId: req.user?.userId,
    action: "project.site.created",
    entityType: "project_site",
    entityId: site.id,
    payload: { projectId, ...payload },
  });

  return res.status(201).json({ data: site });
}

export async function listProjectSites(req: Request, res: Response) {
  const companyId = getCompanyIdOrThrow(req);
  const projectId = getRouteParam(req, "projectId");

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
    .limit(1);

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  const rows = await db
    .select()
    .from(projectSites)
    .where(
      and(eq(projectSites.companyId, companyId), eq(projectSites.projectId, projectId)),
    )
    .orderBy(desc(projectSites.createdAt));

  return res.status(200).json({ data: rows });
}

export async function updateProjectSite(req: Request, res: Response) {
  const companyId = getCompanyIdOrThrow(req);
  const projectId = getRouteParam(req, "projectId");
  const siteId = getRouteParam(req, "siteId");
  const payload = updateProjectSiteSchema.parse(req.body);

  if (Object.keys(payload).length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one field is required");
  }

  const [site] = await db
    .update(projectSites)
    .set({
      name: payload.name,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      isActive: payload.isActive,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectSites.id, siteId),
        eq(projectSites.projectId, projectId),
        eq(projectSites.companyId, companyId),
      ),
    )
    .returning();

  if (!site) {
    throw new AppError(404, "SITE_NOT_FOUND", "Project site not found");
  }

  await writeAuditLog({
    companyId,
    actorUserId: req.user?.userId,
    action: "project.site.updated",
    entityType: "project_site",
    entityId: siteId,
    payload: { projectId, ...payload },
  });

  return res.status(200).json({ data: site });
}
