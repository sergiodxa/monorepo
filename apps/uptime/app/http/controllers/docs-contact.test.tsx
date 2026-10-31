/**
 * Tests the docs contact form: the page carries the page the reader came from, a valid
 * question emails the support inbox with the reader as reply-to, an invalid one comes back
 * with its errors, and a filled trap is thanked without sending anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";

import { database } from "@sdxc/database-middleware";
import { log } from "@sdxc/logger/middleware";
import { MemoryTransport } from "@sdxc/mail/memory";
import mail from "@sdxc/mail/middleware";
import { unwrap } from "@sdxc/result";
import { renderToString } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import { MAIL_FROM } from "~/app/emails/sender";
import docsContact from "~/app/http/controllers/docs-contact";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { mail as emailRegistry } from "~/app/initializers/mail";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { TEST_HONEYPOT, testHoneypot } from "~/app/test/honeypot";
import routes from "~/routes/web";

/** Every delivery the form makes, cleared before each test. */
let transport = new MemoryTransport();

/** Renders through `renderToString`, sufficient for this page's plain-element tree. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches `request` through the middleware the contact route runs behind in the app. */
function dispatch(request: Request) {
	let { db } = createTestDatabase();
	let router = createRouter({
		middleware: [
			asyncContext(),
			log() as Middleware,
			database(db),
			models(),
			(ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			},
			mail({ transport, from: MAIL_FROM, mail: emailRegistry }),
			i18n as Middleware,
			formData() as Middleware,
			testHoneypot(),
			testAssets(),
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.docs.contact, docsContact);
	return router.fetch(request);
}

/** Posts the form with fresh honeypot fields, the trap set to `trap`. */
async function submit(fields: Record<string, string>, trap = "") {
	let honeypot = unwrap(await TEST_HONEYPOT.issue());
	let body = new URLSearchParams({
		[honeypot.tokenField]: honeypot.token,
		[honeypot.trapField]: trap,
		...fields,
	});
	return dispatch(
		new Request(`https://uptime.test${routes.docs.contact.action.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body,
		}),
	);
}

beforeEach(() => {
	transport.clear();
});

describe("GET /docs/contact", () => {
	test("renders the form carrying the page the reader came from", async () => {
		let response = await dispatch(
			new Request(`https://uptime.test/docs/contact?page=%2Fdocs%2Fquickstart`),
		);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain('action="/docs/contact"');
		expect(body).toContain('value="/docs/quickstart"');
		expect(body).toContain('content="noindex, follow"');
	});

	test("drops a page outside the docs", async () => {
		let body = await (
			await dispatch(new Request(`https://uptime.test/docs/contact?page=https%3A%2F%2Fevil.com`))
		).text();

		expect(body).not.toContain("evil.com");
	});
});

describe("POST /docs/contact", () => {
	test("emails the support inbox with the reader as reply-to", async () => {
		let response = await submit({
			name: "Ada",
			email: "ada@example.com",
			message: "My cron job shows as missed.",
			page: "/docs/troubleshooting/cron-job-missed",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			"/docs/contact?sent=1&page=%2Fdocs%2Ftroubleshooting%2Fcron-job-missed",
		);
		let [message] = transport.messages;
		expect(message?.to).toEqual([{ email: "hello+uptime@sergiodxa.com" }]);
		expect(message?.replyTo).toEqual([{ email: "ada@example.com", name: "Ada" }]);
		expect(message?.subject).toBe("[Uptime docs] Question from Ada");
		expect(message?.text).toContain("https://uptime.test/docs/troubleshooting/cron-job-missed");
	});

	test("brings an invalid form back with its errors and sends nothing", async () => {
		let response = await submit({ email: "ada", message: "" });

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("Enter the email address we should reply to.");
		expect(body).toContain("Write your question before sending.");
		expect(transport.messages).toHaveLength(0);
	});

	test("thanks a filled trap without sending anything", async () => {
		let response = await submit({ email: "bot@example.com", message: "spam" }, "filled");

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(0);
	});
});
