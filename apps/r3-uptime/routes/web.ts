/**
 * Web route table for the r3-uptime app. Declares every URL the fetch-router serves —
 * the auth flow, signed-in team-area pages, and their form actions — so controllers,
 * middleware, and views share one source of truth for paths and can build hrefs via
 * `routes.*.href(...)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, form, get, post, route } from "remix/fetch-router/routes";

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
			httpMonitors: get("/app/:team/http"),
			monitorNew: get("/app/:team/monitors/new"),
			monitorShow: get("/app/:team/monitors/:monitorId"),
			monitorEdit: get("/app/:team/monitors/:monitorId/edit"),
		},
	},

	actions: {
		createMonitor: post("/actions/:team/create-monitor"),
		updateMonitor: post("/actions/:team/update-monitor"),
		deleteMonitor: del("/actions/:team/delete-monitor"),
		playMonitor: post("/actions/:team/play-monitor"),
		updateSsl: post("/actions/:team/update-ssl"),
		createContentCheck: post("/actions/:team/create-content-check"),
		deleteContentCheck: del("/actions/:team/delete-content-check"),
		setDashboardTab: post("/actions/:team/set-dashboard-tab"),
	},
});
