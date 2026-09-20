/**
 * Proves the wiring ADR-009 added on top of ADR-007/008's credential checks: signing in
 * with a password or a passkey actually opens a session resolvable afterwards, and a
 * password change, a password reset, and blocking a subject each end every session the
 * way ADR-009's table of authentication effects describes.
 *
 * Drives everything through the `Tenant` object, since the composition being tested —
 * one RPC call verifying a credential and opening a session, another revoking sessions
 * as a side effect of a password or block operation — only exists at that level.
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

let adminActor = { kind: "admin" } as const;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

/** Creates a subject with a verified email and a password, ready to sign in. */
async function createSubjectWithPassword(password: string) {
	let created = await tenant.createSubject({
		identifiers: [{ kind: "email", value: "jane@example.com" }],
	});
	if (!created.ok) throw new Error("setup failed");

	let added = await tenant.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: "jane@example.com",
		actor: adminActor,
	});
	if (!added.ok || added.kind !== "email") throw new Error("setup failed");
	await tenant.verifyIdentifier({ ticket: added.ticket });

	await tenant.setPassword({ subjectId: created.subjectId, password, actor: adminActor });

	return created.subjectId;
}

describe("signing in opens a resolvable session", () => {
	test("a password sign-in's token resolves to the same subject", async () => {
		let subjectId = await createSubjectWithPassword("correct-horse-battery");

		let signIn = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct-horse-battery",
			remembered: false,
		});
		if (!signIn.ok) throw new Error("sign-in failed");

		let resolved = await tenant.resolveSession({ token: signIn.token });

		expect(resolved).toMatchObject({ status: "active", subjectId, sessionId: signIn.sessionId });
	});
});

describe("changePassword revokes every other session", () => {
	test("spares the session performing the change", async () => {
		let subjectId = await createSubjectWithPassword("original-password-1");

		let kept = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "original-password-1",
			remembered: false,
		});
		let other = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "original-password-1",
			remembered: false,
		});
		if (!kept.ok || !other.ok) throw new Error("setup failed");

		await tenant.changePassword({
			subjectId,
			currentPassword: "original-password-1",
			newPassword: "a-new-password-1",
			keepSessionId: kept.sessionId,
		});

		expect(await tenant.resolveSession({ token: kept.token })).toMatchObject({ status: "active" });
		expect(await tenant.resolveSession({ token: other.token })).toEqual({ status: "revoked" });
	});
});

describe("completePasswordReset revokes every session, including its own", () => {
	test("the session used to sign in before the reset no longer resolves", async () => {
		await createSubjectWithPassword("original-password-1");

		let signIn = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "original-password-1",
			remembered: false,
		});
		if (!signIn.ok) throw new Error("setup failed");

		let begun = await tenant.beginPasswordReset({ identifier: "jane@example.com" });
		await tenant.completePasswordReset({ ticket: begun.ticket, newPassword: "a-reset-password-1" });

		expect(await tenant.resolveSession({ token: signIn.token })).toEqual({ status: "revoked" });
	});
});

describe("blockSubject revokes every session", () => {
	test("a session open before the block no longer resolves", async () => {
		await createSubjectWithPassword("original-password-1");

		let signIn = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "original-password-1",
			remembered: false,
		});
		if (!signIn.ok) throw new Error("setup failed");

		await tenant.blockSubject({ subjectId: signIn.subjectId, reason: "suspected compromise" });

		expect(await tenant.resolveSession({ token: signIn.token })).toEqual({ status: "revoked" });
	});
});

describe("deleteSubject removes its passwords, passkeys and sessions", () => {
	test("a removed subject's password no longer signs in", async () => {
		let subjectId = await createSubjectWithPassword("original-password-1");

		await tenant.deleteSubject({ subjectId });

		let signIn = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "original-password-1",
			remembered: false,
		});

		expect(signIn).toEqual({ ok: false, reason: "invalid-credentials" });
	});
});
