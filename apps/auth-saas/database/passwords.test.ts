/**
 * Exercises `passwords.ts` directly against a `Database`, the style `subjects.test.ts`
 * prefers for logic that does not yet need a Durable Object around it: this module is
 * not wired into the tenant object yet, so these tests build a database over the same
 * migrations `tenant-do.ts` applies rather than constructing `Tenant` itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { password } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import * as Passwords from "./passwords";
import * as Subjects from "./subjects";
import m0001 from "./tenant-migrations/0001-init.sql?raw";
import m0002 from "./tenant-migrations/0002-subjects.sql?raw";
import m0003 from "./tenant-migrations/0003-passwords.sql?raw";

let db: Database;

let subjectActor = { kind: "subject" } as const;

beforeEach(async () => {
	let state: DurableObjectStateMock = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);

	await driver.executeScript(m0001);
	await driver.executeScript(m0002);
	await driver.executeScript(m0003);

	db = new Database(driver);
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** Creates a subject with one verified email, the shape most tests sign in against. */
async function createVerifiedSubject(email: string): Promise<string> {
	let created = await Subjects.createSubject(db, {
		identifiers: [{ kind: "email", value: email }],
	});
	if (!created.ok) throw new Error("unreachable");

	let added = await Subjects.addIdentifier(db, {
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: subjectActor,
	});
	if (!added.ok || added.kind !== "email") throw new Error("unreachable");

	await Subjects.verifyIdentifier(db, { ticket: added.ticket });

	return created.subjectId;
}

/** Creates a subject with only an unverified username: no readable credential at all. */
async function createBareSubject(username: string): Promise<string> {
	let created = await Subjects.createSubject(db, {
		identifiers: [{ kind: "username", value: username }],
	});
	if (!created.ok) throw new Error("unreachable");
	return created.subjectId;
}

describe("describePasswordPolicy", () => {
	test("defaults to length 8, no denied terms, no expiry, and a history of 1", async () => {
		let policy = await Passwords.describePasswordPolicy(db);

		expect(policy).toEqual({
			minLength: 8,
			deniedTerms: [],
			expiryIntervalMs: null,
			historyDepth: 1,
		});
	});
});

describe("setPassword: policy rejections", () => {
	test("refuses an unknown subject", async () => {
		let result = await Passwords.setPassword(db, {
			subjectId: "sub_does_not_exist",
			password: "a-perfectly-fine-password-1",
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	test("refuses a password shorter than the minimum length", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");

		let result = await Passwords.setPassword(db, {
			subjectId,
			password: "short1",
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: false, reason: "too-short", minLength: 8 });
	});

	test("refuses a well-known common password", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");

		let result = await Passwords.setPassword(db, {
			subjectId,
			password: "password",
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: false, reason: "breached-or-common" });
	});

	test("refuses a password containing the subject's own email local part", async () => {
		let subjectId = await createVerifiedSubject("janedoe@example.com");

		let result = await Passwords.setPassword(db, {
			subjectId,
			password: "janedoe-secret-1",
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: false, reason: "similar-to-identifier" });
	});

	test("refuses a password containing a tenant-denied term", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await db.update(Passwords.passwordPolicy, { id: "default" }, { denied_terms: ["acmecorp"] });

		let result = await Passwords.setPassword(db, {
			subjectId,
			password: "acmecorp-rocks-1",
			actor: subjectActor,
		});

		expect(result).toEqual({ ok: false, reason: "denied-term", term: "acmecorp" });
	});

	test("accepts a password that clears every check", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");

		let result = await Passwords.setPassword(db, {
			subjectId,
			password: "a-perfectly-fine-password-1",
			actor: subjectActor,
		});

		expect(result).toEqual({
			ok: true,
			passwordId: expect.stringMatching(/^pw_/),
			expiresAt: null,
		});
	});

	test("stamps expires_at from the tenant's expiry interval", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await db.update(Passwords.passwordPolicy, { id: "default" }, { expiry_interval_ms: 60_000 });

		let before = Date.now();
		let result = await Passwords.setPassword(db, {
			subjectId,
			password: "a-perfectly-fine-password-1",
			actor: subjectActor,
		});
		if (!result.ok) throw new Error("unreachable");

		expect(result.expiresAt).not.toBeNull();
		expect(result.expiresAt as number).toBeGreaterThanOrEqual(before + 60_000);
	});
});

describe("setPassword: reuse and history", () => {
	test("refuses setting the same password twice in a row", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");

		let first = await Passwords.setPassword(db, {
			subjectId,
			password: "a-perfectly-fine-password-1",
			actor: subjectActor,
		});
		expect(first.ok).toBe(true);

		let second = await Passwords.setPassword(db, {
			subjectId,
			password: "a-perfectly-fine-password-1",
			actor: subjectActor,
		});
		expect(second).toEqual({ ok: false, reason: "reused" });
	});

	test("trims history to the tenant's depth, keeping only the newest N rows", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await db.update(Passwords.passwordPolicy, { id: "default" }, { history_depth: 3 });

		let candidates = ["password-one-1", "password-two-1", "password-three-1", "password-four-1"];
		for (let candidate of candidates) {
			let result = await Passwords.setPassword(db, {
				subjectId,
				password: candidate,
				actor: subjectActor,
			});
			expect(result.ok).toBe(true);
		}

		let count = await db.count(Passwords.passwords, { where: { subject_id: subjectId } });
		expect(count).toBe(3);
	});

	test("refuses a reuse inside the history window, and accepts it again once trimmed out", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await db.update(Passwords.passwordPolicy, { id: "default" }, { history_depth: 3 });

		await Passwords.setPassword(db, { subjectId, password: "password-a-1", actor: subjectActor });
		await Passwords.setPassword(db, { subjectId, password: "password-b-1", actor: subjectActor });
		await Passwords.setPassword(db, { subjectId, password: "password-c-1", actor: subjectActor });

		let reuseWithinWindow = await Passwords.setPassword(db, {
			subjectId,
			password: "password-a-1",
			actor: subjectActor,
		});
		expect(reuseWithinWindow).toEqual({ ok: false, reason: "reused" });

		// A fourth distinct password trims "password-a-1" out of the retained rows.
		await Passwords.setPassword(db, { subjectId, password: "password-d-1", actor: subjectActor });

		let reuseOutsideWindow = await Passwords.setPassword(db, {
			subjectId,
			password: "password-a-1",
			actor: subjectActor,
		});
		expect(reuseOutsideWindow.ok).toBe(true);
	});
});

describe("changePassword", () => {
	test("refuses an unknown subject", async () => {
		let result = await Passwords.changePassword(db, {
			subjectId: "sub_does_not_exist",
			currentPassword: "whatever",
			newPassword: "a-perfectly-fine-password-1",
		});
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	test("refuses a subject with no password set", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");

		let result = await Passwords.changePassword(db, {
			subjectId,
			currentPassword: "whatever",
			newPassword: "a-perfectly-fine-password-1",
		});
		expect(result).toEqual({ ok: false, reason: "no-password" });
	});

	test("refuses the wrong current password", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await Passwords.setPassword(db, {
			subjectId,
			password: "original-password-1",
			actor: subjectActor,
		});

		let result = await Passwords.changePassword(db, {
			subjectId,
			currentPassword: "wrong-password-1",
			newPassword: "a-new-password-1",
		});
		expect(result).toEqual({ ok: false, reason: "wrong-password" });
	});

	test("writes the new password once the current one verifies", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await Passwords.setPassword(db, {
			subjectId,
			password: "original-password-1",
			actor: subjectActor,
		});

		let result = await Passwords.changePassword(db, {
			subjectId,
			currentPassword: "original-password-1",
			newPassword: "a-new-password-1",
		});
		expect(result.ok).toBe(true);

		let signIn = await Passwords.signInWithPassword(db, {
			identifier: "jane@example.com",
			password: "a-new-password-1",
		});
		expect(signIn).toMatchObject({ ok: true, subjectId });
	});
});

describe("signInWithPassword", () => {
	test("succeeds with the correct password", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await Passwords.setPassword(db, {
			subjectId,
			password: "correct-password-1",
			actor: subjectActor,
		});

		let result = await Passwords.signInWithPassword(db, {
			identifier: "jane@example.com",
			password: "correct-password-1",
		});

		expect(result).toEqual({
			ok: true,
			subjectId,
			secondFactorRequired: false,
			mustChangePassword: false,
		});
	});

	test("signs in from any casing of the address, folded the same way as sign-up", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await Passwords.setPassword(db, {
			subjectId,
			password: "correct-password-1",
			actor: subjectActor,
		});

		let result = await Passwords.signInWithPassword(db, {
			identifier: "JANE@EXAMPLE.COM",
			password: "correct-password-1",
		});

		expect(result).toMatchObject({ ok: true, subjectId });
	});

	test("blocks a password past its expiry", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		let set = await Passwords.setPassword(db, {
			subjectId,
			password: "correct-password-1",
			actor: subjectActor,
		});
		if (!set.ok) throw new Error("unreachable");

		await db.update(Passwords.passwords, { id: set.passwordId }, { expires_at: Date.now() - 1000 });

		let result = await Passwords.signInWithPassword(db, {
			identifier: "jane@example.com",
			password: "correct-password-1",
		});

		expect(result).toEqual({ ok: false, reason: "password_expired" });
	});

	test("reports what a forced reset left owed", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await Passwords.setPassword(db, {
			subjectId,
			password: "correct-password-1",
			actor: subjectActor,
		});
		await Passwords.forcePasswordReset(db, { subjectId, reason: "suspected compromise" });

		let result = await Passwords.signInWithPassword(db, {
			identifier: "jane@example.com",
			password: "correct-password-1",
		});

		expect(result).toMatchObject({ ok: true, mustChangePassword: true });
	});

	describe("constant-time shape: every negative path derives for real before answering", () => {
		test("an identifier that resolves to nobody", async () => {
			let verifySpy = vi.spyOn(password, "verify");

			let result = await Passwords.signInWithPassword(db, {
				identifier: "nobody@example.com",
				password: "whatever-1",
			});

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
			expect(verifySpy).toHaveBeenCalledTimes(1);
		});

		test("a subject that holds no password", async () => {
			await createVerifiedSubject("jane@example.com");
			let verifySpy = vi.spyOn(password, "verify");

			let result = await Passwords.signInWithPassword(db, {
				identifier: "jane@example.com",
				password: "whatever-1",
			});

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
			expect(verifySpy).toHaveBeenCalledTimes(1);
		});

		test("a blocked subject with a real password set", async () => {
			let subjectId = await createVerifiedSubject("jane@example.com");
			await Passwords.setPassword(db, {
				subjectId,
				password: "correct-password-1",
				actor: subjectActor,
			});
			await Subjects.blockSubject(db, { subjectId, reason: "fraud" });

			let verifySpy = vi.spyOn(password, "verify");

			let result = await Passwords.signInWithPassword(db, {
				identifier: "jane@example.com",
				password: "correct-password-1",
			});

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
			expect(verifySpy).toHaveBeenCalledTimes(1);
		});

		test("a wrong password against a real account, in the same shape as the above", async () => {
			let subjectId = await createVerifiedSubject("jane@example.com");
			await Passwords.setPassword(db, {
				subjectId,
				password: "correct-password-1",
				actor: subjectActor,
			});

			let verifySpy = vi.spyOn(password, "verify");

			let result = await Passwords.signInWithPassword(db, {
				identifier: "jane@example.com",
				password: "wrong-password-1",
			});

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
			expect(verifySpy).toHaveBeenCalledTimes(1);
		});
	});
});

describe("removePassword", () => {
	test("refuses an unknown subject", async () => {
		let result = await Passwords.removePassword(db, { subjectId: "sub_does_not_exist" });
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	test("refuses a subject with no password", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");

		let result = await Passwords.removePassword(db, { subjectId });
		expect(result).toEqual({ ok: false, reason: "no-password" });
	});

	test("refuses to leave a subject with no readable credential", async () => {
		let subjectId = await createBareSubject("jane");
		await Passwords.setPassword(db, {
			subjectId,
			password: "correct-password-1",
			actor: subjectActor,
		});

		let result = await Passwords.removePassword(db, { subjectId });
		expect(result).toEqual({ ok: false, reason: "last-credential" });
	});

	test("removes every row when a verified identifier remains", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		await Passwords.setPassword(db, {
			subjectId,
			password: "correct-password-1",
			actor: subjectActor,
		});

		let result = await Passwords.removePassword(db, { subjectId });
		expect(result).toEqual({ ok: true });

		let count = await db.count(Passwords.passwords, { where: { subject_id: subjectId } });
		expect(count).toBe(0);
	});
});

describe("forcePasswordReset", () => {
	test("refuses an unknown subject", async () => {
		let result = await Passwords.forcePasswordReset(db, {
			subjectId: "sub_does_not_exist",
			reason: "x",
		});
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	test("refuses a subject with no password", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");

		let result = await Passwords.forcePasswordReset(db, { subjectId, reason: "x" });
		expect(result).toEqual({ ok: false, reason: "no-password" });
	});

	test("marks the newest row and records the reason, and the flag reaches sign-in", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		let set = await Passwords.setPassword(db, {
			subjectId,
			password: "correct-password-1",
			actor: subjectActor,
		});
		if (!set.ok) throw new Error("unreachable");

		let result = await Passwords.forcePasswordReset(db, {
			subjectId,
			reason: "suspected compromise",
		});
		expect(result).toEqual({
			ok: true,
			passwordId: set.passwordId,
			reason: "suspected compromise",
		});

		let signIn = await Passwords.signInWithPassword(db, {
			identifier: "jane@example.com",
			password: "correct-password-1",
		});
		expect(signIn).toMatchObject({ ok: true, mustChangePassword: true });
	});
});

describe("beginPasswordReset / completePasswordReset", () => {
	test("an unknown identifier returns the same shape as a known one, with a null address", async () => {
		let result = await Passwords.beginPasswordReset(db, { identifier: "nobody@example.com" });

		expect(result).toEqual({ ok: true, ticket: expect.any(String), address: null });
	});

	test("a known verified address gets a ticket and its own address back", async () => {
		await createVerifiedSubject("jane@example.com");

		let result = await Passwords.beginPasswordReset(db, { identifier: "jane@example.com" });

		expect(result).toEqual({ ok: true, ticket: expect.any(String), address: "jane@example.com" });
	});

	test("completes a reset, opening the way for the new password and closing the ticket", async () => {
		let subjectId = await createVerifiedSubject("jane@example.com");
		let begun = await Passwords.beginPasswordReset(db, { identifier: "jane@example.com" });

		let completed = await Passwords.completePasswordReset(db, {
			ticket: begun.ticket,
			newPassword: "a-reset-password-1",
		});
		expect(completed).toEqual({
			ok: true,
			subjectId,
			passwordId: expect.stringMatching(/^pw_/),
		});

		let signIn = await Passwords.signInWithPassword(db, {
			identifier: "jane@example.com",
			password: "a-reset-password-1",
		});
		expect(signIn).toMatchObject({ ok: true, subjectId });

		let secondAttempt = await Passwords.completePasswordReset(db, {
			ticket: begun.ticket,
			newPassword: "another-password-1",
		});
		expect(secondAttempt).toEqual({ ok: false, reason: "invalid-ticket" });
	});

	test("refuses a ticket that never existed", async () => {
		let result = await Passwords.completePasswordReset(db, {
			ticket: "not-a-real-ticket",
			newPassword: "a-reset-password-1",
		});
		expect(result).toEqual({ ok: false, reason: "invalid-ticket" });
	});

	test("refuses an expired ticket, and the attempt still spends it", async () => {
		await createVerifiedSubject("jane@example.com");
		let begun = await Passwords.beginPasswordReset(db, { identifier: "jane@example.com" });

		let ticketRows = await db.findMany(Passwords.passwordResetTickets);
		let ticketRow = ticketRows[0];
		if (!ticketRow) throw new Error("unreachable");

		await db.update(
			Passwords.passwordResetTickets,
			{ id: ticketRow.id },
			{ expires_at: Date.now() - 1000 },
		);

		let result = await Passwords.completePasswordReset(db, {
			ticket: begun.ticket,
			newPassword: "a-reset-password-1",
		});
		expect(result).toEqual({ ok: false, reason: "invalid-ticket" });

		let secondAttempt = await Passwords.completePasswordReset(db, {
			ticket: begun.ticket,
			newPassword: "a-reset-password-1",
		});
		expect(secondAttempt).toEqual({ ok: false, reason: "invalid-ticket" });
	});

	test("spends the ticket even when the new password fails policy", async () => {
		await createVerifiedSubject("jane@example.com");
		let begun = await Passwords.beginPasswordReset(db, { identifier: "jane@example.com" });

		let tooShort = await Passwords.completePasswordReset(db, {
			ticket: begun.ticket,
			newPassword: "short",
		});
		expect(tooShort).toEqual({ ok: false, reason: "too-short", minLength: 8 });

		let secondAttempt = await Passwords.completePasswordReset(db, {
			ticket: begun.ticket,
			newPassword: "a-perfectly-fine-password-1",
		});
		expect(secondAttempt).toEqual({ ok: false, reason: "invalid-ticket" });
	});
});
