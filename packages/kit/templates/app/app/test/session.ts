/**
 * Signs a visitor in for a test the way the app does: a request through the session middleware
 * stores them under the session's `actor` key, and the cookie it answers is what a test sends
 * back, so a request carrying it reaches every page as that `member`.
 */

import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";

import type { Actor } from "~/app/policies/policy";

import { ACTOR_KEY } from "~/app/http/middleware/access";
import { sessionCookie, sessionStorage } from "~/app/initializers/session";

/**
 * Stores `actor` in a new session and answers its `Cookie` header.
 *
 * @example let cookie = await signIn(); await router.fetch(new Request(url, { headers: { cookie } }));
 */
export async function signIn(actor: Actor = { id: "1" }): Promise<string> {
	let router = createRouter({ middleware: [session(sessionCookie, sessionStorage)] });
	router.post("/", (ctx) => {
		ctx.session.set(ACTOR_KEY, actor);
		return new Response(null, { status: 204 });
	});
	let response = await router.fetch(new Request("https://example.com/", { method: "POST" }));
	return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}
