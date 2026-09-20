/**
 * Drives the step-up leg of the hosted flow through a real tenant router: an
 * already signed-in session hitting `/authorize` with `acr_values=mfa` is routed
 * to `/u/step-up`, and a correct code completes it to a code redirect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { totp } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";

import {
	buildHarness,
	createTestClient,
	createTestSubjectWithPassword,
	REDIRECT_URI,
} from "~/app/http/controllers/hosted/test-harness";
import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

/** A `POST` form body. */
function form(fields: Record<string, string>): FormData {
	let body = new FormData();
	for (let [key, value] of Object.entries(fields)) body.set(key, value);
	return body;
}

/** A valid `/authorize` query for the given client, everything else defaulted. */
function authorizeQuery(clientId: string, overrides: Record<string, string> = {}): string {
	return new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: "openid",
		code_challenge: "a-valid-looking-challenge",
		code_challenge_method: "S256",
		...overrides,
	}).toString();
}

describe("step-up", () => {
	test("acr_values=mfa on an already-authenticated session is routed to /u/step-up, and a correct code completes it", async () => {
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

		let begun = await harness.tenantDO.beginTotpEnrolment({ subjectId });
		if (!begun.ok) throw new Error("unreachable");
		let setupCode = await totp.code(begun.setupKey);
		if (isFailure(setupCode)) throw new Error("unreachable");
		let activated = await harness.tenantDO.activateTotpFactor({
			enrolmentId: begun.enrolmentId,
			code: setupCode.data,
		});
		if (!activated.ok) throw new Error("unreachable");

		let signedIn = await harness.tenantDO.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});
		if (!signedIn.ok) throw new Error("unreachable");

		// The factor demand at sign-in is proven separately from a step-up's own,
		// fresher proof — complete it so this test isolates the step-up path.
		let firstCode = await totp.code(begun.setupKey);
		if (isFailure(firstCode)) throw new Error("unreachable");
		await harness.tenantDO.completeSecondFactor({
			sessionId: signedIn.sessionId,
			submission: firstCode.data,
			trustDevice: false,
			agent: { ip: null, userAgent: null },
		});

		let sessionCookie = (await serializeSessionCookie(signedIn, false)).split(";")[0] ?? "";

		let authorize = await harness.router.fetch(
			harness.request(`/authorize?${authorizeQuery(client.id, { acr_values: "mfa" })}`, {
				cookie: sessionCookie,
			}),
		);

		expect(authorize.status).toBe(302);
		let location = new URL(authorize.headers.get("Location") ?? "", REDIRECT_URI);
		expect(location.pathname).toBe("/u/step-up");

		let stepUpPath = `${location.pathname}${location.search}`;

		let code = await totp.code(begun.setupKey);
		if (isFailure(code)) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(stepUpPath, {
				method: "POST",
				cookie: sessionCookie,
				body: form({ submission: code.data }),
			}),
		);

		expect(response.status).toBe(302);
		let finalLocation = new URL(response.headers.get("Location") ?? "");
		expect(finalLocation.origin + finalLocation.pathname).toBe(REDIRECT_URI);
		expect(finalLocation.searchParams.get("code")).toEqual(expect.any(String));
	});
});
