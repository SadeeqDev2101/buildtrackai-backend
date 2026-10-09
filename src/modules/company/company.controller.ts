import crypto from "crypto";
import type { Request, Response } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../config/db";
import { companies, companyInvites, refreshTokens, users } from "../../config/schema";
import { env } from "../../config/env";
import { writeAuditLog } from "../../lib/audit";
import { AppError } from "../../lib/app-error";
import { hashPassword } from "../auth/password";
import {
  getRefreshTokenExpiry,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
} from "../auth/auth.utils";
import {
  acceptInviteSchema,
  createInviteSchema,
  updateCompanySchema,
  updateUserSchema,
} from "./company.schemas";

function getRouteParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", `Invalid route parameter: ${key}`);
  }
  return value;
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/api/v1/auth",
  });
}

export async function getCompanyProfile(req: Request, res: Response) {
  const companyId = req.user?.companyId;
  if (!companyId) {
    throw new AppError(403, "NO_COMPANY_CONTEXT", "User does not belong to a company");
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    throw new AppError(404, "COMPANY_NOT_FOUND", "Company not found");
  }

  return res.status(200).json({ data: company });
}

export async function updateCompanyProfile(req: Request, res: Response) {
  const companyId = req.user?.companyId;
  if (!companyId) {
    throw new AppError(403, "NO_COMPANY_CONTEXT", "User does not belong to a company");
  }

  const payload = updateCompanySchema.parse(req.body);
  if (Object.keys(payload).length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one field is required");
  }

  const [updatedCompany] = await db
    .update(companies)
    .set({
      name: payload.name,
      rcNumber: payload.rcNumber,
      approvalThresholdNgn: payload.approvalThresholdNgn,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))
    .returning();

  if (!updatedCompany) {
    throw new AppError(404, "COMPANY_NOT_FOUND", "Company not found");
  }

  await writeAuditLog({
    companyId,
    actorUserId: req.user?.userId,
    action: "company.updated",
    entityType: "company",
    entityId: companyId,
    payload,
  });

  return res.status(200).json({ data: updatedCompany });
}

export async function listCompanyUsers(req: Request, res: Response) {
  const companyId = req.user?.companyId;
  if (!companyId) {
    throw new AppError(403, "NO_COMPANY_CONTEXT", "User does not belong to a company");
  }

  const rows = await db
    .select({
      id: users.id,
      companyId: users.companyId,
      role: users.role,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.companyId, companyId))
    .orderBy(desc(users.createdAt));

  return res.status(200).json({ data: rows });
}

export async function updateCompanyUser(req: Request, res: Response) {
  const companyId = req.user?.companyId;
  if (!companyId || !req.user) {
    throw new AppError(403, "NO_COMPANY_CONTEXT", "User does not belong to a company");
  }

  const userId = getRouteParam(req, "userId");
  const payload = updateUserSchema.parse(req.body);
  if (Object.keys(payload).length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one field is required");
  }

  if (userId === req.user.userId && payload.isActive === false) {
    throw new AppError(400, "INVALID_ACTION", "You cannot deactivate your own account");
  }

  const [target] = await db
    .select({
      id: users.id,
      companyId: users.companyId,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
    .limit(1);

  if (!target) {
    throw new AppError(404, "USER_NOT_FOUND", "Company user not found");
  }

  if (target.role === "owner" && payload.role && payload.role !== "owner") {
    throw new AppError(400, "INVALID_ACTION", "Owner role cannot be reassigned");
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      role: payload.role,
      isActive: payload.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
    .returning({
      id: users.id,
      role: users.role,
      isActive: users.isActive,
      updatedAt: users.updatedAt,
    });

  await writeAuditLog({
    companyId,
    actorUserId: req.user.userId,
    action: "company.user.updated",
    entityType: "user",
    entityId: userId,
    payload,
  });

  return res.status(200).json({ data: updatedUser });
}

export async function createCompanyInvite(req: Request, res: Response) {
  const companyId = req.user?.companyId;
  if (!companyId || !req.user) {
    throw new AppError(403, "NO_COMPANY_CONTEXT", "User does not belong to a company");
  }

  const payload = createInviteSchema.parse(req.body);
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + payload.expiresInDays);

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, payload.email))
    .limit(1);

  if (existingUser) {
    throw new AppError(409, "EMAIL_EXISTS", "A user with this email already exists");
  }

  await db
    .update(companyInvites)
    .set({ status: "revoked", revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(companyInvites.companyId, companyId),
        eq(companyInvites.email, payload.email),
        eq(companyInvites.status, "pending"),
      ),
    );

  const [invite] = await db
    .insert(companyInvites)
    .values({
      companyId,
      email: payload.email,
      role: payload.role,
      tokenHash,
      status: "pending",
      invitedByUserId: req.user.userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await writeAuditLog({
    companyId,
    actorUserId: req.user.userId,
    action: "company.invite.created",
    entityType: "invite",
    entityId: invite.id,
    payload: { email: payload.email, role: payload.role, expiresAt: expiresAt.toISOString() },
  });

  return res.status(201).json({
    data: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      inviteToken: token,
    },
  });
}

export async function listCompanyInvites(req: Request, res: Response) {
  const companyId = req.user?.companyId;
  if (!companyId) {
    throw new AppError(403, "NO_COMPANY_CONTEXT", "User does not belong to a company");
  }

  const rows = await db
    .select({
      id: companyInvites.id,
      email: companyInvites.email,
      role: companyInvites.role,
      status: companyInvites.status,
      expiresAt: companyInvites.expiresAt,
      acceptedAt: companyInvites.acceptedAt,
      revokedAt: companyInvites.revokedAt,
      createdAt: companyInvites.createdAt,
      invitedByUserId: companyInvites.invitedByUserId,
    })
    .from(companyInvites)
    .where(eq(companyInvites.companyId, companyId))
    .orderBy(desc(companyInvites.createdAt));

  return res.status(200).json({ data: rows });
}

export async function acceptCompanyInvite(req: Request, res: Response) {
  const payload = acceptInviteSchema.parse(req.body);
  const tokenHash = crypto.createHash("sha256").update(payload.token).digest("hex");
  const now = new Date();

  const [invite] = await db
    .select()
    .from(companyInvites)
    .where(
      and(
        eq(companyInvites.tokenHash, tokenHash),
        eq(companyInvites.status, "pending"),
        isNull(companyInvites.revokedAt),
        gt(companyInvites.expiresAt, now),
      ),
    )
    .limit(1);

  if (!invite) {
    throw new AppError(400, "INVALID_INVITE", "Invite token is invalid or expired");
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1);

  if (existingUser) {
    throw new AppError(409, "EMAIL_EXISTS", "A user with this email already exists");
  }

  const [newUser] = await db
    .insert(users)
    .values({
      companyId: invite.companyId,
      role: invite.role,
      fullName: payload.fullName,
      email: invite.email,
      phone: payload.phone,
      passwordHash: hashPassword(payload.password),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db
    .update(companyInvites)
    .set({
      status: "accepted",
      acceptedAt: now,
      updatedAt: now,
    })
    .where(eq(companyInvites.id, invite.id));

  await writeAuditLog({
    companyId: invite.companyId,
    actorUserId: newUser.id,
    action: "company.invite.accepted",
    entityType: "invite",
    entityId: invite.id,
    payload: { userId: newUser.id, email: newUser.email },
  });

  const authPayload = {
    sub: newUser.id,
    companyId: newUser.companyId,
    role: newUser.role,
  } as const;

  const accessToken = signAccessToken(authPayload);
  const refreshToken = signRefreshToken(authPayload);

  await db.insert(refreshTokens).values({
    userId: newUser.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiry(),
  });

  setRefreshCookie(res, refreshToken);

  return res.status(201).json({
    data: {
      accessToken,
      user: {
        id: newUser.id,
        companyId: newUser.companyId,
        role: newUser.role,
        fullName: newUser.fullName,
        email: newUser.email,
      },
    },
  });
}
