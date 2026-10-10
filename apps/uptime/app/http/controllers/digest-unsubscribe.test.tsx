/**
 * Tests `/digests/unsubscribe/:token` the way a mailbox provider reaches it: a sessionless
 * RFC 8058 POST through the same cross-origin protection the app runs, which must turn the
 * digest off for exactly the member the token names and refuse any token it did not sign.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";

import { Base64Url, Hex, hmac } from "@sdxc/crypto";
import { signUnsubscribeToken } from "@sdxc/mail/unsubscribe";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { renderToString } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { withDocumentAssets } from "~/app/lib/test/document-assets";
import { bindModels } from "~/app/lib/test/models";
import { signDigestUnsubscribeToken } from "~/app/lib/unsubscribe-token";
import { wantsEmail } from "~/app/models/user-preferences";
import routes from "~/routes/web";

import digestUnsubscribe from "./digest-unsubscribe";

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

vi.mock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();
	let { withUnsubscribeSecret } = await import("~/app/lib/test/unsubscribe-secret");
	return { ...original, env: withUnsubscribeSecret(original.env) };
});

/** A token for `subject-1`'s daily digest, signed the way the digest job signs it. */
async function dailyToken(subjectId = "subject-1") {
	return unwrap(await signDigestUnsubscribeToken({ subject: subjectId, list: "teamDailyDigest" }));
}

/** A token with an issue time signed under the session secret, as digests were before the dedicated key. */
async function sessionSecretToken(subjectId = "subject-1") {
	return unwrap(
		await signUnsubscribeToken(
			env.COOKIE_SESSION_SECRET,
			{ subject: subjectId, list: "teamDailyDigest" },
			{ purpose: "digest-unsubscribe:v1:" },
		),
	);
}

/**
 * A token in the shape digests were mailed with before issue times were signed in: the MAC
 * over the purpose and `email:subject` alone. Links already sitting in inboxes look like this.
 */
async function deliveredToken(subjectId = "subject-1") {
	let payload = `teamDailyDigest:${subjectId}`;
	let mac = unwrap(await hmac.sign(env.COOKIE_SESSION_SECRET, `digest-unsubscribe:v1:${payload}`));
	return `${Hex.encode(mac)}${Base64Url.encode(payload)}`;
}

/**
 * Dispatches one request with no session and no browser provenance headers, which is what a
 * provider's one-click POST looks like; the POST carries the RFC 8058 body.
 */
async function visit(db: Db, token: string, method: "GET" | "POST", oneClick = true) {
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
			cop(),
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.digestUnsubscribe, digestUnsubscribe);

	let href =
		method === "GET"
			? routes.digestUnsubscribe.index.href({ token })
			: routes.digestUnsubscribe.action.href({ token });

	let init: RequestInit =
		method === "POST"
			? {
					method,
					headers: { "content-type": "application/x-www-form-urlencoded" },
					body: oneClick ? "List-Unsubscribe=One-Click" : "",
				}
			: { method };

	let response = await router.fetch(new Request(`https://uptime.test${href}`, init));

	return { response, body: await response.text() };
}

/** Whether the subject would still be sent the daily digest. */
async function wantsDaily(db: Db, subjectId = "subject-1") {
	let preferences = await bindModels(db).userPreferences.findBy({ subject_id: subjectId });
	return wantsEmail(preferences, "teamDailyDigest");
}

describe("GET /digests/unsubscribe/:token", () => {
	test("asks for confirmation with a button that POSTs, and changes nothing", async () => {
		let { db } = createTestDatabase();
		let token = await dailyToken();

		let { response, body } = await visit(db, token, "GET");

		expect(response.status).toBe(200);
		expect(body).toContain("Stop this digest?");
		expect(body).toContain('method="post"');
		expect(body).toContain(`action="${routes.digestUnsubscribe.action.href({ token })}"`);
		expect(await wantsDaily(db)).toBe(true);
	});
});

describe("POST /digests/unsubscribe/:token", () => {
	test("turns the digest off for a provider's one-click POST, answering an empty 200", async () => {
		let { db } = createTestDatabase();

		let { response, body } = await visit(db, await dailyToken(), "POST");

		expect(response.status).toBe(200);
		expect(body).toBe("");
		expect(await wantsDaily(db)).toBe(false);
	});

	test("shows a person who pressed the button that the digest is off", async () => {
		let { db } = createTestDatabase();

		let { response, body } = await visit(db, await dailyToken(), "POST", false);

		expect(response.status).toBe(200);
		expect(body).toContain("Digest turned off");
		expect(await wantsDaily(db)).toBe(false);
	});

	test("still honours a link delivered before tokens carried an issue time", async () => {
		let { db } = createTestDatabase();

		let { response } = await visit(db, await deliveredToken(), "POST");

		expect(response.status).toBe(200);
		expect(await wantsDaily(db)).toBe(false);
	});

	test("still honours a link signed under the session secret before the dedicated key", async () => {
		let { db } = createTestDatabase();

		let { response } = await visit(db, await sessionSecretToken(), "POST");

		expect(response.status).toBe(200);
		expect(await wantsDaily(db)).toBe(false);
	});

	test("rejects a token signed with neither key", async () => {
		let { db } = createTestDatabase();
		let token = unwrap(
			await signUnsubscribeToken(
				"some-other-key",
				{ subject: "subject-1", list: "teamDailyDigest" },
				{ purpose: "digest-unsubscribe:v1:" },
			),
		);

		let { response } = await visit(db, token, "POST");

		expect(response.status).toBe(400);
		expect(await wantsDaily(db)).toBe(true);
	});

	test("keeps the member's other choices and answers a repeat the same way", async () => {
		let { db } = createTestDatabase();
		unwrap(await bindModels(db).userPreferences.setLanguage("subject-1", "es"));
		let token = await dailyToken();

		await visit(db, token, "POST");
		let second = await visit(db, token, "POST", false);

		let preferences = await bindModels(db).userPreferences.findBy({ subject_id: "subject-1" });
		expect(second.response.status).toBe(200);
		expect(preferences?.preferred_language).toBe("es");
		expect(preferences?.unsubscribed_emails).toEqual(["teamDailyDigest"]);
		expect(wantsEmail(preferences, "teamWeeklyDigest")).toBe(true);
	});

	test("rejects a tampered token and leaves every subscription alone", async () => {
		let { db } = createTestDatabase();
		let token = await dailyToken();
		let forged = token.slice(0, 64) + (await dailyToken("subject-2")).slice(64);

		let { response } = await visit(db, forged, "POST");

		expect(response.status).toBe(400);
		expect(await wantsDaily(db, "subject-1")).toBe(true);
		expect(await wantsDaily(db, "subject-2")).toBe(true);
	});

	test("rejects a token whose signature was altered", async () => {
		let { db } = createTestDatabase();
		let token = await dailyToken();
		let altered = `${token[0] === "0" ? "1" : "0"}${token.slice(1)}`;

		let { response } = await visit(db, altered, "POST");

		expect(response.status).toBe(400);
		expect(await wantsDaily(db)).toBe(true);
	});
});
