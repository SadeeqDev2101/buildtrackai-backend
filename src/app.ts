import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./modules/auth/auth.routes";
import { companyRouter } from "./modules/company/company.routes";
import { projectsRouter } from "./modules/projects/projects.routes";

const app = express();

app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "buildtrack-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/company", companyRouter);
app.use("/api/v1/projects", projectsRouter);

app.use(errorHandler);

export { app };
