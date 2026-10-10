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
import { beforeEach, describe, expect, test } from "vitest";

import type { AuthModels } from "~/app/models";

import { createTestModels } from "~/app/lib/test/models";
import { SESSION_TTL } from "~/app/models/sessions";
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
	test("resolves a presented refresh token to its session", async () => {
		let session = await openSession();
		expect((await models.sessions.find(session.id))?.subject_id).toBe(subjectId);
	});

	test("returns null for a revoked or invented token", async () => {
		expect(await models.sessions.find("not-a-session")).toBeNull();
	});
});

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
