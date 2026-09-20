/**
 * Drives the tenant Durable Object's subject RPC methods the way `tenant-do.test.ts`
 * drives `provision`/`erase`: by construction, against a real SQLite database, through
 * `@sdxc/cloudflare-mocks`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test } from "vitest";

import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

let subjectActor = { kind: "subject" } as const;
let adminActor = { kind: "admin" } as const;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

describe("createSubject", () => {
	test("claims identifiers, folds them, and starts them unverified", async () => {
		let result = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "Jane@Example.com" }],
		});

		expect(result).toEqual({
			ok: true,
			subjectId: expect.stringMatching(/^sub_/),
			identifiers: [
				{
					kind: "email",
					value: "Jane@Example.com",
					verified: false,
					verifiedAt: null,
					isPrimary: false,
				},
			],
		});
	});

	test("refuses a second subject claiming the same folded email", async () => {
		await tenant.createSubject({ identifiers: [{ kind: "email", value: "jane@example.com" }] });

		let result = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "JANE@EXAMPLE.COM" }],
		});

		expect(result).toEqual({
			ok: false,
			reason: "identifier-taken",
			kind: "email",
			value: "JANE@EXAMPLE.COM",
		});
	});

	test("refuses two usernames in the same call", async () => {
		let result = await tenant.createSubject({
			identifiers: [
				{ kind: "username", value: "jane" },
				{ kind: "username", value: "janedoe" },
			],
		});

		expect(result).toEqual({ ok: false, reason: "duplicate-username" });
	});

	test("refuses an identifier that fails its folding rule", async () => {
		let result = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane doe" }],
		});

		expect(result).toEqual({
			ok: false,
			reason: "invalid-identifier",
			kind: "username",
			value: "jane doe",
		});
	});

	test("refuses an attribute with no declared definition", async () => {
		let result = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
			attributes: { plan: "pro" },
		});

		expect(result).toEqual({ ok: false, reason: "unknown-attribute", key: "plan" });
	});

	test("applies a declared attribute", async () => {
		await tenant.defineAttribute({ key: "plan", type: "string", visibility: "claim" });

		let result = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
			attributes: { plan: "pro" },
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");

		let described = await tenant.describeSubject({
			subjectId: result.subjectId,
			audience: adminActor,
		});
		expect(described).toMatchObject({ ok: true, attributes: { plan: "pro" } });
	});
});

describe("addIdentifier / verifyIdentifier lifecycle", () => {
	async function createBareSubject() {
		let result = await tenant.createSubject({ identifiers: [{ kind: "username", value: "jane" }] });
		if (!result.ok) throw new Error("unreachable");
		return result.subjectId;
	}

	test("mints a ticket for a new email and verifying it promotes primary", async () => {
		let subjectId = await createBareSubject();

		let added = await tenant.addIdentifier({
			subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});

		expect(added).toMatchObject({ ok: true, kind: "email", value: "jane@example.com" });
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");

		let verified = await tenant.verifyIdentifier({ ticket: added.ticket });
		expect(verified).toEqual({ ok: true, subjectId, promotedPrimary: true });

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({
			ok: true,
			identifiers: expect.arrayContaining([
				expect.objectContaining({ kind: "email", verified: true, isPrimary: true }),
			]),
		});
	});

	test("a username never receives a ticket", async () => {
		let subjectId = await createBareSubject();

		let added = await tenant.addIdentifier({
			subjectId,
			kind: "username",
			value: "otherjane",
			actor: subjectActor,
		});

		expect(added).toEqual({ ok: false, reason: "username-already-set" });
	});

	test("refuses claiming an email another subject already verified", async () => {
		let first = await createBareSubject();
		let addedToFirst = await tenant.addIdentifier({
			subjectId: first,
			kind: "email",
			value: "shared@example.com",
			actor: subjectActor,
		});
		if (!addedToFirst.ok || addedToFirst.kind !== "email") throw new Error("unreachable");
		await tenant.verifyIdentifier({ ticket: addedToFirst.ticket });

		let second = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "other" }],
		});
		if (!second.ok) throw new Error("unreachable");

		let addedToSecond = await tenant.addIdentifier({
			subjectId: second.subjectId,
			kind: "email",
			value: "shared@example.com",
			actor: subjectActor,
		});

		expect(addedToSecond).toEqual({ ok: false, reason: "identifier-taken" });
	});

	test("calling addIdentifier again for the same unverified row replaces its ticket", async () => {
		let subjectId = await createBareSubject();

		let first = await tenant.addIdentifier({
			subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});
		if (!first.ok || first.kind !== "email") throw new Error("unreachable");

		let second = await tenant.addIdentifier({
			subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});
		if (!second.ok || second.kind !== "email") throw new Error("unreachable");

		expect(second.identifierId).toBe(first.identifierId);
		expect(second.ticket).not.toBe(first.ticket);

		let staleTicketResult = await tenant.verifyIdentifier({ ticket: first.ticket });
		expect(staleTicketResult).toEqual({ ok: false, reason: "invalid-ticket" });

		let freshTicketResult = await tenant.verifyIdentifier({ ticket: second.ticket });
		expect(freshTicketResult).toEqual({ ok: true, subjectId, promotedPrimary: true });
	});

	test("an expired ticket is refused", async () => {
		let subjectId = await createBareSubject();

		let added = await tenant.addIdentifier({
			subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");

		state.storage.sql.exec(
			`UPDATE subject_identifiers SET verification_ticket_expires_at = ? WHERE id = ?`,
			Date.now() - 1000,
			added.identifierId,
		);

		let result = await tenant.verifyIdentifier({ ticket: added.ticket });
		expect(result).toEqual({ ok: false, reason: "expired-ticket" });
	});
});

describe("setPrimaryIdentifier", () => {
	test("refuses an unverified address", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "second@example.com",
			actor: subjectActor,
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");

		let result = await tenant.setPrimaryIdentifier({
			subjectId: created.subjectId,
			value: "second@example.com",
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: false, reason: "unverified" });
	});

	test("moves primary to a verified address", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "second@example.com",
			actor: subjectActor,
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let result = await tenant.setPrimaryIdentifier({
			subjectId: created.subjectId,
			value: "second@example.com",
			actor: subjectActor,
		});
		expect(result).toEqual({ ok: true });

		let described = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: adminActor,
		});
		if (!described.ok) throw new Error("unreachable");

		let primary = described.identifiers.filter((identifier) => identifier.isPrimary);
		expect(primary).toEqual([
			{
				kind: "email",
				value: "second@example.com",
				verified: true,
				verifiedAt: expect.any(Number),
				isPrimary: true,
			},
		]);
	});
});

describe("removeIdentifier", () => {
	test("refuses removing the last verified email address", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});

		// The identifier already exists unverified from createSubject; verify it first.
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let result = await tenant.removeIdentifier({
			subjectId: created.subjectId,
			value: "jane@example.com",
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: false, reason: "last-verified-identifier" });
	});

	test("promotes the oldest remaining verified address and reports who to notify", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "first@example.com" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let firstAdd = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "first@example.com",
			actor: subjectActor,
		});
		if (!firstAdd.ok || firstAdd.kind !== "email") throw new Error("unreachable");
		await tenant.verifyIdentifier({ ticket: firstAdd.ticket });

		let secondAdd = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "second@example.com",
			actor: subjectActor,
		});
		if (!secondAdd.ok || secondAdd.kind !== "email") throw new Error("unreachable");
		await tenant.verifyIdentifier({ ticket: secondAdd.ticket });

		// "first" verified first, so it is primary; removing it promotes "second".
		let result = await tenant.removeIdentifier({
			subjectId: created.subjectId,
			value: "first@example.com",
			actor: subjectActor,
		});

		expect(result).toEqual({
			ok: true,
			promotedPrimary: "second@example.com",
			notify: ["second@example.com"],
		});
	});

	test("removes a username freely, with no remaining-credential check", async () => {
		let created = await tenant.createSubject({
			identifiers: [
				{ kind: "email", value: "jane@example.com" },
				{ kind: "username", value: "jane" },
			],
		});
		if (!created.ok) throw new Error("unreachable");

		let result = await tenant.removeIdentifier({
			subjectId: created.subjectId,
			value: "jane",
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: true, promotedPrimary: null, notify: [] });
	});
});

describe("updateSubject", () => {
	test("writes profile columns unconditionally", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let result = await tenant.updateSubject({
			subjectId: created.subjectId,
			profile: { name: "Jane Doe" },
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: true });

		let described = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: adminActor,
		});
		expect(described).toMatchObject({ ok: true, profile: { name: "Jane Doe" } });
	});

	test("lets a subject write only its own self-visibility attributes", async () => {
		await tenant.defineAttribute({ key: "bio", type: "string", visibility: "self" });
		await tenant.defineAttribute({ key: "plan", type: "string", visibility: "claim" });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let selfWrite = await tenant.updateSubject({
			subjectId: created.subjectId,
			attributes: { bio: "hello" },
			actor: subjectActor,
		});
		expect(selfWrite).toEqual({ ok: true });

		let forbidden = await tenant.updateSubject({
			subjectId: created.subjectId,
			attributes: { plan: "pro" },
			actor: subjectActor,
		});
		expect(forbidden).toEqual({ ok: false, reason: "attribute-not-writable", key: "plan" });

		let adminWrite = await tenant.updateSubject({
			subjectId: created.subjectId,
			attributes: { plan: "pro" },
			actor: adminActor,
		});
		expect(adminWrite).toEqual({ ok: true });
	});
});

describe("describeSubject: attribute visibility", () => {
	test("hides an internal attribute from a subject audience", async () => {
		await tenant.defineAttribute({ key: "risk_score", type: "number", visibility: "internal" });
		await tenant.defineAttribute({ key: "plan", type: "string", visibility: "claim" });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
			attributes: { risk_score: 7, plan: "pro" },
		});
		if (!created.ok) throw new Error("unreachable");

		let asSubject = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: subjectActor,
		});
		expect(asSubject).toMatchObject({ ok: true, attributes: { plan: "pro" } });
		if (asSubject.ok) expect(asSubject.attributes).not.toHaveProperty("risk_score");

		let asAdmin = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: adminActor,
		});
		expect(asAdmin).toMatchObject({ ok: true, attributes: { plan: "pro", risk_score: 7 } });
	});
});

describe("blockSubject / unblockSubject / deleteSubject", () => {
	test("flips status and back", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		expect(await tenant.blockSubject({ subjectId: created.subjectId, reason: "fraud" })).toEqual({
			ok: true,
		});

		let blocked = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: adminActor,
		});
		expect(blocked).toMatchObject({ ok: true, profile: { status: "blocked" } });

		expect(await tenant.unblockSubject({ subjectId: created.subjectId })).toEqual({ ok: true });

		let active = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: adminActor,
		});
		expect(active).toMatchObject({ ok: true, profile: { status: "active" } });
	});

	test("deletes the subject, its identifiers and its attributes", async () => {
		await tenant.defineAttribute({ key: "plan", type: "string", visibility: "claim" });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
			attributes: { plan: "pro" },
		});
		if (!created.ok) throw new Error("unreachable");

		expect(await tenant.deleteSubject({ subjectId: created.subjectId })).toEqual({ ok: true });
		expect(
			await tenant.describeSubject({ subjectId: created.subjectId, audience: adminActor }),
		).toEqual({
			ok: false,
			reason: "not-found",
		});

		let rows = [...state.storage.sql.exec(`SELECT * FROM subject_identifiers`)];
		expect(rows).toEqual([]);
		let attributeRows = [...state.storage.sql.exec(`SELECT * FROM subject_attributes`)];
		expect(attributeRows).toEqual([]);
	});
});

describe("removeAttribute", () => {
	test("leaves a subject's stored value in place after the definition is removed", async () => {
		await tenant.defineAttribute({ key: "plan", type: "string", visibility: "claim" });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
			attributes: { plan: "pro" },
		});
		if (!created.ok) throw new Error("unreachable");

		expect(await tenant.removeAttribute({ key: "plan" })).toEqual({ ok: true });

		let rows = [
			...state.storage.sql.exec<{ key: string; value: string }>(
				`SELECT key, value FROM subject_attributes`,
			),
		];
		expect(rows).toEqual([{ key: "plan", value: JSON.stringify("pro") }]);

		// With no definition, describeSubject no longer surfaces the orphaned value.
		let described = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: adminActor,
		});
		expect(described).toMatchObject({ ok: true, attributes: {} });
	});
});

describe("retention sweep", () => {
	test("releases an unverified identifier whose row has aged past the retention window", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");

		let eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
		state.storage.sql.exec(
			`UPDATE subject_identifiers SET created_at = ?, verification_ticket = NULL, verification_ticket_expires_at = NULL WHERE id = ?`,
			eightDaysAgo,
			added.identifierId,
		);

		await tenant.alarm();

		let rows = [
			...state.storage.sql.exec(`SELECT * FROM subject_identifiers WHERE kind = 'email'`),
		];
		expect(rows).toEqual([]);
	});

	test("leaves a recent unverified identifier alone", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});

		await tenant.alarm();

		let rows = [
			...state.storage.sql.exec(`SELECT * FROM subject_identifiers WHERE kind = 'email'`),
		];
		expect(rows).toHaveLength(1);
	});

	test("arms the next day's alarm after running", async () => {
		await tenant.alarm();
		let armed = await state.storage.getAlarm();
		expect(armed).toBeGreaterThan(Date.now());
	});
});

describe("audit", () => {
	async function auditRowsFor(action: string) {
		let page = await tenant.readAuditPage({ from: 0, to: Date.now() + 60_000, action });
		if (!page.ok) throw new Error("unreachable");
		return page.events;
	}

	test("subject.created lands when a subject is created", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let rows = await auditRowsFor("subject.created");
		expect(rows).toMatchObject([
			{
				actorType: "platform",
				targetType: "subject",
				targetId: created.subjectId,
				outcome: "succeeded",
			},
		]);
	});

	test("subject.updated lands when a subject's profile is written", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		await tenant.updateSubject({
			subjectId: created.subjectId,
			profile: { name: "Ada Lovelace" },
			actor: adminActor,
		});

		let rows = await auditRowsFor("subject.updated");
		expect(rows).toMatchObject([
			{ actorType: "platform", targetId: created.subjectId, outcome: "succeeded" },
		]);
	});

	test("identifier.added lands when a new identifier is claimed", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});

		let rows = await auditRowsFor("identifier.added");
		expect(rows).toMatchObject([
			{ actorType: "subject", actorId: created.subjectId, targetId: created.subjectId },
		]);
	});

	test("identifier.verified lands when a ticket is spent", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");

		await tenant.verifyIdentifier({ ticket: added.ticket });

		let rows = await auditRowsFor("identifier.verified");
		expect(rows).toMatchObject([{ targetId: created.subjectId, outcome: "succeeded" }]);
	});

	test("identifier.removed lands when an identifier is taken away", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		await tenant.removeIdentifier({
			subjectId: created.subjectId,
			value: "jane",
			actor: subjectActor,
		});

		let rows = await auditRowsFor("identifier.removed");
		expect(rows).toMatchObject([{ targetId: created.subjectId, outcome: "succeeded" }]);
	});

	test("subject.blocked lands when a subject is blocked", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		await tenant.blockSubject({ subjectId: created.subjectId, reason: "fraud" });

		let rows = await auditRowsFor("subject.blocked");
		expect(rows).toMatchObject([
			{ actorType: "platform", targetId: created.subjectId, detail: { reason: "fraud" } },
		]);
	});

	test("blocking a subject attributes the session revocation it cascades to the platform, not the subject", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: subjectActor,
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		await tenant.setPassword({
			subjectId: created.subjectId,
			password: "correct horse battery",
			actor: subjectActor,
		});
		let signedIn = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct horse battery",
			remembered: false,
		});
		if (!signedIn.ok) throw new Error("unreachable");

		await tenant.blockSubject({ subjectId: created.subjectId, reason: "fraud" });

		let rows = await auditRowsFor("session.revoked");
		expect(rows).toMatchObject([{ actorType: "platform", actorId: "system" }]);
	});

	test("subject.unblocked lands when a subject is unblocked", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		await tenant.blockSubject({ subjectId: created.subjectId, reason: "fraud" });
		await tenant.unblockSubject({ subjectId: created.subjectId });

		let rows = await auditRowsFor("subject.unblocked");
		expect(rows).toMatchObject([{ targetId: created.subjectId, outcome: "succeeded" }]);
	});

	test("subject.deleted lands when a subject is deleted", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let deleted = await tenant.deleteSubject({ subjectId: created.subjectId });
		expect(deleted).toEqual({ ok: true });

		let rows = await auditRowsFor("subject.deleted");
		expect(rows).toMatchObject([{ targetId: created.subjectId, outcome: "succeeded" }]);
	});
});
