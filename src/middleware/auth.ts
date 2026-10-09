import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error";
import { verifyAccessToken } from "../modules/auth/auth.utils";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AppError(401, "UNAUTHENTICATED", "Missing bearer access token"),
    );
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      companyId: payload.companyId,
      role: payload.role,
    };
    return next();
  } catch {
    return next(new AppError(401, "UNAUTHENTICATED", "Invalid access token"));
  }
}
