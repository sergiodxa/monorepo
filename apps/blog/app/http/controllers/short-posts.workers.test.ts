/**
 * Tests for notes and TILs through the real router and D1: writing them in the CMS under X's
 * limit, their permalinks with the replies they received, the home page and topic pages
 * reading them in place, the global feed, and the `Note` their permalink negotiates to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { noteSlugAt } from "~/app/models/notes";
import { serializeTags } from "~/app/models/post-values";
import { findMentionable } from "~/app/services/posts";
import { discussIntent, shortShareText, shareIntent } from "~/app/services/share";
import { permalink } from "~/app/services/webmention";
import { migratedDatabase } from "~/app/test/d1";
import { bindModels } from "~/app/test/models";
import { seedAdmin, signedInCookie } from "~/app/test/session";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/** A suffix keeping these slugs and contents apart from other files sharing the storage. */
const SUFFIX = generateUUID().slice(0, 8);

/** The TIL every test reads. */
const TIL_SLUG = `til-${SUFFIX}`;

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => {},
	};
}

/** Builds the router and sends one request through it, the way the Worker entrypoint does. */
function fetchPath(path: string, init?: RequestInit) {
	return createWebRouter(environment()).fetch(
		new Request(new URL(path, "https://blog.test"), init),
	);
}

/** `href` as the HTML escapes it inside an attribute. */
function attribute(href: string): string {
	return href.replaceAll("&", "&amp;");
}

let db: Database;
let adminId = "";
let cookie = "";
let noteId = "";
let noteSlug = "";

/** Sends the CMS form as the signed-in admin's browser would, from the CMS itself. */
function submit(path: string, fields: Record<string, string>) {
	let body = new FormData();
	for (let [name, value] of Object.entries(fields)) body.set(name, value);
	return fetchPath(path, {
		method: "POST",
		body,
		headers: { cookie, "sec-fetch-site": "same-origin" },
	});
}

beforeAll(async () => {
	db = await migratedDatabase();
	adminId = await seedAdmin(db);
	cookie = await signedInCookie(adminId, environment().COOKIE_SESSION_SECRET);

	noteSlug = await bindModels(db).notes.nextSlug(null);
	let note = unwrap(
		await bindModels(db).notes.create({
			author_id: adminId,
			published_at: null,
			meta: { slug: noteSlug, content: `Note ${SUFFIX} reads **the docs**.` },
		}),
	);
	noteId = note?.id ?? "";

	unwrap(
		await bindModels(db).tils.create({
			author_id: adminId,
			published_at: null,
			meta: {
				slug: TIL_SLUG,
				title: `Remix frames ${SUFFIX}`,
				content: "a frame resolves through `ctx.router.fetch()`.",
				tags: serializeTags(["Remix"]),
			},
		}),
	);
});

describe("writing a note in the CMS", () => {
	test("gives a second note in the same second its own slug, a digit appended", async () => {
		let notes = bindModels(db).notes;
		let at = new Date(Date.UTC(2026, 9, 12, 12)).toISOString();
		let first = await notes.nextSlug(at);
		unwrap(
			await notes.create({
				author_id: adminId,
				published_at: at,
				meta: { slug: first, content: "first" },
			}),
		);
		expect(first).toBe(noteSlugAt(Date.parse(at)));
		expect(await notes.nextSlug(at)).toBe(`${first}1`);
	});

	test("refuses content too long for X, naming how much to cut and keeping it", async () => {
		let content = "b".repeat(257);
		let response = await submit(routes.cms.notes.index.href(), { content });
		let body = await response.text();

		expect(response.status).toBe(422);
		expect(body).toContain("The content is 1 characters too long to share on X");
		expect(body).toContain(content);
	});

	test("offers a note's share text as Post on X, its link a bare URL", async () => {
		let slug = `linked-${SUFFIX}`;
		let content = `Linked ${SUFFIX} [the docs](https://remix.run/docs).`;
		unwrap(
			await bindModels(db).notes.create({
				author_id: adminId,
				published_at: null,
				meta: { slug, content },
			}),
		);
		let response = await fetchPath(routes.cms.notes.index.href(), { headers: { cookie } });
		let body = await response.text();
		let text = shortShareText({
			kind: "note",
			content,
			permalink: permalink({ postType: "notes", slug }).href,
		});

		expect(text).toBe(
			`Linked ${SUFFIX} https://remix.run/docs. ${PROFILE.canonical.origin}/notes/${slug}`,
		);
		expect(body).toContain(attribute(shareIntent(text)));
	});
});

describe("a note's permalink", () => {
	test("renders its content with Discuss on X on the canonical permalink", async () => {
		let response = await fetchPath(`/notes/${noteSlug}`);
		let body = await response.text();
		let url = permalink({ postType: "notes", slug: noteSlug }).href;

		expect(response.status).toBe(200);
		expect(body).toContain(`Note ${SUFFIX} reads`);
		expect(body).toContain(
			attribute(discussIntent({ title: `Note ${SUFFIX} reads the docs.`, permalink: url })),
		);
		expect(body).not.toContain("<h1");
	});

	test("shows a Fediverse reply received for it", async () => {
		let target = permalink({ postType: "notes", slug: noteSlug });
		let found = await findMentionable(bindModels(db), target, PROFILE.canonical.origin);
		expect(found?.id).toBe(noteId);

		unwrap(
			await bindModels(db).webmentions.create({
				post_id: noteId,
				source: `https://mastodon.social/@reader/${SUFFIX}`,
				target: target.href,
				status: "approved",
				kind: "reply",
				url: `https://mastodon.social/@reader/${SUFFIX}`,
				author_name: "A Reader",
				author_url: "https://mastodon.social/@reader",
				author_photo: null,
				name: null,
				content_html: `<p>Replying to ${SUFFIX}</p>`,
				content_text: `Replying to ${SUFFIX}`,
				published_at: null,
			}),
		);

		let body = await (await fetchPath(`/notes/${noteSlug}`)).text();
		expect(body).toContain(`Replying to ${SUFFIX}`);
		expect(body).toContain("A Reader");
	});

	test("negotiates to an ActivityPub Note", async () => {
		let response = await fetchPath(`/notes/${noteSlug}`, {
			headers: { accept: "application/activity+json" },
		});
		let document: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(document).toMatchObject({
			type: "Note",
			id: permalink({ postType: "notes", slug: noteSlug }).href,
		});
	});
});

describe("a TIL's permalink", () => {
	test("heads with its title and lists its tags above the content", async () => {
		let body = await (await fetchPath(`/til/${TIL_SLUG}`)).text();

		expect(body).toContain(`Remix frames ${SUFFIX}`);
		expect(body).toContain("<h1");
		expect(body).toContain("Remix");
		expect(body).toContain("ctx.router.fetch()");
	});
});

describe("reading notes and TILs in lists", () => {
	test("shows them in place on the home page, the date linking to the permalink", async () => {
		let body = await (await fetchPath("/")).text();

		expect(body).toContain(`Note ${SUFFIX} reads`);
		expect(body).toContain(`href="/notes/${noteSlug}"`);
		expect(body).toContain(`Remix frames ${SUFFIX}`);
		expect(body).toContain(`href="/til/${TIL_SLUG}"`);
	});

	test("lists each on its kind's topic page", async () => {
		let notes = await fetchPath("/notes");
		let til = await fetchPath("/til");

		expect(notes.status).toBe(200);
		expect(await notes.text()).toContain(`Note ${SUFFIX} reads`);
		expect(til.status).toBe(200);
		expect(await til.text()).toContain(`Remix frames ${SUFFIX}`);
	});

	test("carries them in the global feed, a note titled by its content", async () => {
		let body = await (await fetchPath("/rss")).text();

		expect(body).toContain(`Note ${SUFFIX} reads the docs.`);
		expect(body).toContain(`TIL Remix frames ${SUFFIX}`);
	});
});
