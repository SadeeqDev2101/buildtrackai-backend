import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/app-error";

type DbError = Error & { code?: string };

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: error.flatten(),
      },
    });
  }

  const dbError = error as DbError;
  if (dbError?.code === "23505") {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A unique field already exists",
      },
    });
  }

  console.error("Unhandled error:", error);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    },
  });
}
