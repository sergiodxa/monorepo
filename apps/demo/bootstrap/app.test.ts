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

/**
 * Host the captcha provider serves its own widget from. The board links one script of its
 * own, so a tag from anywhere else is a regression; the challenge's is the one exception,
 * and it is only ever rendered when a Turnstile site key is configured.
 */
const TURNSTILE_HOST = "challenges.cloudflare.com";

/** What the board's own `<script>` points at, which is the client entry and nothing else. */
const CLIENT_ENTRY_SRC = "/bootstrap/browser.ts";

/** Every opening `<script>` tag in a rendered document, in source order. */
function scriptTags(html: string): string[] {
	return [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
}

/**
 * The script tags a document asks the browser to run, which is what "shipping script"
 * means. A `application/json` block is the hydration record the island reads and runs
 * nothing, and the captcha's widget is served by the provider rather than by the board.
 */
function executableScripts(html: string): string[] {
	return scriptTags(html).filter(
		(tag) => !tag.includes("application/json") && !tag.includes(TURNSTILE_HOST),
	);
}

/** A description with Markdown a renderer has to do something with to produce {@link RENDERED_DESCRIPTION}. */
const MARKDOWN_DESCRIPTION = "We build **things** with Remix v3 and we would like your help.";

/** What {@link MARKDOWN_DESCRIPTION} looks like once it has been rendered. */
const RENDERED_DESCRIPTION = "<strong>things</strong>";

/** Publishes a posting whose body only a Markdown pass turns into {@link RENDERED_DESCRIPTION}. */
async function publishMarkdownPosting() {
	return await Job.publish(db, {
		title: "Senior Remix Engineer",
		company: "Acme",
		location: "Remote",
		salary: "$150k – $180k",
		description: MARKDOWN_DESCRIPTION,
		contact_email: "hiring@acme.test",
	});
}

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

test("gives every position a dialog and a link that reaches it without script", async () => {
	let posting = await publishMarkdownPosting();

	let html = await (await fetchApp(db, "/")).text();
	let dialogId = `posting-${posting.id}`;

	expect(html).toMatch(new RegExp(`<dialog[^>]*id="${dialogId}"`));
	expect(html).toMatch(new RegExp(`<a[^>]*href="/positions/${posting.id}"`));
});

test("keeps every posting's description off the listing", async () => {
	let posting = await publishMarkdownPosting();

	let html = await (await fetchApp(db, "/")).text();

	expect(html).toContain(posting.title);
	expect(html).not.toContain(RENDERED_DESCRIPTION);
	expect(html).not.toContain(MARKDOWN_DESCRIPTION);
});

test("renders one position on its own, formatted", async () => {
	let posting = await publishMarkdownPosting();

	let response = await fetchApp(db, `/positions/${posting.id}`);
	let html = await response.text();

	expect(response.status).toBe(200);
	expect(html).toContain(posting.title);
	expect(html).toContain(RENDERED_DESCRIPTION);
	expect(html).toContain(`mailto:${posting.contact_email}`);
});

test("answers a frame with the detail alone", async () => {
	let posting = await publishMarkdownPosting();

	let html = await (await fetchApp(db, `/positions/${posting.id}?frame`)).text();

	expect(html).toContain(RENDERED_DESCRIPTION);
	expect(html).not.toContain("<!DOCTYPE html>");
	expect(html).not.toContain("<body");
});

test("answers 404 for a position that is not there", async () => {
	let response = await fetchApp(db, "/positions/job_missing");

	expect(response.status).toBe(404);
});

test("reopens the form with the reason when a submission is refused", async () => {
	let body = submission({ contact_email: "not-an-address" });
	let response = await fetchApp(db, "/", { method: "POST", body });
	let html = await response.text();

	expect(response.status).toBe(400);
	expect(await Job.listOpen(db, 10)).toHaveLength(0);
	expect(html).toMatch(
		/<dialog[^>]*\sopen(?=[\s>])[^>]*id="post-a-job"|<dialog[^>]*id="post-a-job"[^>]*\sopen(?=[\s>])/,
	);
	expect(html).toContain("Every field is required");
});

/**
 * A dialog opened with `showModal()` stays modal through an in-place update, since being
 * modal is state the markup never carries; a whole-document submission is what closes it.
 */
test("submits the post form as a whole document, so publishing closes its dialog", async () => {
	let html = await (await fetchApp(db, "/")).text();

	expect(html).toMatch(/<form[^>]*method="post"[^>]*data-rmx-document/);
});

/**
 * The board carries one island — the frame that fills a position's dialog — so it links the
 * client entry and nothing else. Every other page is complete as the server sent it, and a
 * script tag on one of them would be a bundle downloaded to do nothing.
 */
test("ships the client entry on the board and no script anywhere else", async () => {
	let posting = await publishMarkdownPosting();

	let board = await (await fetchApp(db, "/")).text();
	let position = await (await fetchApp(db, `/positions/${posting.id}`)).text();
	let outbox = await (await fetchApp(db, "/outbox")).text();

	let ownScripts = executableScripts(board);

	expect(ownScripts).toHaveLength(1);
	expect(ownScripts[0]).toContain(CLIENT_ENTRY_SRC);

	expect(executableScripts(position)).toEqual([]);
	expect(scriptTags(position)).toEqual([]);
	expect(scriptTags(outbox)).toEqual([]);
});
