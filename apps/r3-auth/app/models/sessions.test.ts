/**
 * Tests for the sessions model: opening a session with its 30-day expiry, listing a
 * subject's sessions with the client each belongs to, touching, revocation by
 * id/subject/subject+client, the expiry sweep, and the active count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { isFailure, unwrap } from "@sdxc/result";
import { isUUID } from "@sdxc/uuid";
import { generateUUID } from "@sdxc/uuid/v4";
import { beforeEach, describe, expect, test } from "vitest";

import type { AuthModels } from "~/app/models";

import { hashRefreshToken, SESSION_TTL } from "~/app/models/sessions";
import { applyMigrations, createTestDatabase } from "~/app/test/db";
import { bindModels, createTestModels } from "~/app/test/models";
import { sessions } from "~/database/schema";

let db: Database;
let models: AuthModels;
let subjectId: string;
let clientId: string;

beforeEach(async () => {
	({ db, models } = createTestModels());

	let subject = unwrap(
		await models.subjects.create({
			email_address: "jane@example.com",
			display_name: "Jane Doe",
			username: "jane",
			avatar: "https://example.com/jane.png",
		}),
	);
	subjectId = subject.id;

	let client = unwrap(
		await models.clients.create({
			name: "Blog",
			redirect_uri: "https://blog.example.com/auth/callback",
			logout_uri: "https://blog.example.com/logout",
		}),
	);
	clientId = client.id;
});

/** Opens a session for the test subject, on the test client unless another is named. */
async function openSession(
	device: { ip?: string | null; ua?: string | null; client?: string } = {},
) {
	return unwrap(
		await models.sessions.create({
			subject_id: subjectId,
			client_id: device.client ?? clientId,
			ip_address: device.ip ?? null,
			user_agent: device.ua ?? null,
		}),
	);
}

describe("sessions.create", () => {
	test("stamps an expiry 30 days out, since the column has no database default", async () => {
		let before = Date.now();
		let session = await openSession({ ip: "203.0.113.1", ua: "Firefox" });

		expect(session.expires_at).toBeGreaterThanOrEqual(before + SESSION_TTL);
		expect(session.expires_at).toBeLessThanOrEqual(Date.now() + SESSION_TTL);
	});

	test("records the device details and gives the session a unique id", async () => {
		let first = await openSession({ ip: "203.0.113.1", ua: "Firefox" });
		let second = await openSession();

		expect(first.ip_address).toBe("203.0.113.1");
		expect(first.user_agent).toBe("Firefox");
		expect(second.ip_address).toBeNull();
		expect(second.user_agent).toBeNull();
		expect(first.id).not.toBe(second.id);
	});

	test("starts with the openid scope unless the caller names a broader one", async () => {
		expect((await openSession()).scope).toBe("openid");
	});
});

describe("sessions.find", () => {
	test("resolves a session by its public id", async () => {
		let session = await openSession();
		expect((await models.sessions.find(session.id))?.subject_id).toBe(subjectId);
	});

	/** The id is what relying parties see as `sid`, so it is a UUID and never a secret. */
	test("gives the session a UUID as its public id", async () => {
		let session = await openSession();

		expect(isUUID(session.id)).toBe(true);
		expect(session.refresh_token_hash).toBeNull();
	});

	test("returns null for an invented id", async () => {
		expect(await models.sessions.find("not-a-session")).toBeNull();
	});
});

describe("sessions.issueRefreshToken", () => {
	test("mints a random token apart from the session's public id", async () => {
		let session = await openSession();
		let token = await models.sessions.issueRefreshToken(session.id);

		expect(token).toMatch(/^[\w-]{43}$/);
		expect(token).not.toBe(session.id);
	});

	/** A database read must yield nothing a client could present at the token endpoint. */
	test("stores only the token's SHA-256 hash", async () => {
		let session = await openSession();
		let token = unwrapToken(await models.sessions.issueRefreshToken(session.id));
		let row = await models.sessions.find(session.id);

		expect(row?.refresh_token_hash).toBe(await hashRefreshToken(token));
		expect(Object.values(row ?? {})).not.toContain(token);
	});

	test("returns null when the session no longer exists", async () => {
		expect(await models.sessions.issueRefreshToken(generateUUID())).toBeNull();
	});

	test("replaces an earlier token, which stops resolving", async () => {
		let session = await openSession();
		let first = unwrapToken(await models.sessions.issueRefreshToken(session.id));
		let second = unwrapToken(await models.sessions.issueRefreshToken(session.id));

		expect(await models.sessions.findByRefreshToken(first)).toBeNull();
		expect((await models.sessions.findByRefreshToken(second))?.id).toBe(session.id);
	});
});

describe("sessions.findByRefreshToken", () => {
	test("resolves an issued refresh token to its session", async () => {
		let session = await openSession();
		let token = unwrapToken(await models.sessions.issueRefreshToken(session.id));

		expect((await models.sessions.findByRefreshToken(token))?.id).toBe(session.id);
	});

	/** Knowing a session's `sid` must never be enough to refresh it. */
	test("refuses the public id as a refresh token", async () => {
		let session = await openSession();
		await models.sessions.issueRefreshToken(session.id);

		expect(await models.sessions.findByRefreshToken(session.id)).toBeNull();
	});

	test("returns null for an invented token", async () => {
		expect(await models.sessions.findByRefreshToken("not-a-token")).toBeNull();
	});
});

describe("sessions.deleteByRefreshToken", () => {
	test("revokes the session the token belongs to", async () => {
		let session = await openSession();
		let token = unwrapToken(await models.sessions.issueRefreshToken(session.id));

		expect(await models.sessions.deleteByRefreshToken(token)).toBe(1);
		expect(await models.sessions.find(session.id)).toBeNull();
	});

	test("leaves the session alone when given its public id", async () => {
		let session = await openSession();
		await models.sessions.issueRefreshToken(session.id);

		expect(await models.sessions.deleteByRefreshToken(session.id)).toBe(0);
		expect(await models.sessions.find(session.id)).not.toBeNull();
	});
});

/** The migration under test; the database is built up to just before it, then it runs. */
const MIGRATION = "20261012000000_session_public_id.sql";

/**
 * The migration that split the public id from the refresh token. Every id it finds was a
 * refresh token, and possibly a leaked one, so the migration ends every session.
 */
describe("session public id migration", () => {
	test("deletes every session, so no pre-migration id refreshes again", async () => {
		let { db, sqliteDb } = createTestDatabase((file) => file < MIGRATION);
		let oldModels = bindModels(db);
		unwrap(
			await oldModels.clients.create({
				id: clientId,
				name: "Blog",
				redirect_uri: "https://blog.example.com/auth/callback",
				logout_uri: "https://blog.example.com/logout",
			}),
		);
		unwrap(
			await oldModels.subjects.create({
				id: subjectId,
				email_address: "jane@example.com",
				display_name: "Jane Doe",
				username: "jane",
				avatar: "https://example.com/jane.png",
			}),
		);

		let now = Date.now();
		sqliteDb
			.prepare(
				"INSERT INTO sessions (id, created_at, updated_at, expires_at, subject_id, client_id, scope) VALUES (?, ?, ?, ?, ?, ?, ?)",
			)
			.run("old-token", now, now, now + SESSION_TTL, subjectId, clientId, "openid offline_access");

		applyMigrations(sqliteDb, (file) => file >= MIGRATION);

		expect(await oldModels.sessions.findBySubjectId(subjectId)).toEqual([]);
		expect(await oldModels.sessions.findByRefreshToken("old-token")).toBeNull();
	});
});

/** Narrows an issued token, failing the test when the session it was issued on is gone. */
function unwrapToken(token: string | null): string {
	if (token === null) throw new Error("The session vanished before its token was issued");
	return token;
}

describe("sessions.findBySubjectId", () => {
	test("loads each session with the client it was issued to, most recent first", async () => {
		let older = await openSession();
		let newer = await openSession();

		await db.update(sessions, older.id, { updated_at: 1_000 });
		await db.update(sessions, newer.id, { updated_at: 2_000 });

		let list = await models.sessions.findBySubjectId(subjectId);

		expect(list.map((session) => session.id)).toEqual([newer.id, older.id]);
		expect(list[0]?.client?.name).toBe("Blog");
	});
});

describe("sessions.touch", () => {
	test("moves the session's updated_at forward without changing anything else", async () => {
		let session = await openSession();
		await db.update(sessions, session.id, { updated_at: 1_000 }, { touch: false });

		let touched = unwrap(await models.sessions.touch(session.id));

		expect(touched.updated_at).toBeGreaterThan(1_000);
		expect(touched.expires_at).toBe(session.expires_at);
	});

	test("answers a failure for a revoked session", async () => {
		expect(isFailure(await models.sessions.touch("not-a-session"))).toBe(true);
	});
});

describe("session revocation", () => {
	test("delete revokes exactly one session", async () => {
		let first = await openSession();
		let second = await openSession();

		unwrap(await models.sessions.delete(first.id));
		expect(await models.sessions.find(first.id)).toBeNull();
		expect(await models.sessions.find(second.id)).not.toBeNull();
	});

	test("deleteBySubjectAndId revokes the session only for the subject it belongs to", async () => {
		let other = unwrap(
			await models.subjects.create({
				email_address: "john@example.com",
				display_name: "John Doe",
				username: "john",
				avatar: "https://example.com/john.png",
			}),
		);
		let session = await openSession();

		expect(await models.sessions.deleteBySubjectAndId(other.id, session.id)).toBe(0);
		expect(await models.sessions.find(session.id)).not.toBeNull();

		expect(await models.sessions.deleteBySubjectAndId(subjectId, session.id)).toBe(1);
		expect(await models.sessions.find(session.id)).toBeNull();
	});

	test("deleteBySubjectId revokes every session the subject has", async () => {
		await openSession();
		await openSession();

		expect(await models.sessions.deleteBySubjectId(subjectId)).toBe(2);
		expect(await models.sessions.findBySubjectId(subjectId)).toHaveLength(0);
	});

	test("deleteBySubjectAndClient leaves the subject's other clients signed in", async () => {
		let other = unwrap(
			await models.clients.create({
				name: "Uptime",
				redirect_uri: "https://uptime.example.com/auth/callback",
				logout_uri: "https://uptime.example.com/logout",
			}),
		);

		await openSession();
		let kept = await openSession({ client: other.id });

		expect(await models.sessions.deleteBySubjectAndClient(subjectId, clientId)).toBe(1);

		let remaining = await models.sessions.findBySubjectId(subjectId);
		expect(remaining.map((session) => session.id)).toEqual([kept.id]);
	});
});

describe("session expiry", () => {
	test("expired() reads only sessions whose expiry has passed", async () => {
		let expired = await openSession();
		let live = await openSession();
		await db.update(sessions, expired.id, { expires_at: Date.now() - 1 });

		let found = await models.sessions.expired().all();

		expect(found.map((session) => session.id)).toEqual([expired.id]);
		expect(found.map((session) => session.id)).not.toContain(live.id);
	});

	test("deleteExpired removes them and reports how many", async () => {
		let expired = await openSession();
		await openSession();
		await db.update(sessions, expired.id, { expires_at: Date.now() - 1 });

		expect(await models.sessions.deleteExpired()).toBe(1);
		expect(await models.sessions.expired().all()).toHaveLength(0);
		expect(await models.sessions.findBySubjectId(subjectId)).toHaveLength(1);
	});

	test("deleteExpired is a no-op when nothing has expired", async () => {
		await openSession();
		expect(await models.sessions.deleteExpired()).toBe(0);
	});

	test("active() counts only sessions that have not expired", async () => {
		let expired = await openSession();
		await openSession();
		await db.update(sessions, expired.id, { expires_at: Date.now() - 1 });

		expect(await models.sessions.active().count()).toBe(1);
	});
});
