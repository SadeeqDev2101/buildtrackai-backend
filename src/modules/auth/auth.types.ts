import type { userRoleEnum } from "../../config/schema";

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export type AccessTokenPayload = {
  sub: string;
  companyId: string | null;
  role: UserRole;
};
