/**
 * Drives the verify leg of the hosted flow through a real tenant router: a
 * valid ticket lands on a confirmation, an invalid one fails cleanly rather
 * than crashing, and the "check your email" screen's resend mints a fresh
 * ticket for the subject's own outstanding address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";

import { buildHarness } from "~/app/http/controllers/hosted/test-harness";

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

/** Creates a subject with one unverified email identifier and its outstanding ticket. */
async function createPendingSubject(harnessValue: Harness, email: string) {
	let created = await harnessValue.tenantDO.createSubject({
		identifiers: [{ kind: "email", value: email }],
	});
	if (!created.ok) throw new Error("unreachable");

	let added = await harnessValue.tenantDO.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("unreachable");

	return { subjectId: created.subjectId, ticket: added.ticket };
}

describe("verify", () => {
	test("a valid ticket renders a confirmation", async () => {
		let { ticket } = await createPendingSubject(harness, "jane@example.com");

		let response = await harness.router.fetch(harness.request(`/u/verify?ticket=${ticket}`));

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("verified");
	});

	test("an invalid ticket shows a clean error", async () => {
		let response = await harness.router.fetch(harness.request("/u/verify?ticket=does-not-exist"));

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("no longer works");
	});

	test("the check-your-email screen renders for a fresh sign-up's subject id", async () => {
		let { subjectId } = await createPendingSubject(harness, "jane@example.com");

		let response = await harness.router.fetch(harness.request(`/u/verify?subject=${subjectId}`));

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Check your email");
	});

	test("resending mints a fresh ticket for the same outstanding address", async () => {
		let { subjectId } = await createPendingSubject(harness, "jane@example.com");

		let resend = await harness.router.fetch(
			harness.request(`/u/verify/resend?subject=${subjectId}`, {
				method: "POST",
				body: new FormData(),
			}),
		);

		expect(resend.status).toBe(200);
		let body = await resend.text();
		expect(body).toContain("sent another");
	});

	test("a request naming neither a ticket nor a subject lands on /u/error", async () => {
		let response = await harness.router.fetch(harness.request("/u/verify"));

		expect(response.status).toBe(302);
		let location = new URL(response.headers.get("Location") ?? "");
		expect(location.pathname).toBe("/u/error");
	});
});
