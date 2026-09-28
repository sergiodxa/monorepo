/**
 * Drives the board end to end: the listing a visitor lands on, and a submission that has to
 * clear the captcha, reach the database, and leave a confirmation in the outbox. The
 * confirmation is what proves the background job ran, since the job is what sends it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, expect, test } from "vitest";

import Job from "~/app/data/posting";
import { cache, LISTING_KEY } from "~/app/lib/cache";
import { LOCAL_ANSWER, LOCAL_FIELD } from "~/app/lib/captcha";
import { outbox } from "~/app/lib/mailer";
import { createTestDatabase, fetchApp } from "~/app/lib/test/router";

/** A complete submission, as the form sends it. */
function submission(overrides: Record<string, string> = {}): URLSearchParams {
	return new URLSearchParams({
		title: "Senior Remix Engineer",
		company: "Acme",
		location: "Remote",
		salary: "$150k – $180k",
		description: "We build **things** with Remix v3 and we would like your help.",
		contact_email: "hiring@acme.test",
		[LOCAL_FIELD]: LOCAL_ANSWER,
		...overrides,
	});
}

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
	outbox.clear();
	await cache.delete(LISTING_KEY);
});

test("lists the open positions", async () => {
	await Job.publish(db, {
		title: "Senior Remix Engineer",
		company: "Acme",
		location: "Remote",
		salary: "$150k – $180k",
		description: "We build things with Remix v3.",
		contact_email: "hiring@acme.test",
	});

	let response = await fetchApp(db, "/");
	let html = await response.text();

	expect(response.status).toBe(200);
	expect(html).toContain("Senior Remix Engineer");
	expect(html).toContain("Acme");
});

test("publishes a submission and mails the poster", async () => {
	let response = await fetchApp(db, "/", { method: "POST", body: submission() });

	expect(response.status).toBe(303);
	expect(await Job.listOpen(db, 10)).toHaveLength(1);

	expect(outbox.messages).toHaveLength(1);
	expect(outbox.messages[0]?.to[0]?.email).toBe("hiring@acme.test");
	expect(outbox.messages[0]?.subject).toContain("Senior Remix Engineer");
});

test("refuses a submission that fails the captcha", async () => {
	let body = submission({ [LOCAL_FIELD]: "not-the-answer" });
	let response = await fetchApp(db, "/", { method: "POST", body });

	expect(response.status).toBe(403);
	expect(await Job.listOpen(db, 10)).toHaveLength(0);
	expect(outbox.messages).toHaveLength(0);
});
