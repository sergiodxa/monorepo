/**
 * Web route table for the r3-uptime app. Declares every URL the fetch-router serves —
 * currently the auth flow, the signed-in team-area entry redirects, and health checks
 * — so controllers, middleware, and views share one source of truth for paths and can
 * build hrefs via `routes.*.href(...)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, route } from "remix/fetch-router/routes";

/**
 * The application route map. Each leaf is a typed route with `.href(params)` for
 * building URLs and is used as the key when mapping controllers in `bootstrap/app.tsx`.
 *
 * @example
 * routes.app.team.href({ team: "acme" });
 */
export default route({
	home: get("/"),
	healthcheck: get("/healthcheck"),

	// GET = OAuth callback ("index"), POST = starts the OAuth flow ("action").
	auth: form("/auth"),
	// GET = confirmation page ("index"), POST = destroys the session ("action").
	logout: form("/logout"),

	app: {
		index: get("/app"),
		team: {
			index: get("/app/:team"),
			dashboard: get("/app/:team/dashboard"),
		},
	},
});
