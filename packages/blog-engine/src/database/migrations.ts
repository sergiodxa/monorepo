/**
 * Ordered, inlined SQL migrations for the engine's own tables plus a journaled
 * runner. SQL bodies are inlined (no filesystem) so a Durable Object can apply them,
 * and {@link runMigrations} is idempotent so hosts can call it on every cold start.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DatabaseDriver } from "remix/data-table";

import { column as c, Database, table } from "remix/data-table";

/** An ordered, id-tagged schema migration (SQL bodies are inlined). */
interface EngineMigration {
	id: string;
	sql: string;
}

/** First migration: creates every engine table and its indexes/foreign keys. */
const CREATE_TABLES = /* sql */ `
CREATE TABLE posts (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL,
	type TEXT NOT NULL,
	author_id TEXT NOT NULL REFERENCES users (id),
	published_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_posts_type_slug ON posts (type, slug);
CREATE INDEX idx_posts_type_published_at ON posts (type, published_at);
CREATE INDEX idx_posts_author_id ON posts (author_id);

CREATE TABLE post_meta (
	id TEXT PRIMARY KEY,
	post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
	key TEXT NOT NULL,
	value TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_post_meta_post_id_key ON post_meta (post_id, key);

CREATE TABLE post_types (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	path TEXT NOT NULL,
	label TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	fields TEXT NOT NULL,
	builtin INTEGER NOT NULL DEFAULT 0,
	visible INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_post_types_name ON post_types (name);
CREATE UNIQUE INDEX idx_post_types_path ON post_types (path);

CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE roles (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	label TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	permissions TEXT NOT NULL,
	builtin INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_roles_name ON roles (name);

CREATE TABLE users (
	id TEXT PRIMARY KEY,
	subject_id TEXT,
	email TEXT NOT NULL,
	role_id TEXT NOT NULL REFERENCES roles (id),
	username TEXT NOT NULL DEFAULT '',
	display_name TEXT NOT NULL DEFAULT '',
	avatar TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_users_subject_id ON users (subject_id);
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role_id ON users (role_id);

CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	data TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
`;

/** Second migration: seeds the built-in article type, the four roles, and defaults. */
const SEED_DEFAULTS = /* sql */ `
INSERT INTO post_types (id, name, path, label, description, fields, builtin, visible, created_at, updated_at)
VALUES (
	'pt_article', 'article', 'articles', 'Articles', 'Long-form posts.',
	'[{"key":"excerpt","label":"Excerpt","kind":"textarea","required":false},{"key":"content","label":"Content","kind":"markdown","required":true}]',
	1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
);

INSERT INTO roles (id, name, label, description, permissions, builtin, created_at, updated_at) VALUES
	('role_admin', 'admin', 'Administrator', 'Full control over content, users, and settings.',
	 '["posts.create","posts.edit_own","posts.edit_any","posts.delete_own","posts.delete_any","posts.publish","post_types.manage","settings.manage","appearance.manage","users.manage","roles.manage"]',
	 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('role_editor', 'editor', 'Editor', 'Can edit and publish any post, including scheduling.',
	 '["posts.create","posts.edit_own","posts.edit_any","posts.delete_own","posts.delete_any","posts.publish"]',
	 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('role_writer', 'writer', 'Writer', 'Can write and edit own drafts, but not publish.',
	 '["posts.create","posts.edit_own","posts.delete_own"]',
	 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('role_reader', 'reader', 'Reader', 'No capabilities. Default role for new users.',
	 '[]',
	 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT INTO settings (key, value, updated_at) VALUES
	('site_title', '"My Blog"', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('site_description', '""', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('language', '"en"', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('theme', '{}', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('custom_css', '""', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
`;

/**
 * Ordered engine migrations. SQL bodies are inlined so a Durable Object (no
 * filesystem) can apply them. Each host runs them through {@link runMigrations}.
 */
export const MIGRATIONS: EngineMigration[] = [
	{ id: "20260701000000-create_engine_tables", sql: CREATE_TABLES },
	{ id: "20260701000001-seed_defaults", sql: SEED_DEFAULTS },
];

/** Journal of applied migrations, so each runs exactly once per database. */
const journal = table({
	name: "blog_engine_migrations",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		applied_at: c.text(),
	},
});

/**
 * Applies pending migrations against the adapter, tracked in a
 * `blog_engine_migrations` journal table. Idempotent: already-applied ids are
 * skipped, so it is safe to run on every cold start. Multi-statement SQL runs via
 * `executeScript`, which each adapter (D1, SqlStorage, bun:sqlite) handles.
 * @param adapter - The database adapter to migrate.
 * @returns The ids applied in this run.
 */
export async function runMigrations(adapter: DatabaseDriver): Promise<{ applied: string[] }> {
	await adapter.executeScript(
		"CREATE TABLE IF NOT EXISTS blog_engine_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);",
	);

	let db = new Database(adapter);
	let existing = await db.findMany(journal);
	let done = new Set(existing.map((row) => row.id));

	let applied: string[] = [];
	for (let migration of MIGRATIONS) {
		if (done.has(migration.id)) continue;
		await adapter.executeScript(migration.sql);
		await db.create(journal, { id: migration.id, applied_at: new Date().toISOString() });
		applied.push(migration.id);
	}

	return { applied };
}
