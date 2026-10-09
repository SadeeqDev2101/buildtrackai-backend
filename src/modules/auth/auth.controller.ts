import type { Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../config/db";
import {
  companies,
  refreshTokens,
  subscriptions,
  users,
} from "../../config/schema";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";
import {
  getRefreshTokenExpiry,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./auth.utils";
import { loginSchema, registerSchema } from "./auth.schemas";
import { hashPassword, verifyPassword } from "./password";

const PLAN_PRICING: Record<
  "individual" | "small_company" | "big_construction_firm",
  { monthly: string; annual: string }
> = {
  individual: { monthly: "5000.00", annual: "50000.00" },
  small_company: { monthly: "35000.00", annual: "350000.00" },
  big_construction_firm: { monthly: "120000.00", annual: "1200000.00" },
};

function calculateSubscriptionDates(billingCycle: "monthly" | "annual") {
  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  if (billingCycle === "monthly") {
    endsAt.setMonth(endsAt.getMonth() + 1);
  } else {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  }
  return { startsAt, endsAt };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/api/v1/auth",
  });
}

export async function register(req: Request, res: Response) {
  const body = registerSchema.parse(req.body);

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existingUser.length > 0) {
    throw new AppError(409, "EMAIL_EXISTS", "Email is already registered");
  }

  const now = new Date();
  const { startsAt, endsAt } = calculateSubscriptionDates(body.billingCycle);
  const amountNgn = PLAN_PRICING[body.planTier][body.billingCycle];
  const passwordHash = hashPassword(body.password);

  const [company] = await db
    .insert(companies)
    .values({
      name: body.companyName,
      rcNumber: body.rcNumber,
      approvalThresholdNgn: "1000000.00",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      companyId: company.id,
      role: "owner",
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      passwordHash,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      companyId: company.id,
      planTier: body.planTier,
      billingCycle: body.billingCycle,
      status: "trialing",
      startsAt,
      endsAt,
      amountNgn,
      isAutoRenew: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const payload = {
    sub: user.id,
    companyId: user.companyId,
    role: user.role,
  } as const;

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const refreshTokenHash = hashRefreshToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: getRefreshTokenExpiry(),
  });

  setRefreshCookie(res, refreshToken);

  return res.status(201).json({
    data: {
      accessToken,
      user: {
        id: user.id,
        companyId: user.companyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
      subscription: {
        id: subscription.id,
        planTier: subscription.planTier,
        billingCycle: subscription.billingCycle,
        status: subscription.status,
        amountNgn: subscription.amountNgn,
      },
    },
  });
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (!user.isActive) {
    throw new AppError(403, "USER_DISABLED", "User account is disabled");
  }

  const payload = {
    sub: user.id,
    companyId: user.companyId,
    role: user.role,
  } as const;

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const refreshTokenHash = hashRefreshToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: getRefreshTokenExpiry(),
  });

  setRefreshCookie(res, refreshToken);

  return res.status(200).json({
    data: {
      accessToken,
      user: {
        id: user.id,
        companyId: user.companyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
    },
  });
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken as string | undefined;
  if (!refreshToken) {
    throw new AppError(401, "UNAUTHENTICATED", "Missing refresh token");
  }

  let payload: { sub: string; companyId: string | null; role: typeof users.$inferSelect.role };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Invalid refresh token");
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const [storedToken] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!storedToken) {
    throw new AppError(401, "UNAUTHENTICATED", "Refresh token is revoked");
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, storedToken.id));

  const newPayload = {
    sub: payload.sub,
    companyId: payload.companyId,
    role: payload.role,
  } as const;

  const newAccessToken = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken(newPayload);

  await db.insert(refreshTokens).values({
    userId: payload.sub,
    tokenHash: hashRefreshToken(newRefreshToken),
    expiresAt: getRefreshTokenExpiry(),
  });

  setRefreshCookie(res, newRefreshToken);

  return res.status(200).json({
    data: {
      accessToken: newAccessToken,
    },
  });
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken as string | undefined;
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  res.clearCookie("refreshToken", { path: "/api/v1/auth" });
  return res.status(200).json({ data: { message: "Logged out successfully" } });
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Missing authentication");
  }

  const [user] = await db
    .select({
      id: users.id,
      companyId: users.companyId,
      role: users.role,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, req.user.userId))
    .limit(1);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  return res.status(200).json({ data: user });
}
