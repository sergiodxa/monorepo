/**
 * Tests the sign-in and sign-out screens' rendered markup. Both forms answer with a
 * redirect to the OIDC provider, so each must stay a document submission: a frame
 * navigation resolved with `fetch` cannot follow a redirect off this origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

import { createEnv } from "@pkg/cloudflare-mocks";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import renderMiddleware from "~/app/http/middleware/render";
import routes from "~/routes/web";

/** Precedes the dynamic import below, since the controller module reads `env` on load. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ OIDC_ISSUER: "https://sso.blog.test" }),
	DurableObject: class {},
}));

let { login, logout } = await import("./auth");

/** Builds a router carrying only what these two screens render through. */
function createTestRouter() {
	let router = createRouter({
		middleware: [asyncContext(), renderMiddleware as Middleware],
	});

	router.map(routes.auth.login, login);
	router.map(routes.auth.logout, logout);

	return router;
}

/** Fetches one of the auth screens and returns the document it rendered. */
async function renderScreen(pathname: string): Promise<string> {
	let response = await createTestRouter().fetch(new Request(`https://blog.test${pathname}`));
	return await response.text();
}

describe("GET /auth/login", () => {
	test("marks the sign-in form as a document submission", async () => {
		let body = await renderScreen(routes.auth.login.index.href());

		let form = body.match(
			new RegExp(`<form[^>]*action="${routes.auth.login.action.href()}"[^>]*>`),
		);
		expect(form?.[0]).toContain("rmx-document");
	});
});

describe("GET /auth/logout", () => {
	test("marks the sign-out form as a document submission", async () => {
		let body = await renderScreen(routes.auth.logout.index.href());

		let form = body.match(
			new RegExp(`<form[^>]*action="${routes.auth.logout.action.href()}"[^>]*>`),
		);
		expect(form?.[0]).toContain("rmx-document");
	});
});
