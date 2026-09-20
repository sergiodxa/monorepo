/**
 * Drives the reset leg of the hosted flow through a real tenant router: the
 * request step renders the identical confirmation whether or not the
 * identifier resolves, a valid ticket writes a new password that signs in
 * afterward, and an invalid or expired ticket fails cleanly rather than
 * crashing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MemoryTransport } from "@sdxc/mail/memory";

import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";

import {
	buildHarness,
	createTestClient,
	createTestSubjectWithPassword,
	REDIRECT_URI,
} from "~/app/http/controllers/hosted/test-harness";
import { ResetPasswordEmail } from "~/app/mail/reset-password-email";

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

/** A valid `/authorize` query for the given client, everything else defaulted. */
function authorizeQuery(clientId: string): string {
	return new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: "openid",
		code_challenge: "a-valid-looking-challenge",
		code_challenge_method: "S256",
	}).toString();
}

/** Begins authorization and returns the `/u/sign-in` interaction id it parks. */
async function beginAndReachSignIn(harnessValue: Harness, clientId: string) {
	let response = await harnessValue.router.fetch(
		harnessValue.request(`/authorize?${authorizeQuery(clientId)}`),
	);
	let location = new URL(response.headers.get("Location") ?? "", REDIRECT_URI);
	let interactionId = location.searchParams.get("interaction");
	if (!interactionId) throw new Error("expected an interaction id");
	return { signInPath: `${location.pathname}${location.search}`, interactionId };
}

function form(fields: Record<string, string>): FormData {
	let body = new FormData();
	for (let [key, value] of Object.entries(fields)) body.set(key, value);
	return body;
}

describe("reset", () => {
	test("requesting a reset renders the same confirmation whether or not the identifier resolves", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let resolved = await harness.router.fetch(
			harness.request("/u/reset", {
				method: "POST",
				body: form({ identifier: "jane@example.com" }),
			}),
		);
		let unresolved = await harness.router.fetch(
			harness.request("/u/reset", {
				method: "POST",
				body: form({ identifier: "nobody@example.com" }),
			}),
		);

		expect(resolved.status).toBe(unresolved.status);
		let [resolvedBody, unresolvedBody] = await Promise.all([resolved.text(), unresolved.text()]);
		expect(resolvedBody).toBe(unresolvedBody);
	});

	test("sends a reset email only when the identifier resolves, without changing the response", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});
		let transport = harness.mailTransport as MemoryTransport;

		let unresolved = await harness.router.fetch(
			harness.request("/u/reset", {
				method: "POST",
				body: form({ identifier: "nobody@example.com" }),
			}),
		);
		expect(unresolved.status).toBe(200);
		expect(transport.messages).toHaveLength(0);

		let resolved = await harness.router.fetch(
			harness.request("/u/reset", {
				method: "POST",
				body: form({ identifier: "jane@example.com" }),
			}),
		);
		expect(resolved.status).toBe(200);
		expect(transport.messages).toHaveLength(1);
		expect(transport.last?.to).toEqual([{ email: "jane@example.com" }]);
		expect(transport.last?.email).toBeInstanceOf(ResetPasswordEmail);
	});

	test("completing a reset with a valid ticket signs in with the new password afterward", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let began = await harness.tenantDO.beginPasswordReset({ identifier: "jane@example.com" });

		let completeResponse = await harness.router.fetch(
			harness.request(`/u/reset?ticket=${began.ticket}`, {
				method: "POST",
				body: form({ newPassword: "a whole new passphrase" }),
			}),
		);

		expect(completeResponse.status).toBe(200);
		let body = await completeResponse.text();
		expect(body).toContain("Password reset");

		let { signInPath } = await beginAndReachSignIn(harness, client.id);
		let signInResponse = await harness.router.fetch(
			harness.request(signInPath, {
				method: "POST",
				body: form({ identifier: "jane@example.com", password: "a whole new passphrase" }),
			}),
		);

		expect(signInResponse.status).toBe(302);
		expect(signInResponse.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);

		let oldPasswordResponse = await harness.router.fetch(
			harness.request((await beginAndReachSignIn(harness, client.id)).signInPath, {
				method: "POST",
				body: form({
					identifier: "jane@example.com",
					password: "correct horse battery staple",
				}),
			}),
		);
		expect(oldPasswordResponse.status).toBe(400);
	});

	test("completing a reset with an invalid ticket shows a clean error", async () => {
		let response = await harness.router.fetch(
			harness.request("/u/reset?ticket=does-not-exist", {
				method: "POST",
				body: form({ newPassword: "some password value" }),
			}),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("no longer works");
	});
});
