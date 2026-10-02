-- Initial identity/audit foundation only. Module schemas follow after shared review.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE staff_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    login_identifier text NOT NULL UNIQUE CHECK (length(btrim(login_identifier)) > 0),
    password_hash text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    code text PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE staff_roles (
    staff_id uuid NOT NULL REFERENCES staff_accounts(id),
    role_code text NOT NULL REFERENCES roles(code),
    PRIMARY KEY (staff_id, role_code)
);

CREATE TABLE staff_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES staff_accounts(id),
    token_hash bytea NOT NULL UNIQUE,
    csrf_token_hash bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (expires_at > created_at)
);
CREATE INDEX staff_sessions_staff_idx ON staff_sessions(staff_id);

CREATE TABLE audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id uuid NOT NULL REFERENCES staff_accounts(id),
    action text NOT NULL,
    object_type text NOT NULL,
    object_id text NOT NULL,
    reason text,
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_object_idx ON audit_events(object_type, object_id, occurred_at);
