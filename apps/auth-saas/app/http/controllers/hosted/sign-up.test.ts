/**
 * Drives the sign-up leg of the hosted flow through a real tenant router: a
 * fresh sign-up mints an unverified identifier and a working password,
 * landing on `/u/verify` with the new subject id, and the address it
 * verifies then signs in through a real authorization flow; a taken or
 * invalid email renders an error rather than crashing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SentMessage } from "@sdxc/mail";
import type { MemoryTransport } from "@sdxc/mail/memory";
import type { Result } from "@sdxc/result";

import { MailError } from "@sdxc/mail";
import { failure } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";

import {
	buildHarness,
	createTestClient,
	createTestSubjectWithPassword,
	REDIRECT_URI,
} from "~/app/http/controllers/hosted/test-harness";
import { VerifyAddressEmail } from "~/app/mail/verify-address-email";
import { subjectIdentifiers, subjects } from "~/database/subjects";

/** A transport that always refuses delivery, for exercising a failed sign-up send. */
class FailingTransport {
	async send(): Promise<Result<SentMessage, MailError>> {
		return failure(new MailError("the test transport always refuses"));
	}
}

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

describe("sign-up", () => {
	test("a fresh sign-up mints an unverified identifier and a password that signs in once verified", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);

		let signUpResponse = await harness.router.fetch(
			harness.request("/u/sign-up", {
				method: "POST",
				body: form({
					email: "jane@example.com",
					password: "correct horse battery staple",
					name: "Jane",
				}),
			}),
		);

		expect(signUpResponse.status).toBe(302);
		let verifyLocation = new URL(signUpResponse.headers.get("Location") ?? "");
		expect(verifyLocation.pathname).toBe("/u/verify");
		let subjectId = verifyLocation.searchParams.get("subject");
		expect(subjectId).toBeTruthy();

		let identifierRow = await harness.db.findOne(subjectIdentifiers, {
			where: { subject_id: subjectId ?? "", kind: "email" },
		});
		expect(identifierRow?.verified_at).toBeNull();
		let ticket = identifierRow?.verification_ticket;
		expect(ticket).toBeTruthy();

		let verifyResponse = await harness.router.fetch(harness.request(`/u/verify?ticket=${ticket}`));
		expect(verifyResponse.status).toBe(200);
		let verifyBody = await verifyResponse.text();
		expect(verifyBody).toContain("verified");

		let { signInPath } = await beginAndReachSignIn(harness, client.id);
		let signInResponse = await harness.router.fetch(
			harness.request(signInPath, {
				method: "POST",
				body: form({
					identifier: "jane@example.com",
					password: "correct horse battery staple",
					remember: "true",
				}),
			}),
		);

		expect(signInResponse.status).toBe(302);
		expect(signInResponse.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
	});

	test("signing up with a taken email renders an error instead of crashing", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let response = await harness.router.fetch(
			harness.request("/u/sign-up", {
				method: "POST",
				body: form({ email: "jane@example.com", password: "another strong password", name: "" }),
			}),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("already exists");
	});

	test("signing up with an invalid email renders an error instead of crashing", async () => {
		let response = await harness.router.fetch(
			harness.request("/u/sign-up", {
				method: "POST",
				body: form({
					email: "not-an-email",
					password: "correct horse battery staple",
					name: "",
				}),
			}),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("valid email");
	});

	test("sends a verification email carrying the minted ticket's link", async () => {
		let signUpResponse = await harness.router.fetch(
			harness.request("/u/sign-up", {
				method: "POST",
				body: form({
					email: "jane@example.com",
					password: "correct horse battery staple",
					name: "Jane",
				}),
			}),
		);

		let subjectId = new URL(signUpResponse.headers.get("Location") ?? "").searchParams.get(
			"subject",
		);
		let identifierRow = await harness.db.findOne(subjectIdentifiers, {
			where: { subject_id: subjectId ?? "", kind: "email" },
		});
		let ticket = identifierRow?.verification_ticket;
		expect(ticket).toBeTruthy();

		let transport = harness.mailTransport as MemoryTransport;
		expect(transport.messages).toHaveLength(1);
		let sent = transport.last;
		expect(sent?.to).toEqual([{ email: "jane@example.com" }]);
		expect(sent?.email).toBeInstanceOf(VerifyAddressEmail);
		expect(sent?.html).toContain(String(ticket));
	});

	test("a failed send still creates the subject and renders the distinct failure state", async () => {
		let failingHarness = await buildHarness({ transport: new FailingTransport() });

		let signUpResponse = await failingHarness.router.fetch(
			failingHarness.request("/u/sign-up", {
				method: "POST",
				body: form({
					email: "jane@example.com",
					password: "correct horse battery staple",
					name: "Jane",
				}),
			}),
		);

		expect(signUpResponse.status).toBe(302);
		let location = new URL(signUpResponse.headers.get("Location") ?? "");
		expect(location.searchParams.get("sendFailed")).toBe("1");

		let subjectId = location.searchParams.get("subject");
		let subjectRow = await failingHarness.db.find(subjects, { id: subjectId ?? "" });
		expect(subjectRow).toBeTruthy();

		let pendingResponse = await failingHarness.router.fetch(
			failingHarness.request(`${location.pathname}${location.search}`),
		);
		expect(pendingResponse.status).toBe(200);
		let body = await pendingResponse.text();
		expect(body).toContain("Your account was created");
	});
});
