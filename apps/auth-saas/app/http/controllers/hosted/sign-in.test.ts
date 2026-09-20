/**
 * Drives the sign-in leg of the hosted flow through a real tenant router: a
 * correct password sign-in against an already-granted client completes straight
 * to a code redirect, a correct sign-in against a new scope lands on `/u/consent`,
 * a wrong password re-renders `/u/sign-in` with an error, and an interaction id
 * that no longer resolves lands on `/u/error`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";

import {
	buildHarness,
	createTestClient,
	createTestSubjectWithPassword,
	REDIRECT_URI,
} from "~/app/http/controllers/hosted/test-harness";

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

/** A valid `/authorize` query for the given client, everything else defaulted. */
function authorizeQuery(clientId: string, scope = "openid"): string {
	return new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope,
		code_challenge: "a-valid-looking-challenge",
		code_challenge_method: "S256",
	}).toString();
}

/** Begins authorization and returns the `/u/sign-in` interaction id it parks. */
async function beginAndReachSignIn(harnessValue: Harness, clientId: string, scope = "openid") {
	let response = await harnessValue.router.fetch(
		harnessValue.request(`/authorize?${authorizeQuery(clientId, scope)}`),
	);
	let location = new URL(response.headers.get("Location") ?? "", REDIRECT_URI);
	let interactionId = location.searchParams.get("interaction");
	if (!interactionId) throw new Error("expected an interaction id");
	return { signInPath: `${location.pathname}${location.search}`, interactionId };
}

/** A `POST` to `/u/sign-in`'s own path (query included), submitting the credential form. */
function signInForm(fields: Record<string, string>): FormData {
	let body = new FormData();
	for (let [key, value] of Object.entries(fields)) body.set(key, value);
	return body;
}

describe("sign-in", () => {
	test("a correct password against an already-granted client completes to a code redirect", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		let subjectId = await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});
		await harness.tenantDO.recordConsentDecision({
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid"],
		});

		let { signInPath } = await beginAndReachSignIn(harness, client.id);

		let response = await harness.router.fetch(
			harness.request(signInPath, {
				method: "POST",
				body: signInForm({
					identifier: "jane@example.com",
					password: "correct horse battery staple",
					remember: "true",
				}),
			}),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);

		let location = new URL(response.headers.get("Location") ?? "");
		expect(location.origin + location.pathname).toBe(REDIRECT_URI);
		expect(location.searchParams.get("code")).toBeTruthy();
	});

	test("a correct password against a newly requested scope lands on /u/consent", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid", "profile"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let { signInPath } = await beginAndReachSignIn(harness, client.id, "openid profile");

		let response = await harness.router.fetch(
			harness.request(signInPath, {
				method: "POST",
				body: signInForm({
					identifier: "jane@example.com",
					password: "correct horse battery staple",
					remember: "true",
				}),
			}),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);

		let location = new URL(response.headers.get("Location") ?? "");
		expect(location.pathname).toBe("/u/consent");
		expect(location.searchParams.get("interaction")).toBeTruthy();
	});

	test("a wrong password re-renders /u/sign-in with an error", async () => {
		let client = await createTestClient(harness.tenantDO);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let { signInPath } = await beginAndReachSignIn(harness, client.id);

		let response = await harness.router.fetch(
			harness.request(signInPath, {
				method: "POST",
				body: signInForm({ identifier: "jane@example.com", password: "wrong password" }),
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Location")).toBeNull();

		let body = await response.text();
		expect(body).toContain("incorrect");
	});

	test("a sign-in past a capped-out Free tenant's daily active user limit re-renders with an error", async () => {
		let client = await createTestClient(harness.tenantDO);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "john@example.com",
			password: "correct horse battery staple",
		});

		await harness.tenantDO.applyEntitlements({
			plan: "free",
			features: {},
			dauCap: 1,
			auditRetentionDays: 7,
			effectiveAt: Date.now(),
		});

		let counted = await beginAndReachSignIn(harness, client.id);
		let countedResponse = await harness.router.fetch(
			harness.request(counted.signInPath, {
				method: "POST",
				body: signInForm({
					identifier: "jane@example.com",
					password: "correct horse battery staple",
				}),
			}),
		);
		expect(countedResponse.status).toBe(302);

		let refused = await beginAndReachSignIn(harness, client.id);
		let refusedResponse = await harness.router.fetch(
			harness.request(refused.signInPath, {
				method: "POST",
				body: signInForm({
					identifier: "john@example.com",
					password: "correct horse battery staple",
				}),
			}),
		);

		expect(refusedResponse.status).toBe(400);
		expect(refusedResponse.headers.get("Location")).toBeNull();

		let body = await refusedResponse.text();
		expect(body).toContain("daily limit");
	});

	test("an interaction id that no longer resolves lands on /u/error", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let response = await harness.router.fetch(
			harness.request("/u/sign-in?interaction=does-not-exist", {
				method: "POST",
				body: signInForm({
					identifier: "jane@example.com",
					password: "correct horse battery staple",
				}),
			}),
		);

		expect(response.status).toBe(302);
		let location = new URL(response.headers.get("Location") ?? "");
		expect(location.pathname).toBe("/u/error");

		let errorPage = await harness.router.fetch(
			harness.request(`${location.pathname}${location.search}`),
		);
		expect(errorPage.status).toBe(400);
		let body = await errorPage.text();
		expect(body).toContain("no longer valid");
	});
});
