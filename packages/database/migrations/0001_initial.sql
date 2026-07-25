CREATE SCHEMA IF NOT EXISTS loomoon;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS loomoon.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES loomoon.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES loomoon.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'empty',
  cover_asset_id uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_owner_updated_idx ON loomoon.projects(owner_id, updated_at);

CREATE TABLE IF NOT EXISTS loomoon.canvas_documents (
  project_id uuid PRIMARY KEY REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  schema_version integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.canvas_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES loomoon.users(id),
  base_version integer NOT NULL,
  result_version integer NOT NULL,
  idempotency_key text NOT NULL,
  operation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS loomoon.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES loomoon.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES loomoon.agent_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  selection_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES loomoon.agent_sessions(id) ON DELETE CASCADE,
  message_id uuid REFERENCES loomoon.agent_messages(id),
  status text NOT NULL,
  resolved_model text,
  provider_request_id text,
  decision_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES loomoon.agent_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES loomoon.users(id),
  project_id uuid NOT NULL REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  input_hash text NOT NULL,
  target_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.confirmation_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES loomoon.agent_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES loomoon.users(id),
  project_id uuid NOT NULL REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  input_hash text NOT NULL,
  max_task_count integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.generation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  run_id uuid REFERENCES loomoon.agent_runs(id),
  confirmation_grant_id uuid REFERENCES loomoon.confirmation_grants(id),
  status text NOT NULL,
  requested_count integer NOT NULL,
  completed_count integer NOT NULL DEFAULT 0,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.generation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES loomoon.generation_batches(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  prompt text NOT NULL,
  input jsonb NOT NULL,
  resolved_model text,
  provider_job_id text,
  provider_request_id text,
  error_code text,
  attempt integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS loomoon.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES loomoon.users(id),
  project_id uuid NOT NULL REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  sha256 text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL,
  width integer,
  height integer,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loomoon.asset_relations (
  from_asset_id uuid NOT NULL REFERENCES loomoon.assets(id) ON DELETE CASCADE,
  to_asset_id uuid NOT NULL REFERENCES loomoon.assets(id) ON DELETE CASCADE,
  relation text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(from_asset_id, to_asset_id, relation)
);

CREATE TABLE IF NOT EXISTS loomoon.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES loomoon.projects(id) ON DELETE CASCADE,
  topic text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_unpublished_idx ON loomoon.outbox_events(published_at, created_at);
