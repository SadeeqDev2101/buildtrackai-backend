import { db } from "../config/db";
import { auditLogs } from "../config/schema";

type AuditLogInput = {
  companyId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
};

export async function writeAuditLog(input: AuditLogInput) {
  await db.insert(auditLogs).values({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload ? JSON.stringify(input.payload) : null,
  });
}
