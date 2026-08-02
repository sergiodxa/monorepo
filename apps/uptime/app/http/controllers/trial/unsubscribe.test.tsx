/**
 * Tests `/unsubscribe/:token`, whose two properties are both about what it refuses to do.
 *
 * The GET must not delete. Outlook Safe Links and Gmail's fetcher follow every URL in a
 * message before a human sees it, so a GET that unsubscribed would quietly forget people
 * who never clicked; the test walks the link the way a scanner would and asserts the lead
 * and its watch are still there afterwards.
 *
 * Neither method may say whether a token exists. An unknown token, an already-used one and
 * a live one all have to come back the same, or the URL becomes a way to find out which
 * tokens are real. Both are asserted against a database that actually holds a lead, so a
 * regression that starts 404ing shows up here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware } from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToString } from "remix/ui/server";

import Lead from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

import unsubscribe from "./unsubscribe";

type Db = ReturnType<typeof createTestDatabase>["db"];

/** Renders through `renderToString` — this page renders no `<Frame>`. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** A lead with one watch under it, which is what an unsubscribe has to take away. */
async function createFixture() {
	let { db } = createTestDatabase();

	let lead = await Lead.upsertByEmail(db, {
		email: "reader@example.com",
		locale: "en",
		consented: false,
	});
	await TrialWatch.create(db, lead.id, { url: "https://example.com/", last_status: "up" });

	return { db, lead };
}

/** Dispatches one request at the unsubscribe URL, with the method the test cares about. */
async function visit(db: Db, token: string, method: "GET" | "POST") {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			((ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			}) as Middleware,
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.trial.unsubscribe, unsubscribe);

	let href =
		method === "GET"
			? routes.trial.unsubscribe.index.href({ token })
			: routes.trial.unsubscribe.action.href({ token });

	let response = await container.scope(() =>
		router.fetch(new Request(`https://uptime.test${href}`, { method })),
	);

	return { response, body: await response.text() };
}

describe("GET /unsubscribe/:token", () => {
	test("asks for confirmation and offers a POST button", async () => {
		let { db, lead } = await createFixture();

		let { response, body } = await visit(db, lead.unsubscribe_token, "GET");

		expect(response.status).toBe(200);
		expect(body).toContain("Stop these emails?");
		expect(body).toContain('method="post"');
		expect(body).toContain(
			`action="${routes.trial.unsubscribe.action.href({ token: lead.unsubscribe_token })}"`,
		);
	});

	test("deletes nothing, so a mail scanner following the link changes nothing", async () => {
		let { db, lead } = await createFixture();

		await visit(db, lead.unsubscribe_token, "GET");

		expect(await Lead.findByEmail(db, "reader@example.com")).not.toBeNull();
		expect(await TrialWatch.listByLead(db, lead.id)).toHaveLength(1);
	});

	test("answers an unknown token with the same confirmation page", async () => {
		let { db } = await createFixture();

		let { response, body } = await visit(db, "not-a-real-token", "GET");

		expect(response.status).toBe(200);
		expect(body).toContain("Stop these emails?");
	});
});

describe("POST /unsubscribe/:token", () => {
	test("forgets the lead and everything attached to it", async () => {
		let { db, lead } = await createFixture();

		let { response, body } = await visit(db, lead.unsubscribe_token, "POST");

		expect(response.status).toBe(200);
		expect(body).toContain("You are unsubscribed");
		expect(await Lead.findByEmail(db, "reader@example.com")).toBeNull();
		expect(await TrialWatch.listByLead(db, lead.id)).toHaveLength(0);
	});

	test("answers an unknown token with the same page rather than an error", async () => {
		let { db } = await createFixture();

		let { response, body } = await visit(db, "not-a-real-token", "POST");

		expect(response.status).toBe(200);
		expect(body).toContain("You are unsubscribed");
	});

	test("answers a second click the way it answered the first", async () => {
		let { db, lead } = await createFixture();

		let first = await visit(db, lead.unsubscribe_token, "POST");
		let second = await visit(db, lead.unsubscribe_token, "POST");

		expect(second.response.status).toBe(first.response.status);
		expect(second.body).toContain("You are unsubscribed");
	});

	test("leaves another lead's data alone", async () => {
		let { db, lead } = await createFixture();
		let other = await Lead.upsertByEmail(db, {
			email: "other@example.com",
			locale: "en",
			consented: false,
		});
		await TrialWatch.create(db, other.id, { url: "https://other.example/", last_status: "up" });

		await visit(db, lead.unsubscribe_token, "POST");

		expect(await Lead.findByEmail(db, "other@example.com")).not.toBeNull();
		expect(await TrialWatch.listByLead(db, other.id)).toHaveLength(1);
	});
});
