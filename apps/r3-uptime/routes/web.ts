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
	healthcheckAnalyticsEngine: get("/healthcheck/analytics-engine"),

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
			dnsMonitors: get("/app/:team/dns"),
			dnsMonitorNew: get("/app/:team/dns/new"),
			dnsMonitorShow: get("/app/:team/dns/:monitorId"),
			dnsMonitorEdit: get("/app/:team/dns/:monitorId/edit"),
			tcpMonitors: get("/app/:team/tcp"),
			tcpMonitorNew: get("/app/:team/tcp/new"),
			tcpMonitorShow: get("/app/:team/tcp/:monitorId"),
			tcpMonitorEdit: get("/app/:team/tcp/:monitorId/edit"),
			cronJobs: get("/app/:team/cron-jobs"),
			cronJobNew: get("/app/:team/cron-jobs/new"),
			cronJobShow: get("/app/:team/cron-jobs/:monitorId"),
			cronJobEdit: get("/app/:team/cron-jobs/:monitorId/edit"),
			alerts: get("/app/:team/alerts"),
			alertNew: get("/app/:team/alerts/new"),
			alertEdit: get("/app/:team/alerts/:alertId/edit"),
			alertHistory: get("/app/:team/alert-history"),
			maintenanceWindows: get("/app/:team/maintenance"),
			maintenanceWindowNew: get("/app/:team/maintenance/new"),
			maintenanceWindowEdit: get("/app/:team/maintenance/:windowId/edit"),
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
		createDnsMonitor: post("/actions/:team/create-dns-monitor"),
		updateDnsMonitor: post("/actions/:team/update-dns-monitor"),
		deleteDnsMonitor: del("/actions/:team/delete-dns-monitor"),
		checkDnsMonitor: post("/actions/:team/check-dns-monitor"),
		createTcpMonitor: post("/actions/:team/create-tcp-monitor"),
		updateTcpMonitor: post("/actions/:team/update-tcp-monitor"),
		deleteTcpMonitor: del("/actions/:team/delete-tcp-monitor"),
		checkTcpMonitor: post("/actions/:team/check-tcp-monitor"),
		createCronJob: post("/actions/:team/create-cron-job"),
		updateCronJob: post("/actions/:team/update-cron-job"),
		deleteCronJob: del("/actions/:team/delete-cron-job"),
		createAlert: post("/actions/:team/create-alert"),
		updateAlert: post("/actions/:team/update-alert"),
		deleteAlert: del("/actions/:team/delete-alert"),
		createMaintenanceWindow: post("/actions/:team/create-maintenance-window"),
		updateMaintenanceWindow: post("/actions/:team/update-maintenance-window"),
		deleteMaintenanceWindow: del("/actions/:team/delete-maintenance-window"),
		endMaintenanceWindow: post("/actions/:team/end-maintenance-window"),
	},

	api: {
		cronJobPing: post("/api/v1/cron-jobs/:cronJobId/ping"),
	},
});
