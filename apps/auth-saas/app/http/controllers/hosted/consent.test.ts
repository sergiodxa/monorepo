/**
 * Drives the consent leg of the hosted flow through a real tenant router: signing
 * in against a newly requested scope, approving it on `/u/consent`, completes to
 * a code redirect; denying it answers with the `access_denied` redirect on the
 * client's own `redirect_uri`; and a missing interaction id lands on `/u/error`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";

import {
	buildHarness,
	cookieFrom,
	createTestClient,
	createTestSubjectWithPassword,
	REDIRECT_URI,
} from "~/app/http/controllers/hosted/test-harness";

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

/** A valid `/authorize` query for the given client, requesting `openid profile`. */
function authorizeQuery(clientId: string): string {
	return new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: "openid profile",
		code_challenge: "a-valid-looking-challenge",
		code_challenge_method: "S256",
	}).toString();
}

function form(fields: Record<string, string>): FormData {
	let body = new FormData();
	for (let [key, value] of Object.entries(fields)) body.set(key, value);
	return body;
}

/** Runs a full sign-in against a newly requested scope, landing on `/u/consent` with a live cookie. */
async function signInToConsent(harnessValue: Harness, clientId: string) {
	let authorizeResponse = await harnessValue.router.fetch(
		harnessValue.request(`/authorize?${authorizeQuery(clientId)}`),
	);
	let signInLocation = new URL(authorizeResponse.headers.get("Location") ?? "", REDIRECT_URI);

	let signInResponse = await harnessValue.router.fetch(
		harnessValue.request(`${signInLocation.pathname}${signInLocation.search}`, {
			method: "POST",
			body: form({
				identifier: "jane@example.com",
				password: "correct horse battery staple",
				remember: "true",
			}),
		}),
	);

	let cookie = cookieFrom(signInResponse);
	let consentLocation = new URL(signInResponse.headers.get("Location") ?? "", REDIRECT_URI);

	return { cookie, consentPath: `${consentLocation.pathname}${consentLocation.search}` };
}

describe("consent", () => {
	test("approving a newly requested scope completes to a code redirect", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid", "profile"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let { cookie, consentPath } = await signInToConsent(harness, client.id);

		let show = await harness.router.fetch(harness.request(consentPath, { cookie }));
		expect(show.status).toBe(200);
		let body = await show.text();
		expect(body).toContain("Test Client");

		let approve = await harness.router.fetch(
			harness.request(consentPath, { method: "POST", cookie, body: form({ decision: "approve" }) }),
		);

		expect(approve.status).toBe(302);
		let location = new URL(approve.headers.get("Location") ?? "");
		expect(location.origin + location.pathname).toBe(REDIRECT_URI);
		expect(location.searchParams.get("code")).toBeTruthy();
	});

	test("denying a newly requested scope answers with the access_denied redirect", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid", "profile"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let { cookie, consentPath } = await signInToConsent(harness, client.id);

		let deny = await harness.router.fetch(
			harness.request(consentPath, { method: "POST", cookie, body: form({ decision: "deny" }) }),
		);

		expect(deny.status).toBe(302);
		let location = new URL(deny.headers.get("Location") ?? "");
		expect(location.origin + location.pathname).toBe(REDIRECT_URI);
		expect(location.searchParams.get("error")).toBe("access_denied");
	});

	test("a missing interaction id lands on /u/error", async () => {
		let response = await harness.router.fetch(harness.request("/u/consent"));

		expect(response.status).toBe(302);
		let location = new URL(response.headers.get("Location") ?? "");
		expect(location.pathname).toBe("/u/error");
	});
});
