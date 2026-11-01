/**
 * The content the development login writes the first time it signs in on a local database:
 * posts of every kind both live and scheduled, bookmarks with an
 * open flag, glossary terms, topics, redirects and a Webmention queue, so every screen has rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";

import type { BlogModels } from "~/app/models";

import { bookmarkAddress } from "~/app/models/post-values";
import { Redirect } from "~/app/models/redirect";

/** Milliseconds in a day, for placing seeded posts in time. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The site the seeded Webmentions target, matching the canonical origin posts live on. */
const SITE = "https://sergiodxa.com";

/** Long-form posts: a few live and two scheduled, so both status tabs count. */
const ARTICLES = [
	{ slug: "why-i-write-in-public", title: "Why I Write in Public", daysAgo: 40 },
	{ slug: "the-case-for-boring-tech", title: "The Case for Boring Technology", daysAgo: 21 },
	{ slug: "notes-on-remix-v3", title: "Notes on Remix v3", daysAgo: 6 },
	{ slug: "designing-a-cms-you-enjoy", title: "Designing a CMS You Enjoy Using", daysAgo: -5 },
	{ slug: "ideas-on-caching-at-the-edge", title: "Ideas on Caching at the Edge", daysAgo: -30 },
] as const;

/** Tutorials, tagged so the list shows them, live and scheduled. */
const TUTORIALS = [
	{
		slug: "validate-forms-with-data-schema",
		title: "Validate Forms with data-schema",
		tags: "remix,forms",
		daysAgo: 30,
	},
	{
		slug: "deploy-a-worker-with-d1",
		title: "Deploy a Worker with D1",
		tags: "cloudflare,d1",
		daysAgo: 12,
	},
	{
		slug: "write-a-session-middleware",
		title: "Write a Session Middleware",
		tags: "remix,auth",
		daysAgo: -2,
	},
	{
		slug: "test-workers-with-vitest",
		title: "Test Workers with Vitest",
		tags: "testing",
		daysAgo: -30,
	},
] as const;

/** Short posts: notes are a body alone, TILs carry a title. */
const NOTES = [
	{ content: "Shipped the new CMS shell today. The sidebar remembers its width now.", daysAgo: 1 },
	{ content: "Reading about local-first sync engines this week.", daysAgo: 9 },
	{ content: "Drafting a talk on progressive enhancement.", daysAgo: -30 },
] as const;

const TILS = [
	{ slug: "css-has-selector", title: "The :has() selector styles a parent", daysAgo: 3 },
	{
		slug: "popover-api-light-dismiss",
		title: "Popovers close on outside click for free",
		daysAgo: 15,
	},
	{ slug: "sqlite-strict-tables", title: "SQLite STRICT tables reject loose types", daysAgo: -30 },
] as const;

/** Glossary terms with a one-line definition each. */
const GLOSSARY = [
	{
		slug: "edge",
		term: "Edge",
		definition: "Servers close to the visitor that answer before the origin.",
	},
	{
		slug: "hydration",
		term: "Hydration",
		definition: "Attaching behavior to HTML the server already rendered.",
	},
	{
		slug: "idempotent",
		term: "Idempotent",
		definition: "An operation whose repeat leaves the same result.",
	},
	{
		slug: "webmention",
		term: "Webmention",
		definition: "A notification that one page links to another.",
	},
] as const;

/** Bookmarks, two with a flag awaiting review so the queue has something to resolve. */
const BOOKMARKS = [
	{ url: "https://remix.run/blog", title: "Remix Blog", status: "ok" },
	{ url: "https://developers.cloudflare.com/d1/", title: "Cloudflare D1 docs", status: "ok" },
	{ url: "https://web.dev/articles/baseline", title: "Baseline", status: "ok" },
	{ url: "https://example.com/an-old-essay", title: "An Old Essay", status: "gone" },
	{ url: "https://example.com/moved-post", title: "A Post That Moved", status: "moved" },
] as const;

/** Author topics: saved searches with their own page. */
const TOPICS = [
	{
		slug: "remix",
		title: "Remix",
		description: "Everything about building with Remix.",
		query: "tag:remix",
	},
	{ slug: "testing", title: "Testing", description: "How I test web apps.", query: "tag:testing" },
] as const;

/** Redirects from retired paths, one of each status the form offers. */
const REDIRECTS = [
	{ from: "/blog/why-i-write", to: "/articles/why-i-write-in-public", status: 301 },
	{ from: "/talks", to: "/press", status: 302 },
	{ from: "/old-tutorials/d1", to: "/tutorials/deploy-a-worker-with-d1", status: 308 },
] as const;

/** Webmentions in every moderation state, from made-up sources. */
const MENTIONS = [
	{
		author: "Ana Lima",
		kind: "reply",
		text: "Great write-up, this matches my experience.",
		status: "pending",
	},
	{
		author: "Ken Ito",
		kind: "mention",
		text: "Linked this from my weekly roundup.",
		status: "pending",
	},
	{ author: "Sam Rivera", kind: "like", text: null, status: "approved" },
	{ author: "Spam Bot", kind: "mention", text: "Buy followers now", status: "rejected" },
] as const;

/** The publish date `daysAgo` days back, or ahead for a negative count, which schedules it. */
function publishedAt(now: number, daysAgo: number): string {
	return new Date(now - daysAgo * DAY_MS).toISOString();
}

/** A paragraph of Markdown, so an editor opens on a body with some length. */
function body(title: string): string {
	return `${title} starts here.\n\nThis is seeded content for local development. It has a heading, a list and a code block so the editor and the preview have something to render.\n\n## A section\n\n- One point\n- Another point\n\n\`\`\`ts\nlet answer = 42;\n\`\`\`\n`;
}

/**
 * Writes the seed content under `authorId`. Each run writes new rows, so the development login
 * calls it once, when it creates the account.
 *
 * @param models The request's models.
 * @param authorId The account every seeded post is written by.
 * @param redirects The `REDIRECTS` namespace the redirect rules are written to.
 */
export async function seedDevContent(
	models: BlogModels,
	authorId: string,
	redirects: KVNamespace,
): Promise<void> {
	let now = Date.now();
	let articleIds: string[] = [];

	for (let article of ARTICLES) {
		let created = unwrap(
			await models.articles.create({
				author_id: authorId,
				published_at: publishedAt(now, article.daysAgo),
				meta: {
					slug: article.slug,
					title: article.title,
					locale: "en",
					content: body(article.title),
					excerpt: `A short summary of ${article.title.toLowerCase()}.`,
				},
			}),
		);
		articleIds.push(created.id);
	}

	for (let tutorial of TUTORIALS) {
		unwrap(
			await models.tutorials.create({
				author_id: authorId,
				published_at: publishedAt(now, tutorial.daysAgo),
				meta: {
					slug: tutorial.slug,
					title: tutorial.title,
					excerpt: `Learn to ${tutorial.title.toLowerCase()}.`,
					content: body(tutorial.title),
					tags: tutorial.tags,
				},
			}),
		);
	}

	for (let note of NOTES) {
		let at = publishedAt(now, note.daysAgo);
		unwrap(
			await models.notes.create({
				author_id: authorId,
				published_at: at,
				meta: { slug: await models.notes.nextSlug(at), content: note.content },
			}),
		);
	}

	for (let til of TILS) {
		unwrap(
			await models.tils.create({
				author_id: authorId,
				published_at: publishedAt(now, til.daysAgo),
				meta: { slug: til.slug, title: til.title, content: body(til.title), tags: "web" },
			}),
		);
	}

	for (let term of GLOSSARY) {
		unwrap(
			await models.glossary.create({
				author_id: authorId,
				published_at: publishedAt(now, 20),
				meta: { ...term, title: term.term },
			}),
		);
	}

	for (let bookmark of BOOKMARKS) {
		let created = unwrap(
			await models.likes.create({
				author_id: authorId,
				published_at: publishedAt(now, 2),
				meta: { url: bookmark.url, title: bookmark.title, description: "" },
			}),
		);
		let httpStatus = { ok: 200, gone: 404, moved: 301 }[bookmark.status];
		let finalUrl = bookmark.status === "moved" ? `${bookmark.url}-v2` : bookmark.url;
		let reading = { status: bookmark.status, httpStatus, finalUrl };
		await models.bookmarks.claim(created.id, bookmarkAddress(bookmark.url), reading);
		await models.bookmarks.record(created.id, reading);
	}

	unwrap(
		await models.releases.create({
			author_id: authorId,
			published_at: publishedAt(now, 4),
			meta: {
				slug: "week-44",
				title: "Releases of the week",
				content: "- [@sdxc/ui](https://www.npmjs.com/package/@sdxc/ui)",
				packages: [{ name: "@sdxc/ui", url: "https://www.npmjs.com/package/@sdxc/ui" }],
			},
		}),
	);

	for (let topic of TOPICS) unwrap(await models.topics.create(topic));

	for (let redirect of REDIRECTS) await Redirect.upsert(redirects, redirect);

	for (let [index, mention] of MENTIONS.entries()) {
		let postId = articleIds[index % 3] ?? "";
		let source = `https://example.com/${mention.author.toLowerCase().replace(" ", "-")}/post-${index}`;
		let written = await models.webmentions.record({
			postId,
			pair: {
				source: new URL(source),
				target: new URL(`/articles/${ARTICLES[index % 3]?.slug ?? ""}`, SITE),
			},
			mention: {
				kind: mention.kind,
				url: source,
				author: { name: mention.author, url: "https://example.com", photo: null },
				content:
					mention.text === null ? null : { html: `<p>${mention.text}</p>`, text: mention.text },
				name: null,
				published: new Date(now - index * DAY_MS),
			},
			status: "pending",
		});
		if (mention.status !== "pending")
			await models.webmentions.setStatus(written.id, mention.status);
	}
}
