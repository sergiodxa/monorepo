/**
 * Tests `/unsubscribe/:token`. A GET only renders: Outlook Safe Links and Gmail's fetcher
 * follow every URL in a message before a human sees it, so the test walks the link the
 * way a scanner would and confirms the lead and its watch both survive the visit.
 *
 * Every response looks the same whether a token is real, already used, or unknown, so
 * the URL can't become a way to find out which tokens are live. Both are asserted
 * against a database that actually holds a lead, so a regression that starts 404ing
 * shows up here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";

import { unwrap } from "@sdxc/result";
import { renderToString } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { withDocumentAssets } from "~/app/lib/test/document-assets";
import { bindModels } from "~/app/lib/test/models";
import routes from "~/routes/web";

import unsubscribe from "./unsubscribe";

type Db = ReturnType<typeof createTestDatabase>["db"];

/** Renders through `renderToString`, which suffices for a page built from plain HTML. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(await withDocumentAssets(node));
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Records a lead for an address the way the trial form does. */
async function addLead(db: Db, email: string) {
	return unwrap(
		await bindModels(db).leads.upsertByEmail({ email, locale: "en", consented: false }),
	);
}

/** Starts watching a URL for a lead, seeded as last seen up. */
async function addWatch(db: Db, leadId: string, url: string) {
	return unwrap(
		await bindModels(db).trialWatches.create({ lead_id: leadId, url, last_status: "up" }),
	);
}

/** A lead with one watch under it, which is what an unsubscribe has to take away. */
async function createFixture() {
	let { db } = createTestDatabase();

	let lead = await addLead(db, "reader@example.com");
	await addWatch(db, lead.id, "https://example.com/");

	return { db, lead };
}

/** Dispatches one request at the unsubscribe URL, with the method the test cares about. */
async function visit(db: Db, token: string, method: "GET" | "POST", body?: string) {
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(() => db),
			models(),
			((ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			}) as Middleware,
			i18n as Middleware,
			formData() as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.trial.unsubscribe, unsubscribe);

	let href =
		method === "GET"
			? routes.trial.unsubscribe.index.href({ token })
			: routes.trial.unsubscribe.action.href({ token });

	let init: RequestInit =
		body === undefined
			? { method }
			: { method, headers: { "content-type": "application/x-www-form-urlencoded" }, body };
	let response = await router.fetch(new Request(`https://uptime.test${href}`, init));

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

		expect(await bindModels(db).leads.findByEmail("reader@example.com")).not.toBeNull();
		expect(await bindModels(db).trialWatches.listByLead(lead.id)).toHaveLength(1);
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
		expect(await bindModels(db).leads.findByEmail("reader@example.com")).toBeNull();
		expect(await bindModels(db).trialWatches.listByLead(lead.id)).toHaveLength(0);
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

	test("answers a mailbox provider's one-click POST with an empty 200", async () => {
		let { db, lead } = await createFixture();

		let { response, body } = await visit(
			db,
			lead.unsubscribe_token,
			"POST",
			"List-Unsubscribe=One-Click",
		);

		expect(response.status).toBe(200);
		expect(body).toBe("");
		expect(await bindModels(db).leads.findByEmail("reader@example.com")).toBeNull();
	});

	test("leaves another lead's data alone", async () => {
		let { db, lead } = await createFixture();
		let other = await addLead(db, "other@example.com");
		await addWatch(db, other.id, "https://other.example/");

		await visit(db, lead.unsubscribe_token, "POST");

		expect(await bindModels(db).leads.findByEmail("other@example.com")).not.toBeNull();
		expect(await bindModels(db).trialWatches.listByLead(other.id)).toHaveLength(1);
	});
});
