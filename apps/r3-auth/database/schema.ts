/**
 * Database schema for the authorization server, declared with remix/data-table:
 * subjects and their password/social credentials, refresh-token sessions, registered
 * OAuth clients, and consent grants. It mirrors the live D1 database exactly — the
 * files in `database/migrations/` are the physical truth and this module only
 * describes them — so column names stay snake_case and every timestamp is
 * `c.integer()` holding epoch milliseconds, which is what the existing rows store.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, TableRow } from "remix/data-table";

import { belongsTo, column as c, table } from "remix/data-table";

/** Payload accepted when creating or updating a row, with DB-defaulted columns optional. */
type InsertRow<sourceTable extends AnyTable> = Partial<TableRow<sourceTable>>;

/** People who can sign in. `role` gates the admin area; `username` and `email_address` are unique. */
export const subjects = table({
	name: "subjects",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		email_verified_at: c.integer().nullable(),
		display_name: c.text(),
		avatar: c.text(),
		role: c.enum(["user", "admin"]).default("user"),
		username: c.text(),
		email_address: c.text(),
	},
});

export type SelectSubject = TableRow<typeof subjects>;
export type InsertSubject = InsertRow<typeof subjects>;

/**
 * A subject's password credential. `password_hash` holds a bcrypt hash, and
 * `subject_id` is unique: a subject has at most one password.
 */
export const credentials = table({
	name: "credentials",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		verified_at: c.integer().nullable(),
		subject_id: c.text(),
		password_hash: c.text(),
	},
});

export type SelectCredential = TableRow<typeof credentials>;
export type InsertCredential = InsertRow<typeof credentials>;

/**
 * A social identity linked to a subject. The (`provider`, `external_id`) pair is
 * unique, which is what makes a returning provider login resolve to one subject.
 */
export const connections = table({
	name: "connections",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		subject_id: c.text(),
		external_id: c.text(),
		provider: c.text(),
	},
});

export type SelectConnection = TableRow<typeof connections>;
export type InsertConnection = InsertRow<typeof connections>;

/**
 * A subject's live session with one client. **`id` is the refresh token value** that
 * clients send to the token endpoint, so it must never be logged, listed, or
 * regenerated casually. `expires_at` carries no database default: every insert
 * computes it.
 */
export const sessions = table({
	name: "sessions",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		expires_at: c.integer(),
		subject_id: c.text(),
		client_id: c.text(),
		user_agent: c.text().nullable(),
		ip_address: c.text().nullable(),
	},
});

export type SelectSession = TableRow<typeof sessions>;
export type InsertSession = InsertRow<typeof sessions>;

/**
 * A registered relying party. `secret` is stored in plaintext because it is the only
 * copy each client holds, and `redirect_uri` is unique — exactly one per client, and
 * an authorization request must match it exactly.
 *
 * The two `*_session_required` columns are text holding `"true"`/`"false"` rather than
 * booleans, matching the physical schema.
 */
export const clients = table({
	name: "clients",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		name: c.text(),
		description: c.text().nullable(),
		logo_url: c.text().nullable(),
		secret: c.text(),
		redirect_uri: c.text(),
		logout_uri: c.text(),
		backchannel_logout_uri: c.text().nullable(),
		backchannel_logout_session_required: c.enum(["true", "false"]).default("false"),
		frontchannel_logout_uri: c.text().nullable(),
		frontchannel_logout_session_required: c.enum(["true", "false"]).default("false"),
	},
});

export type SelectClient = TableRow<typeof clients>;
export type InsertClient = InsertRow<typeof clients>;

/**
 * A subject's standing consent for one client. Unique on (`subject_id`, `client_id`),
 * so consent is recorded once and re-authorization is silent afterwards.
 */
export const grants = table({
	name: "grants",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		subject_id: c.text(),
		client_id: c.text(),
	},
});

export type SelectGrant = TableRow<typeof grants>;
export type InsertGrant = InsertRow<typeof grants>;

/** The client a session belongs to, so a device list can name the app it signed into. */
export const sessionClient = belongsTo(sessions, clients, { foreignKey: "client_id" });

/** The client a grant was given to, so a consent list can name and picture the app. */
export const grantClient = belongsTo(grants, clients, { foreignKey: "client_id" });
