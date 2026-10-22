/**
 * The page chain's principal: a guest holds no role and a visitor signed in through the session
 * holds `member`, read through a router running the same session and access middleware.
 */

import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vite-plus/test";

import access, { rolesOf, signedIn } from "~/app/http/middleware/access";
import { sessionCookie, sessionStorage } from "~/app/initializers/session";
import { signIn } from "~/app/test/session";

/** A router answering the principal it bound: its roles, its actor, and whether access is bound. */
function createProbe() {
	let router = createRouter({ middleware: [session(sessionCookie, sessionStorage), access] });
	router.get("/", (ctx) =>
		Response.json({
			roles: rolesOf(ctx.session),
			actor: signedIn(ctx.session) ?? null,
			bound: ctx.access !== undefined,
		}),
	);
	return router;
}

describe("access", () => {
	test("binds a visitor without a session as a guest", async () => {
		let response = await createProbe().fetch("https://example.com/");

		expect(await response.json()).toEqual({ roles: [], actor: null, bound: true });
	});

	test("binds a signed-in visitor as a member", async () => {
		let cookie = await signIn({ id: "42" });

		let response = await createProbe().fetch(
			new Request("https://example.com/", { headers: { cookie } }),
		);

		expect(await response.json()).toEqual({ roles: ["member"], actor: { id: "42" }, bound: true });
	});
});
