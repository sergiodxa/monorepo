/**
 * Tests the `/logout` controller: the GET confirmation page renders its heading and a
 * form posting to the logout action; the POST action destroys the session, redirects
 * through the auth server's RP-initiated logout endpoint with a `post_logout_redirect_uri`
 * back to the homepage (plus `id_token_hint` when one was stored at login), and sends
 * `Clear-Site-Data`.
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
import { Session } from "remix/session";
import { renderToString } from "remix/ui/server";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

import logoutController from "./logout";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Installs a given `Session` instance directly, standing in for the real session middleware. */
function seedSession(session: Session): Middleware {
	return (ctx, next) => {
		ctx.set(Session, session, { property: "session" });
		return next();
	};
}

/** Builds a minimal router mapping the whole `/logout` controller, anonymous by default. */
function createTestRouter(session: Session) {
	let { db } = createTestDatabase();
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			// `i18n`'s locale detection calls `getViewer()`, which throws if `Auth` was
			// never set at all — this page doesn't otherwise depend on the viewer.
			(ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			},
			seedSession(session),
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.logout, logoutController);

	return { container, router };
}

describe("GET /logout", () => {
	test("renders the sign-out confirmation page", async () => {
		let { container, router } = createTestRouter(new Session());

		let request = new Request(`https://uptime.test${routes.logout.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Are you sure you want to logout?");
		expect(body).toContain(`action="${routes.logout.action.href()}"`);
		expect(body).toContain(">Logout<");
	});
});

describe("POST /logout", () => {
	test("destroys the session and redirects through the auth server's logout endpoint with the id token hint", async () => {
		let session = new Session();
		session.set("id", "user-1");
		session.set("idToken", "raw-id-token");
		let { container, router } = createTestRouter(session);

		let request = new Request(`https://uptime.test${routes.logout.action.href()}`, {
			method: "POST",
		});
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		expect(response.headers.get("Clear-Site-Data")).toBe('"*"');

		let location = new URL(response.headers.get("Location")!);
		expect(location.origin + location.pathname).toBe("https://auth.sergiodxa.com/oidc/logout");
		expect(location.searchParams.get("id_token_hint")).toBe("raw-id-token");
		expect(location.searchParams.get("post_logout_redirect_uri")).toBe(
			`https://uptime.test${routes.home.href()}`,
		);

		expect(session.destroyed).toBe(true);
	});

	test("omits id_token_hint when no id token was stored", async () => {
		let session = new Session();
		let { container, router } = createTestRouter(session);

		let request = new Request(`https://uptime.test${routes.logout.action.href()}`, {
			method: "POST",
		});
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		let location = new URL(response.headers.get("Location")!);
		expect(location.searchParams.has("id_token_hint")).toBe(false);
		expect(session.destroyed).toBe(true);
	});
});
