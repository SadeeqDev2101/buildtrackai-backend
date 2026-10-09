import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import type { AccessTokenPayload } from "./auth.types";

export function signAccessToken(payload: AccessTokenPayload): string {
  const expiresIn = env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"];
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn,
  });
}

export function signRefreshToken(payload: AccessTokenPayload): string {
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"];
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AccessTokenPayload;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshTokenExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  return expiresAt;
}
