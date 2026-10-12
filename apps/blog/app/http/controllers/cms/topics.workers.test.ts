/**
 * Tests topic management through the real router and D1, signed in as the author: creating a
 * topic from a search's prefilled form, the canonical query a save stores, the refusal a
 * colliding query earns, and a kind's topic keeping its slug and query and staying put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migratedDatabase } from "~/app/test/d1";
import { bindModels } from "~/app/test/models";
import { seedAdmin, signedInCookie } from "~/app/test/session";
import routes from "~/routes/web";

/** A tag only this file's topics search for, keeping them apart from other files' rows. */
const TAG = `cmstopic${generateUUID().slice(0, 8)}`;

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

/** Submits a CMS form as the signed-in author's browser would. */
function submit(path: string, fields: Record<string, string>) {
	let body = new FormData();
	for (let [name, value] of Object.entries(fields)) body.set(name, value);
	return fetchPath(path, {
		method: "POST",
		body,
		headers: { cookie, "sec-fetch-site": "same-origin" },
	});
}

let db: Database;
let cookie = "";

beforeAll(async () => {
	db = await migratedDatabase();
	cookie = await signedInCookie(await seedAdmin(db), environment().COOKIE_SESSION_SECRET);
});

describe("the topics CMS", () => {
	test("a search offers the author its topic form, prefilled with the query", async () => {
		let search = await fetchPath(`/search?q=tag:${TAG}`, { headers: { cookie } });
		let form = `${routes.cms.topics.new.href()}?q=tag%3A${TAG}`;
		expect(await search.text()).toContain(`href="${form}"`);

		let page = await (await fetchPath(form, { headers: { cookie } })).text();
		expect(page).toContain(`value="tag:${TAG}"`);
	});

	test("creates a topic under its canonical query, and refuses the same search again", async () => {
		let created = await submit(routes.cms.topics.create.href(), {
			title: `Tagged ${TAG}`,
			slug: "",
			query: `  TAG:${TAG.toUpperCase()} `,
			description: "",
		});
		expect(created.status).toBe(303);

		let topic = await bindModels(db).topics.findBy({ slug: `tagged-${TAG}` });
		expect(topic?.query).toBe(`tag:${TAG}`);

		let again = await submit(routes.cms.topics.create.href(), {
			title: "Again",
			slug: `again-${TAG}`,
			query: `tag:${TAG}`,
			description: "",
		});
		expect(again.status).toBe(422);

		let search = await fetchPath(`/search?q=tag:${TAG.toUpperCase()}`, { headers: { cookie } });
		expect(await search.text()).toContain(`href="/topics/tagged-${TAG}"`);
	});

	test("a kind's topic saves its title and description, keeps its slug and query, and stays", async () => {
		let articles = await bindModels(db).topics.findBy({ slug: "articles" });
		if (articles === null) throw new Error("the migration seeds the articles topic");

		let saved = await submit(routes.cms.topics.update.href({ id: articles.id }), {
			_method: "PUT",
			title: articles.title,
			slug: "essays",
			query: "kind:tutorial",
			description: "These are my articles, edited.",
		});
		expect(saved.status).toBe(303);

		let deleted = await submit(routes.cms.topics.destroy.href({ id: articles.id }), {
			_method: "DELETE",
		});
		expect(deleted.status).toBe(303);

		expect(await bindModels(db).topics.find(articles.id)).toMatchObject({
			slug: "articles",
			query: "kind:article",
			description: "These are my articles, edited.",
		});
		let restored = await submit(routes.cms.topics.update.href({ id: articles.id }), {
			_method: "PUT",
			title: articles.title,
			description: articles.description,
		});
		expect(restored.status).toBe(303);
	});
});
