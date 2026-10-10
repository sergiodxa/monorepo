/**
 * Drives the Webmention surface through the real router inside workerd, against the
 * local D1, queue and rate-limit bindings: the endpoint's answers, the endpoint every
 * post advertises, approved mentions under a post, and the 410 a deleted post answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { ArticlePost } from "~/app/repositories/posts/article";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";
const RUN = crypto.randomUUID().slice(0, 8);
const LIVE = `mentioned-${RUN}`;
const DELETED = `deleted-${RUN}`;
const WITHDRAWN = `withdrawn-${RUN}`;

let db: Database;
let liveId: string;
let withdrawnId: string;

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
		WEBMENTION_RATE_LIMITER: env.WEBMENTION_RATE_LIMITER,
		waitUntil: () => {},
	};
}

/** Sends one request through the router the Worker entrypoint builds. */
function fetchPath(path: string, init?: RequestInit) {
	return createApplication(environment()).fetch(new Request(new URL(path, ORIGIN), init));
}

/** Posts a form-encoded Webmention request. */
function sendMention(source: string, target: string) {
	return fetchPath("/webmention", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ source, target }),
	});
}

beforeAll(async () => {
	db = await migratedDatabase();
	let author = await seedAuthor(db);
	let meta = { locale: "en", content: "Body" };
	let live = await ArticlePost.create(db, {
		author_id: author,
		published_at: null,
		meta: { ...meta, slug: LIVE, title: "Mentioned" },
	});
	let deleted = await ArticlePost.create(db, {
		author_id: author,
		published_at: null,
		meta: { ...meta, slug: DELETED, title: "Deleted" },
	});
	let withdrawn = await ArticlePost.create(db, {
		author_id: author,
		published_at: null,
		meta: { ...meta, slug: WITHDRAWN, title: "Withdrawn" },
	});
	liveId = live!.id;
	withdrawnId = withdrawn!.id;
	await ArticlePost.destroy(db, deleted!.id);
});

describe("POST /webmention", () => {
	/**
	 * The local queue delivers the verification to the worker's consumer, so the post is
	 * deleted once accepted: the job then acknowledges it without fetching the source.
	 */
	test("accepts a mention of a published post for verification", async () => {
		let response = await sendMention(
			"https://replies.example.com/1",
			`${ORIGIN}/articles/${WITHDRAWN}`,
		);
		await ArticlePost.destroy(db, withdrawnId);

		expect(response.status).toBe(202);
	});

	/**
	 * A reserved name such as `.example` never denotes a public host, so the source is
	 * refused before any verification is queued, whatever the target.
	 */
	test("rejects a source on a reserved name", async () => {
		let response = await sendMention("https://replies.example/1", `${ORIGIN}/articles/${LIVE}`);

		expect(response.status).toBe(400);
	});

	test("rejects a target that is not a post on this site", async () => {
		let response = await sendMention(
			"https://replies.example.com/1",
			`${ORIGIN}/articles/nope-${RUN}`,
		);

		expect(response.status).toBe(400);
	});

	test("rejects a deleted post as a target", async () => {
		let response = await sendMention(
			"https://replies.example.com/1",
			`${ORIGIN}/articles/${DELETED}`,
		);

		expect(response.status).toBe(400);
	});

	test("rejects a body that is not form-encoded", async () => {
		let response = await fetchPath("/webmention", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ source: "https://replies.example.com/1", target: ORIGIN }),
		});

		expect(response.status).toBe(400);
	});
});

describe("a post page", () => {
	test("advertises the endpoint in a Link header and in <head>", async () => {
		let response = await fetchPath(`/articles/${LIVE}`);

		expect(response.headers.get("link")).toBe(`<${ORIGIN}/webmention>; rel="webmention"`);
		expect(await response.text()).toContain('<link rel="webmention" href="/webmention"');
	});

	test("shows approved mentions and hides the rest", async () => {
		let target = new URL(`${ORIGIN}/articles/${LIVE}`);
		let mention = (name: string) => ({
			kind: "reply" as const,
			url: `https://replies.example.com/${name}`,
			author: { name, url: "https://replies.example.com", photo: null },
			content: { html: `<p>From ${name}</p>`, text: `From ${name}` },
			name: null,
			published: null,
		});
		await bindModels(db).webmentions.record({
			postId: liveId,
			pair: { source: new URL("https://replies.example.com/approved"), target },
			mention: mention("Approved Author"),
			status: "approved",
		});
		await bindModels(db).webmentions.record({
			postId: liveId,
			pair: { source: new URL("https://replies.example.com/pending"), target },
			mention: mention("Pending Author"),
			status: "pending",
		});

		let html = await (await fetchPath(`/articles/${LIVE}`)).text();

		expect(html).toContain("Approved Author");
		expect(html).toContain("<p>From Approved Author</p>");
		expect(html).not.toContain("Pending Author");
	});

	test("answers 410 Gone once its post is deleted", async () => {
		let response = await fetchPath(`/articles/${DELETED}`);

		expect(response.status).toBe(410);
	});
});
