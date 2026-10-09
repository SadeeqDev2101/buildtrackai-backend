import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error";

export function requireCompanyContext(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next(new AppError(401, "UNAUTHENTICATED", "Authentication required"));
  }

  if (!req.user.companyId) {
    return next(
      new AppError(403, "NO_COMPANY_CONTEXT", "User does not belong to a company"),
    );
  }

  return next();
}
