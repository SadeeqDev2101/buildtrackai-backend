import type { userRoleEnum } from "../config/schema";

type UserRole = (typeof userRoleEnum.enumValues)[number];

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        companyId: string | null;
        role: UserRole;
      };
    }
  }
}

export {};
