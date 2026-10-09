import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error";
import type { UserRole } from "../modules/auth/auth.types";

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "UNAUTHENTICATED", "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "Role is not allowed for this action"));
    }

    return next();
  };
}
