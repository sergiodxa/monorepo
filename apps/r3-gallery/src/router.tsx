/**
 * The gallery's router and the request context every action shares. The `render()`
 * middleware gives actions `ctx.render()` so a route answers with a Remix node, and
 * `loadLikes` publishes the liked-photo store the album and like routes read.
 *
 * Route mapping lives in the client entry, keeping this module free of controller
 * imports so components can reach `router.fetch()` without an import cycle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MiddlewareContext } from "remix/router";

import { createMiddleware, createRouter } from "remix/router";
import { render } from "remix/spa";

import { loadLikes } from "./middleware/likes";
import { StateMessage } from "./views/state-message";

/** Chain every route runs behind, kept as a tuple so {@link AppContext} can derive from it. */
const middleware = createMiddleware(render(), loadLikes);

/** Request context actions receive, carrying `ctx.render()` and the likes store. */
export type AppContext = MiddlewareContext<typeof middleware>;

/** Resolves every URL the browser hands to the SPA runtime. */
export const router = createRouter({
	middleware,

	defaultHandler(ctx) {
		return ctx.render(
			<StateMessage title="Route not found" message={`No route matched ${ctx.url.pathname}.`} />,
			{ status: 404 },
		);
	},
});
