import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const loomoon = pgSchema("loomoon");
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const users = loomoon.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  ...timestamps
}, (table) => [uniqueIndex("users_email_uidx").on(table.email)]);

export const refreshTokens = loomoon.table("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const projects = loomoon.table("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").default("empty").notNull(),
  coverAssetId: uuid("cover_asset_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps
}, (table) => [index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt)]);

export const canvasDocuments = loomoon.table("canvas_documents", {
  projectId: uuid("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").default(1).notNull(),
  schemaVersion: integer("schema_version").default(1).notNull(),
  snapshot: jsonb("snapshot").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const canvasOperations = loomoon.table("canvas_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id),
  baseVersion: integer("base_version").notNull(),
  resultVersion: integer("result_version").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  operation: jsonb("operation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("canvas_operations_project_idempotency_uidx").on(table.projectId, table.idempotencyKey),
  index("canvas_operations_project_version_idx").on(table.projectId, table.resultVersion)
]);

export const agentSessions = loomoon.table("agent_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  ...timestamps
});

export const agentMessages = loomoon.table("agent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => agentSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  selectionSnapshot: jsonb("selection_snapshot").default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const agentRuns = loomoon.table("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => agentSessions.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => agentMessages.id),
  status: text("status").notNull(),
  resolvedModel: text("resolved_model"),
  providerRequestId: text("provider_request_id"),
  decisionSummary: text("decision_summary"),
  ...timestamps
});

export const toolCalls = loomoon.table("tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  inputHash: text("input_hash").notNull(),
  targetIds: jsonb("target_ids").default([]).notNull(),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  ...timestamps
});

export const confirmationGrants = loomoon.table("confirmation_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  inputHash: text("input_hash").notNull(),
  maxTaskCount: integer("max_task_count").notNull(),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const generationBatches = loomoon.table("generation_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  runId: uuid("run_id").references(() => agentRuns.id),
  confirmationGrantId: uuid("confirmation_grant_id").references(() => confirmationGrants.id),
  status: text("status").notNull(),
  requestedCount: integer("requested_count").notNull(),
  completedCount: integer("completed_count").default(0).notNull(),
  cancelled: boolean("cancelled").default(false).notNull(),
  ...timestamps
});

export const generationTasks = loomoon.table("generation_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => generationBatches.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  prompt: text("prompt").notNull(),
  input: jsonb("input").notNull(),
  resolvedModel: text("resolved_model"),
  providerJobId: text("provider_job_id"),
  providerRequestId: text("provider_request_id"),
  errorCode: text("error_code"),
  attempt: integer("attempt").default(1).notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex("generation_tasks_project_idempotency_uidx").on(table.projectId, table.idempotencyKey),
  index("generation_tasks_batch_status_idx").on(table.batchId, table.status)
]);

export const assets = loomoon.table("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  sha256: text("sha256").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("assets_object_key_uidx").on(table.objectKey),
  index("assets_project_created_idx").on(table.projectId, table.createdAt)
]);

export const assetRelations = loomoon.table("asset_relations", {
  fromAssetId: uuid("from_asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  toAssetId: uuid("to_asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [primaryKey({ columns: [table.fromAssetId, table.toAssetId, table.relation] })]);

export const outboxEvents = loomoon.table("outbox_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  attempts: integer("attempts").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [index("outbox_unpublished_idx").on(table.publishedAt, table.createdAt)]);
