-- Roles and permissions (see roles.ts): the tenant-defined vocabulary that sits above
-- the three system roles the platform itself reserves at every scope. The three system
-- keys never get a row here — their meaning is fixed in code, so nothing about them
-- needs storing, and they answer for a scope from the moment it exists.
CREATE TABLE roles (
	id TEXT PRIMARY KEY,
	scope TEXT NOT NULL,
	key TEXT NOT NULL,
	name TEXT NOT NULL,
	description TEXT NOT NULL,
	system INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX roles_by_scope_key ON roles (scope, key);

-- A tenant's own declared vocabulary for what a role may grant. `auth:`-prefixed keys
-- are reserved for the platform's own management-API permissions and are refused here.
CREATE TABLE permissions (
	key TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

-- What a role grants: an explicit set, resolved by one indexed read against `role_id`.
CREATE TABLE role_permissions (
	role_id TEXT NOT NULL,
	permission_key TEXT NOT NULL,
	PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX role_permissions_by_permission ON role_permissions (permission_key);

-- One role held by one subject at the tenant's own directory scope — the tenant-wide
-- scope, always the literal `tenant`. An organization-scope assignment lives on
-- `organization_members.role` instead, since a membership and its role share one
-- lifecycle; this table only ever holds the tenant scope, which is why its primary key
-- is `(subject_id, scope)` rather than `(subject_id, organization_id)`.
CREATE TABLE role_assignments (
	subject_id TEXT NOT NULL,
	role_id TEXT NOT NULL,
	scope TEXT NOT NULL,
	assigned_by TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (subject_id, scope)
);
