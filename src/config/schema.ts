import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "pm",
  "engineer",
  "storekeeper",
  "accountant",
  "subcontractor",
  "platform_admin",
]);

export const subscriptionPlanTierEnum = pgEnum("subscription_plan_tier", [
  "individual",
  "small_company",
  "big_construction_firm",
]);

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "planned",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  rcNumber: varchar("rc_number", { length: 120 }),
  approvalThresholdNgn: numeric("approval_threshold_ngn", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    planTier: subscriptionPlanTierEnum("plan_tier").notNull(),
    billingCycle: billingCycleEnum("billing_cycle").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    remitaCustomerId: text("remita_customer_id"),
    remitaMandateId: text("remita_mandate_id"),
    remitaSubscriptionId: text("remita_subscription_id"),
    remitaRrr: text("remita_rrr"),
    amountNgn: numeric("amount_ngn", { precision: 14, scale: 2 }).notNull(),
    isAutoRenew: boolean("is_auto_renew").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("subscriptions_company_idx").on(table.companyId),
  }),
);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  role: userRoleEnum("role").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 30 }),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("refresh_tokens_user_idx").on(table.userId),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    payload: text("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("audit_logs_company_idx").on(table.companyId),
    actorIdx: index("audit_logs_actor_idx").on(table.actorUserId),
  }),
);

export const companyInvites = pgTable(
  "company_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    status: inviteStatusEnum("status").notNull().default("pending"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("company_invites_company_idx").on(table.companyId),
    emailIdx: index("company_invites_email_idx").on(table.email),
  }),
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    clientName: varchar("client_name", { length: 255 }),
    location: text("location"),
    contractSumNgn: numeric("contract_sum_ngn", { precision: 14, scale: 2 }),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    status: projectStatusEnum("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("projects_company_idx").on(table.companyId),
    statusIdx: index("projects_status_idx").on(table.status),
  }),
);

export const projectSites = pgTable(
  "project_sites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("project_sites_company_idx").on(table.companyId),
    projectIdx: index("project_sites_project_idx").on(table.projectId),
  }),
);