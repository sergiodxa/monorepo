/**
 * Drives the second-factor leg of the hosted flow through a real tenant router:
 * a subject with an active TOTP factor is routed from `/u/sign-in` to
 * `/u/second-factor` rather than straight to the redirect, a correct code
 * completes it, and a wrong code re-renders the same page with an error.
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

/** Enrols and activates a TOTP factor for the subject, returning its setup key. */
async function enrolFactor(harnessValue: Harness, subjectId: string): Promise<string> {
	let begun = await harnessValue.tenantDO.beginTotpEnrolment({ subjectId });
	if (!begun.ok) throw new Error("unreachable");

	let code = await totp.code(begun.setupKey);
	if (isFailure(code)) throw new Error("unreachable");

	let activated = await harnessValue.tenantDO.activateTotpFactor({
		enrolmentId: begun.enrolmentId,
		code: code.data,
	});
	if (!activated.ok) throw new Error("unreachable");

	return begun.setupKey;
}

/** A `POST` form body. */
function form(fields: Record<string, string>): FormData {
	let body = new FormData();
	for (let [key, value] of Object.entries(fields)) body.set(key, value);
	return body;
}

/** Signs a subject in with a password, following the flow through to `/u/second-factor`. */
async function signInToSecondFactor(
	harnessValue: Harness,
	clientId: string,
	identifier: string,
	password: string,
): Promise<{ secondFactorPath: string; sessionCookie: string }> {
	let authorize = await harnessValue.router.fetch(
		harnessValue.request(`/authorize?${authorizeQuery(clientId)}`),
	);
	let authorizeLocation = new URL(authorize.headers.get("Location") ?? "", REDIRECT_URI);
	let interactionId = authorizeLocation.searchParams.get("interaction");
	if (!interactionId) throw new Error("expected an interaction id");

	let signInResponse = await harnessValue.router.fetch(
		harnessValue.request(`${authorizeLocation.pathname}${authorizeLocation.search}`, {
			method: "POST",
			body: form({ identifier, password, remember: "true" }),
		}),
	);

	expect(signInResponse.status).toBe(302);
	let sessionCookie = signInResponse.headers.get("Set-Cookie");
	if (!sessionCookie) throw new Error("expected a session cookie");

	let location = new URL(signInResponse.headers.get("Location") ?? "", REDIRECT_URI);
	expect(location.pathname).toBe("/u/second-factor");

	return {
		secondFactorPath: `${location.pathname}${location.search}`,
		sessionCookie: sessionCookie.split(";")[0] ?? "",
	};
}

describe("second-factor", () => {
	test("a subject with an active factor is routed to /u/second-factor, and a correct code completes it", async () => {
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
		let setupKey = await enrolFactor(harness, subjectId);

		let { secondFactorPath, sessionCookie } = await signInToSecondFactor(
			harness,
			client.id,
			"jane@example.com",
			"correct horse battery staple",
		);

		let code = await totp.code(setupKey);
		if (isFailure(code)) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(secondFactorPath, {
				method: "POST",
				cookie: sessionCookie,
				body: form({ submission: code.data }),
			}),
		);

		expect(response.status).toBe(302);
		let location = new URL(response.headers.get("Location") ?? "");
		expect(location.origin + location.pathname).toBe(REDIRECT_URI);
		expect(location.searchParams.get("code")).toEqual(expect.any(String));
	});

	test("a wrong code re-renders the same page with an error", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		let subjectId = await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});
		await enrolFactor(harness, subjectId);

		let { secondFactorPath, sessionCookie } = await signInToSecondFactor(
			harness,
			client.id,
			"jane@example.com",
			"correct horse battery staple",
		);

		let response = await harness.router.fetch(
			harness.request(secondFactorPath, {
				method: "POST",
				cookie: sessionCookie,
				body: form({ submission: "000000" }),
			}),
		);

		expect(response.status).toBe(400);
	});
});
