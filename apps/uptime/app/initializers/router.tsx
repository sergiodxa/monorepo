/**
 * The uptime fetch-router: the global middleware stack, then every route mapped through
 * `lazy()`, so a cold isolate imports only the controllers it serves across the marketing
 * site, the signed-in app and the API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyAbility } from "@sdxc/authz";
import type { Middleware, RequestContext } from "remix/router";

import { assets } from "@sdxc/assets-middleware";
import { attribution } from "@sdxc/attribution/middleware";
import { requireAbility } from "@sdxc/authz/middleware/router";
import billing from "@sdxc/billing/middleware";
import { database } from "@sdxc/database-middleware";
import featureFlags from "@sdxc/flags/middleware/router";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { jobEnqueuer } from "@sdxc/jobs/router";
import { lazy } from "@sdxc/lazy-route";
import { currentLog } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import mail from "@sdxc/mail/middleware";
import { previews } from "@sdxc/mail/previews";
import { SecurityHeadersKey, securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { wellKnown } from "@sdxc/well-known/middleware";
import { x402 } from "@sdxc/x402/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import defaultHandler from "~/app/http/controllers/default-handler";
import { teamAccess } from "~/app/http/middleware/access";
import auth, { getViewer } from "~/app/http/middleware/auth";
import { frameFailures } from "~/app/http/middleware/frame-failures";
import i18n from "~/app/http/middleware/i18n";
import mcpAccess from "~/app/http/middleware/mcp-access";
import models from "~/app/http/middleware/models";
import publicPageCache from "~/app/http/middleware/public-page-cache";
import requireApiKey from "~/app/http/middleware/require-api-key";
import requireMcpScope from "~/app/http/middleware/require-mcp-scope";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import socialCards from "~/app/http/middleware/social-cards";
import { assetResolver } from "~/app/initializers/assets";
import { polar } from "~/app/initializers/billing";
import { openDatabase } from "~/app/initializers/database";
import { flags } from "~/app/initializers/flags";
import { SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";
import { logger } from "~/app/initializers/logger";
import { mail as emailRegistry } from "~/app/initializers/mail";
import { queue, transport } from "~/app/initializers/mail-transport";
import { jobQueue } from "~/app/initializers/queue";
import { signaturesDirectory } from "~/app/initializers/web-bot-auth";
import { sellerConfig } from "~/app/initializers/x402";
import abilities from "~/app/policies/abilities";
import { apiCatalogEntry } from "~/config/api-catalog";
import { SECURITY_POLICY } from "~/config/security-policy";
import { securityTxtEntry } from "~/config/security-txt";
import {
	alertRoutes,
	alertsRoutes,
	apiKeysRoutes,
	cronJobRoutes,
	cronJobsRoutes,
	dnsMonitorRecordsRoutes,
	dnsMonitorRoutes,
	dnsMonitorsRoutes,
	flowMonitorsRoutes,
	invitesRoutes,
	maintenanceRoutes,
	maintenanceWindowRoutes,
	monitorContentChecksRoutes,
	monitorRoutes,
	monitorsRoutes,
	reportsRoutes,
	statusPageRoutes,
	statusPagesRoutes,
	tcpMonitorRoutes,
	tcpMonitorsRoutes,
	teamDomainsRoutes,
	teamRoutes,
} from "~/routes/api-groups";
import routes from "~/routes/web";

/**
 * Path prefix of the JSON surface: bearer-token auth, server-to-server
 * calls only, and untranslated JSON responses — so cross-origin checks and
 * language resolution skip it.
 */
const API_PATH_PREFIX = "/api/";

/**
 * Path prefix of the inbound-webhook surface. A sender proves itself with a signature
 * over the raw request body (see `webhooks/polar.ts`), so it has neither a session nor an
 * `Origin` to satisfy, and its responses are machine-read JSON.
 */
const WEBHOOK_PATH_PREFIX = "/webhooks/";

/**
 * Prefixes whose requests are machine-to-machine. Sharing one list gives
 * them the same exemption from cross-origin protection, language resolution,
 * and translated 404s, so adding a surface takes a single edit.
 */
const MACHINE_PATH_PREFIXES = [API_PATH_PREFIX, WEBHOOK_PATH_PREFIX];

/**
 * The chain every team-scoped action runs behind: a signed-in viewer who belongs to the
 * team in the URL, bound as `ctx.access`. Passed to each action's `lazy()`, so it answers
 * before the module loads.
 */
const MEMBER_GUARDS: Middleware[] = [requireUser, requireTeam, teamAccess];

/**
 * The member chain plus one ability, for the actions only an admin performs: changing the team
 * itself or deleting a monitor. A member without it gets the 403 page before the module loads.
 *
 * @param ability - The ability the action performs.
 */
function adminGuards(ability: AnyAbility): Middleware[] {
	return [...MEMBER_GUARDS, requireAbility(ability)];
}

/**
 * A signed-in viewer alone, for the account page's actions: each names its own team, since
 * the page lists every team the viewer belongs to.
 */
const ACCOUNT_GUARDS: Middleware[] = [requireUser];

/**
 * Mapped ahead of every public landing page's controller, so the viewer's browser keeps the
 * rendered page for five minutes and a link prefetch answers the navigation that follows it.
 */
const PUBLIC_PAGE_GUARDS: Middleware[] = [publicPageCache()];

/** Inputs {@link createWebRouter} reads per request, which no module-scope binding can supply. */
export interface WebRouterOptions {
	/** KV namespace backing session storage. */
	kv: KVNamespace;
	/** Secret used to sign the session cookie. */
	cookieSecret: string;
	/** Whether the session cookie should be marked `Secure`. */
	secure: boolean;
}

/**
 * Builds the app's fetch-router: global middleware, then every route mapped to its controller.
 * A function because the session cookie's `Secure` flag follows the request's host. Typed over
 * `RequestContext`, which each middleware augments, since every controller is typed against it.
 */
export function createWebRouter(options: WebRouterOptions) {
	let router = createRouter<RequestContext>({
		middleware: [
			/**
			 * Runs first so the session, the auth guard, cross-origin protection, and
			 * the per-route API guards all see a plain `GET` and treat a `HEAD` probe
			 * exactly like the request behind it.
			 */
			headRequests(),
			asyncContext(),
			log(logger),
			/**
			 * Continues the caller's W3C trace or starts one, right after the log so its IDs land
			 * on the request's record, and every job enqueued while serving carries it along.
			 */
			trace(),
			/**
			 * Publishes `ctx.ip` on every surface, parsed once from `CF-Connecting-IP`, so
			 * rate limits and recorded addresses all read the same canonical address.
			 */
			getClientIP(),
			/**
			 * Publishes `ctx.x402` for the accountless guest probe. Other routes ignore it;
			 * marketing `/try` stays free and never mounts `requirePayment`.
			 */
			x402(sellerConfig()),
			/**
			 * Answers `/.well-known/security.txt`, the Web Bot Auth key directory and the API
			 * catalog before anything that reads a session or the database, since none needs a cookie.
			 */
			wellKnown({
				"security.txt": securityTxtEntry,
				"http-message-signatures-directory": signaturesDirectory,
				"api-catalog": apiCatalogEntry,
			}),
			/**
			 * Publishes `ctx.db` on every surface. The session, the auth guard and every
			 * controller below read from it, so it leads the chain that reaches storage.
			 */
			database(openDatabase()),
			/**
			 * Publishes `ctx.jobs` on every surface, over the same billed queue the dispatcher
			 * writes through, so a controller enqueues without importing the dispatcher.
			 */
			jobEnqueuer(jobQueue),
			/**
			 * Publishes `ctx.models` on every surface, bound to the `ctx.db` and `ctx.jobs` above
			 * on the first model a request reads, so a request that reads none binds nothing.
			 */
			models(),
			/**
			 * Answers `<page>.png` with the page's social card before routing, since page
			 * patterns would claim the path; it reads `ctx.models` for a status page's card.
			 */
			socialCards((request): Promise<Response> => router.fetch(request)),
			/**
			 * While developing, answers `/_emails` with every mapped email in every supported
			 * language, ahead of the session and the security headers a preview needs neither of.
			 */
			previews(emailRegistry, {
				locales: SUPPORTED_LANGUAGES,
				enabled: import.meta.env.DEV,
				stylesheets: () => assetResolver.getStylesheets("resources/layouts/document.tsx"),
			}),
			/**
			 * Publishes `ctx.email` on every surface, including machine ones — the
			 * cron-job ping endpoint dispatches alerts too. Sits after the log so
			 * failures from its deferred flush queue can still reach `ctx.log`.
			 */
			mail({ transport, from: MAIL_FROM, replyTo: MAIL_REPLY_TO, mail: emailRegistry, queue }),
			formData(),
			methodOverride(),
			/**
			 * Publishes `ctx.billing` on every surface. It costs nothing per request — the provider
			 * is one module-scope object — and the webhook endpoint is a machine surface that needs
			 * it as much as a checkout redirect does.
			 */
			billing({ provider: polar }),
			createSessionMiddleware(options.kv, options.cookieSecret, options.secure),
			auth,
			/**
			 * Publishes `ctx.flags` on every surface, machine ones included — the ad-hoc ping
			 * endpoint reads a flag before it reads a body.
			 */
			featureFlags(flags, { context: () => ({ targetingKey: getViewer()?.id }) }),
			/**
			 * Stays after the session middleware, whose stored language it reads.
			 * Wrapped in `htmlOnly` because resolving a language and building an
			 * translator only pays off for a page a person actually reads.
			 */
			htmlOnly(i18n),
			/**
			 * Publishes `ctx.attribution` and keeps the visitor's first and last touch in the
			 * session, so the sign-in can copy the first onto the conversion row and a checkout
			 * can carry both.
			 */
			attribution({
				store: "session",
				aliases: { source: ["ref", "source"], campaign: ["campaign"] },
			}),
			/**
			 * Machine surfaces authenticate differently: a webhook sender proves itself
			 * by signing the request body — a stronger claim than an `Origin` header —
			 * from a caller with no browser to send one from.
			 */
			cop({
				/**
				 * `/mcp` is named beside the machine prefixes: agents authenticate with a Bearer
				 * API key and send no browser `Origin`, so COP would refuse every call.
				 */
				insecureBypassPatterns: [
					...MACHINE_PATH_PREFIXES.map((prefix) => `${prefix}{path...}`),
					"/mcp",
				],
			}),
			/**
			 * Right before the assets and the renderer, so the headers land on the response it
			 * produced and the nonce exists before `assets()` reads it into `ctx.assets`.
			 */
			securityHeaders(SECURITY_POLICY),
			/**
			 * Publishes `ctx.assets`, the stylesheets and client entry every page's document links,
			 * resolved once per request. After the security headers, whose nonce it carries.
			 */
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
				nonce: (ctx) =>
					ctx.has(SecurityHeadersKey) ? ctx.get(SecurityHeadersKey)?.nonce : undefined,
			}),
			/**
			 * Frames resolve back through this router, so a fragment shares the request's cookies
			 * and middleware; every island hydrates from the chunk the resolver names for it.
			 */
			render({
				assets: assetResolver,
				/** Sends render failures to the request's log, since a Worker discards the console. */
				onError(error) {
					currentLog()?.fail(error, { render: { failed: true } });
				},
			}),
			frameFailures(),
		],
		/**
		 * Renders the translated 404 page for unmatched paths. A path under {@link
		 * MACHINE_PATH_PREFIXES} lands here too; since `htmlOnly` skipped it earlier, this
		 * resolves the language itself before rendering.
		 */
		defaultHandler(context) {
			if (!isMachinePath(context.url.pathname)) return defaultHandler(context);
			return i18n(context, async () => defaultHandler(context));
		},
	});

	/**
	 * The public try-it form's honeypot, on every route that renders the form or accepts it: the
	 * landing page, `/try` and `/try/lead`. Its key derives from the session secret under a
	 * `honeypot:` label, so no second secret is provisioned.
	 */
	let trialHoneypot = honeypot(new Honeypot({ secret: `honeypot:${options.cookieSecret}` }), {
		onFailure: () => null,
	});

	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home"), [trialHoneypot, ...PUBLIC_PAGE_GUARDS]),
	);
	router.map(
		routes.health,
		lazy(() => import("~/app/http/controllers/health")),
	);
	router.map(
		routes.auth,
		lazy(() => import("~/app/http/controllers/auth")),
	);
	router.map(
		routes.logout,
		lazy(() => import("~/app/http/controllers/logout")),
	);
	router.map(
		routes.statusPage,
		lazy(() => import("~/app/http/controllers/status-page")),
	);
	router.map(
		routes.cspReports,
		lazy(() => import("~/app/http/controllers/csp-reports")),
	);
	router.map(
		routes.statusPageCalendar,
		lazy(() => import("~/app/http/controllers/status-page-calendar")),
	);
	router.map(
		routes.statusPageCalendarJson,
		lazy(() => import("~/app/http/controllers/status-page-calendar-json")),
	);
	router.map(
		routes.statusPageMaintenanceEvent,
		lazy(() => import("~/app/http/controllers/status-page-maintenance-event")),
	);
	router.map(
		routes.statusPageMaintenanceEventJson,
		lazy(() => import("~/app/http/controllers/status-page-maintenance-event-json")),
	);
	router.map(
		routes.invite,
		lazy(() => import("~/app/http/controllers/invite")),
	);

	/**
	 * Public try-it surface: outside every auth guard since using it needs no account. Each
	 * leaf guards itself instead — the honeypot ahead of `trial/guard.ts` for `trial.check`'s
	 * POST, so a filled trap never costs a challenge verification or a probe, the honeypot fo
	 */
	router.map(
		routes.trial.check,
		lazy(() => import("~/app/http/controllers/trial/index"), [trialHoneypot]),
	);
	router.map(
		routes.trial.lead,
		lazy(() => import("~/app/http/controllers/trial/lead"), [trialHoneypot]),
	);
	router.map(
		routes.trial.unsubscribe,
		lazy(() => import("~/app/http/controllers/trial/unsubscribe")),
	);
	router.map(
		routes.trial.report,
		lazy(() => import("~/app/http/controllers/trial/report")),
	);

	/**
	 * Outside every auth guard, since a mailbox provider's one-click POST arrives with no
	 * session; the signed token in the URL is the whole credential.
	 */
	router.map(
		routes.digestUnsubscribe,
		lazy(() => import("~/app/http/controllers/digest-unsubscribe")),
	);

	router.map(
		routes.marketing.feature,
		lazy(() => import("~/app/http/controllers/marketing-feature"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.marketing.audience,
		lazy(() => import("~/app/http/controllers/marketing-audience"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.marketing.useCase,
		lazy(() => import("~/app/http/controllers/marketing-use-case"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.marketing.comparison,
		lazy(() => import("~/app/http/controllers/marketing-comparison"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.browserFlows,
		lazy(() => import("~/app/http/controllers/browser-flows"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.trust,
		lazy(() => import("~/app/http/controllers/trust"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.mcp.index,
		lazy(() => import("~/app/http/controllers/mcp"), PUBLIC_PAGE_GUARDS),
	);
	router.map(routes.mcp.action, {
		middleware: [requireApiKey, requireMcpScope, mcpAccess],
		/**
		 * Imported here rather than through `lazy()`, because `requireApiKey` publishes the
		 * key the tools read, so this stays an action object whose `handler` is a function.
		 */
		handler: async (ctx) => (await import("~/app/initializers/mcp")).default.fetch(ctx),
	});
	router.map(
		routes.legal.privacy,
		lazy(() => import("~/app/http/controllers/privacy"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.legal.terms,
		lazy(() => import("~/app/http/controllers/terms"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.docs.index,
		lazy(() => import("~/app/http/controllers/docs-index"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.docs.show,
		lazy(() => import("~/app/http/controllers/docs-show"), PUBLIC_PAGE_GUARDS),
	);
	router.map(
		routes.sitemap,
		lazy(() => import("~/app/http/controllers/sitemap")),
	);

	/**
	 * Each controller bakes its own `requireUser`/`requireTeam` (and, where
	 * noted, `requireAbility`) chain into its `createAction` call, so `lazy()`
	 * takes its module directly, with no guards passed alongside it.
	 */
	router.map(
		routes.app.index,
		lazy(() => import("~/app/http/controllers/app/index")),
	);
	router.map(
		routes.app.team.index,
		lazy(() => import("~/app/http/controllers/app/team/index")),
	);
	router.map(
		routes.app.team.dashboard.index,
		lazy(() => import("~/app/http/controllers/app/team/dashboard")),
	);
	router.map(
		routes.app.team.dashboard.panel,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-panel")),
	);
	router.map(
		routes.app.team.dashboard.quickPing,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-quick-ping")),
	);
	router.map(
		routes.app.team.dashboard.cards.usage,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-card-usage")),
	);
	router.map(
		routes.app.team.dashboard.cards.uptime,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-card-uptime")),
	);
	router.map(
		routes.app.team.dashboard.cards.slowestEndpoint,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-card-slowest-endpoint")),
	);
	router.map(
		routes.app.team.dashboard.cards.count,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-card-count")),
	);
	router.map(
		routes.app.team.monitorsImport,
		lazy(() => import("~/app/http/controllers/app/team/monitors-import")),
	);
	router.map(
		routes.app.team.monitors.index,
		lazy(() => import("~/app/http/controllers/app/team/http-monitors")),
	);
	router.map(
		routes.app.team.monitors.new,
		lazy(() => import("~/app/http/controllers/app/team/monitor-new")),
	);
	router.map(
		routes.app.team.monitors.show,
		lazy(() => import("~/app/http/controllers/app/team/monitor-show")),
	);
	router.map(
		routes.app.team.monitors.edit,
		lazy(() => import("~/app/http/controllers/app/team/monitor-edit")),
	);
	router.map(
		routes.app.team.monitors.cards.usage,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-usage")),
	);
	router.map(
		routes.app.team.monitors.cards.slowestResult,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-slowest-result")),
	);
	router.map(
		routes.app.team.monitors.cards.uptime,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-uptime")),
	);
	router.map(
		routes.app.team.monitors.cards.uptimeHistory,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-uptime-history")),
	);
	router.map(
		routes.app.team.monitors.cards.p99ResponseTime,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-p99-response-time")),
	);
	router.map(
		routes.app.team.monitors.runStatus,
		lazy(() => import("~/app/http/controllers/app/team/monitor-run-status")),
	);
	router.map(
		routes.app.team.dnsMonitors.index,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitors")),
	);
	router.map(
		routes.app.team.dnsMonitors.new,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-new")),
	);
	router.map(
		routes.app.team.dnsMonitors.show,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-show")),
	);
	router.map(
		routes.app.team.dnsMonitors.edit,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-edit")),
	);
	router.map(
		routes.app.team.dnsMonitors.review,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-review")),
	);
	router.map(
		routes.app.team.dnsMonitors.cards.uptimeHistory,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-card-uptime-history")),
	);
	router.map(
		routes.app.team.dnsMonitors.cards.results,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-card-results")),
	);
	router.map(
		routes.app.team.dnsMonitors.cards.checkHistory,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-card-check-history")),
	);
	router.map(
		routes.app.team.flowMonitors.index,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitors")),
	);
	router.map(
		routes.app.team.flowMonitors.new,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-new")),
	);
	router.map(
		routes.app.team.flowMonitors.show,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-show")),
	);
	router.map(
		routes.app.team.flowMonitors.edit,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-edit")),
	);
	router.map(
		routes.app.team.flowMonitors.cards.results,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-card-results")),
	);
	router.map(
		routes.app.team.flowMonitors.trace,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-trace")),
	);
	router.map(
		routes.app.team.tcpMonitors.index,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitors")),
	);
	router.map(
		routes.app.team.tcpMonitors.new,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-new")),
	);
	router.map(
		routes.app.team.tcpMonitors.show,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-show")),
	);
	router.map(
		routes.app.team.tcpMonitors.edit,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-edit")),
	);
	router.map(
		routes.app.team.tcpMonitors.cards.uptimeHistory,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-card-uptime-history")),
	);
	router.map(
		routes.app.team.tcpMonitors.cards.results,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-card-results")),
	);
	router.map(
		routes.app.team.cronJobs.index,
		lazy(() => import("~/app/http/controllers/app/team/cron-jobs")),
	);
	router.map(
		routes.app.team.cronJobs.new,
		lazy(() => import("~/app/http/controllers/app/team/cron-job-new")),
	);
	router.map(
		routes.app.team.cronJobs.show,
		lazy(() => import("~/app/http/controllers/app/team/cron-job-show")),
	);
	router.map(
		routes.app.team.cronJobs.edit,
		lazy(() => import("~/app/http/controllers/app/team/cron-job-edit")),
	);
	router.map(
		routes.app.team.alerts.index,
		lazy(() => import("~/app/http/controllers/app/team/alerts")),
	);
	router.map(
		routes.app.team.alerts.new,
		lazy(() => import("~/app/http/controllers/app/team/alert-new")),
	);
	router.map(
		routes.app.team.alerts.edit,
		lazy(() => import("~/app/http/controllers/app/team/alert-edit")),
	);
	router.map(
		routes.app.team.alerts.history,
		lazy(() => import("~/app/http/controllers/app/team/alert-history")),
	);
	router.map(
		routes.app.team.reports.index,
		lazy(() => import("~/app/http/controllers/app/team/reports")),
	);
	router.map(
		routes.app.team.reports.download,
		lazy(() => import("~/app/http/controllers/app/team/report-download")),
	);
	router.map(
		routes.app.team.reports.archive,
		lazy(() => import("~/app/http/controllers/app/team/report-archive")),
	);
	router.map(
		routes.app.team.maintenanceWindows.index,
		lazy(() => import("~/app/http/controllers/app/team/maintenance-windows")),
	);
	router.map(
		routes.app.team.maintenanceWindows.new,
		lazy(() => import("~/app/http/controllers/app/team/maintenance-window-new")),
	);
	router.map(
		routes.app.team.maintenanceWindows.edit,
		lazy(() => import("~/app/http/controllers/app/team/maintenance-window-edit")),
	);
	router.map(
		routes.app.team.statusPages.index,
		lazy(() => import("~/app/http/controllers/app/team/status-pages")),
	);
	router.map(
		routes.app.team.statusPages.new,
		lazy(() => import("~/app/http/controllers/app/team/status-page-new")),
	);
	router.map(
		routes.app.team.statusPages.edit,
		lazy(() => import("~/app/http/controllers/app/team/status-page-edit")),
	);
	router.map(
		routes.app.team.settings,
		lazy(() => import("~/app/http/controllers/app/team/settings")),
	);
	router.map(
		routes.app.team.account,
		lazy(() => import("~/app/http/controllers/app/team/account")),
	);
	router.map(
		routes.app.team.apiKeys.index,
		lazy(() => import("~/app/http/controllers/app/team/api-keys")),
	);
	router.map(
		routes.app.team.apiKeys.new,
		lazy(() => import("~/app/http/controllers/app/team/api-key-new")),
	);
	router.map(
		routes.app.team.checkout,
		lazy(() => import("~/app/http/controllers/app/team/checkout")),
	);

	/**
	 * Each leaf group gets its own `router.map()` call. Every action takes the group's guards
	 * as `lazy()`'s second argument, so an unauthorized request is answered before the
	 * action's module is loaded.
	 */
	router.map(routes.actions.monitor.http, {
		actions: {
			create: lazy(
				() => import("~/app/http/controllers/actions/monitors").then((it) => it.createMonitor),
				MEMBER_GUARDS,
			),
			update: lazy(
				() => import("~/app/http/controllers/actions/monitors").then((it) => it.updateMonitor),
				MEMBER_GUARDS,
			),
			delete: lazy(
				() => import("~/app/http/controllers/actions/monitors").then((it) => it.deleteMonitor),
				adminGuards(abilities.monitors.delete),
			),
			play: lazy(
				() => import("~/app/http/controllers/actions/monitors").then((it) => it.playMonitor),
				MEMBER_GUARDS,
			),
			import: lazy(
				() =>
					import("~/app/http/controllers/actions/monitors-import").then((it) => it.importMonitors),
				MEMBER_GUARDS,
			),
			updateSsl: lazy(
				() => import("~/app/http/controllers/actions/ssl").then((it) => it.updateSsl),
				MEMBER_GUARDS,
			),
			createContentCheck: lazy(
				() =>
					import("~/app/http/controllers/actions/content-checks").then(
						(it) => it.createContentCheck,
					),
				MEMBER_GUARDS,
			),
			deleteContentCheck: lazy(
				() =>
					import("~/app/http/controllers/actions/content-checks").then(
						(it) => it.deleteContentCheck,
					),
				MEMBER_GUARDS,
			),
		},
	});
	router.map(routes.actions.monitor.dns, {
		actions: {
			create: lazy(
				() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.createDnsMonitor),
				MEMBER_GUARDS,
			),
			update: lazy(
				() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.updateDnsMonitor),
				MEMBER_GUARDS,
			),
			delete: lazy(
				() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.deleteDnsMonitor),
				adminGuards(abilities.dnsMonitors.delete),
			),
			check: lazy(
				() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.checkDnsMonitor),
				MEMBER_GUARDS,
			),
			review: lazy(
				() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.reviewDnsMonitor),
				MEMBER_GUARDS,
			),
			toggleRecord: lazy(
				() =>
					import("~/app/http/controllers/actions/dns-monitors").then(
						(it) => it.toggleDnsMonitorRecord,
					),
				MEMBER_GUARDS,
			),
			importZoneFile: lazy(
				() =>
					import("~/app/http/controllers/actions/dns-monitors").then(
						(it) => it.importDnsMonitorZoneFile,
					),
				MEMBER_GUARDS,
			),
		},
	});
	router.map(routes.actions.monitor.tcp, {
		actions: {
			create: lazy(
				() =>
					import("~/app/http/controllers/actions/tcp-monitors").then((it) => it.createTcpMonitor),
				MEMBER_GUARDS,
			),
			update: lazy(
				() =>
					import("~/app/http/controllers/actions/tcp-monitors").then((it) => it.updateTcpMonitor),
				MEMBER_GUARDS,
			),
			delete: lazy(
				() =>
					import("~/app/http/controllers/actions/tcp-monitors").then((it) => it.deleteTcpMonitor),
				adminGuards(abilities.tcpMonitors.delete),
			),
			check: lazy(
				() =>
					import("~/app/http/controllers/actions/tcp-monitors").then((it) => it.checkTcpMonitor),
				MEMBER_GUARDS,
			),
		},
	});
	router.map(routes.actions.monitor.flow, {
		actions: {
			create: lazy(
				() =>
					import("~/app/http/controllers/actions/flow-monitors").then((it) => it.createFlowMonitor),
				MEMBER_GUARDS,
			),
			update: lazy(
				() =>
					import("~/app/http/controllers/actions/flow-monitors").then((it) => it.updateFlowMonitor),
				MEMBER_GUARDS,
			),
			delete: lazy(
				() =>
					import("~/app/http/controllers/actions/flow-monitors").then((it) => it.deleteFlowMonitor),
				adminGuards(abilities.flowMonitors.delete),
			),
			check: lazy(
				() =>
					import("~/app/http/controllers/actions/flow-monitors").then((it) => it.checkFlowMonitor),
				MEMBER_GUARDS,
			),
		},
	});
	router.map(routes.actions.cronJob, {
		actions: {
			create: lazy(
				() => import("~/app/http/controllers/actions/cron-jobs").then((it) => it.createCronJob),
				MEMBER_GUARDS,
			),
			update: lazy(
				() => import("~/app/http/controllers/actions/cron-jobs").then((it) => it.updateCronJob),
				MEMBER_GUARDS,
			),
			delete: lazy(
				() => import("~/app/http/controllers/actions/cron-jobs").then((it) => it.deleteCronJob),
				adminGuards(abilities.cronJobs.delete),
			),
		},
	});
	router.map(routes.actions.alert, {
		actions: {
			create: lazy(
				() => import("~/app/http/controllers/actions/alerts").then((it) => it.createAlert),
				MEMBER_GUARDS,
			),
			update: lazy(
				() => import("~/app/http/controllers/actions/alerts").then((it) => it.updateAlert),
				MEMBER_GUARDS,
			),
			delete: lazy(
				() => import("~/app/http/controllers/actions/alerts").then((it) => it.deleteAlert),
				MEMBER_GUARDS,
			),
		},
	});
	router.map(routes.actions.maintenanceWindow, {
		actions: {
			create: lazy(
				() =>
					import("~/app/http/controllers/actions/maintenance-windows").then(
						(it) => it.createMaintenanceWindow,
					),
				MEMBER_GUARDS,
			),
			update: lazy(
				() =>
					import("~/app/http/controllers/actions/maintenance-windows").then(
						(it) => it.updateMaintenanceWindow,
					),
				MEMBER_GUARDS,
			),
			delete: lazy(
				() =>
					import("~/app/http/controllers/actions/maintenance-windows").then(
						(it) => it.deleteMaintenanceWindow,
					),
				MEMBER_GUARDS,
			),
			end: lazy(
				() =>
					import("~/app/http/controllers/actions/maintenance-windows").then(
						(it) => it.endMaintenanceWindow,
					),
				MEMBER_GUARDS,
			),
		},
	});
	router.map(routes.actions.statusPage, {
		actions: {
			create: lazy(
				() =>
					import("~/app/http/controllers/actions/status-pages").then((it) => it.createStatusPage),
				MEMBER_GUARDS,
			),
			update: lazy(
				() =>
					import("~/app/http/controllers/actions/status-pages").then((it) => it.updateStatusPage),
				MEMBER_GUARDS,
			),
			delete: lazy(
				() =>
					import("~/app/http/controllers/actions/status-pages").then((it) => it.deleteStatusPage),
				MEMBER_GUARDS,
			),
		},
	});
	/**
	 * `setDashboardTab` bakes its own `requireUser`/`requireTeam` chain into its
	 * own `createAction()` call, the same pattern the `app.team.*` page
	 * controllers above use — a single `Route` takes middleware only via `createAction()`.
	 */
	router.map(
		routes.actions.setDashboardTab,
		lazy(() => import("~/app/http/controllers/actions/dashboard").then((it) => it.setDashboardTab)),
	);
	/** `runPing` is a single `Route` too, so it carries the same self-contained chain. */
	router.map(
		routes.actions.runPing,
		lazy(() => import("~/app/http/controllers/actions/ping").then((it) => it.runPing)),
	);

	/**
	 * A separate group from `actions` above (see `routes/web.ts`'s docblock on
	 * `teamAdminActions`): each action adds the ability it performs to the same member-level
	 * chain.
	 */
	router.map(routes.teamAdminActions.team, {
		actions: {
			update: lazy(
				() => import("~/app/http/controllers/actions/team").then((it) => it.updateTeam),
				adminGuards(abilities.team.update),
			),
			delete: lazy(
				() => import("~/app/http/controllers/actions/team").then((it) => it.deleteTeam),
				adminGuards(abilities.team.update),
			),
		},
	});
	router.map(routes.teamAdminActions.member, {
		actions: {
			remove: lazy(
				() => import("~/app/http/controllers/actions/team").then((it) => it.removeMember),
				adminGuards(abilities.members.manage),
			),
			changeRole: lazy(
				() => import("~/app/http/controllers/actions/team").then((it) => it.changeRole),
				adminGuards(abilities.members.manage),
			),
		},
	});
	router.map(routes.teamAdminActions.invite, {
		actions: {
			create: lazy(
				() => import("~/app/http/controllers/actions/invites").then((it) => it.createInvite),
				adminGuards(abilities.invites.write),
			),
			revoke: lazy(
				() => import("~/app/http/controllers/actions/invites").then((it) => it.revokeInvite),
				adminGuards(abilities.invites.write),
			),
		},
	});
	router.map(routes.teamAdminActions.domain, {
		actions: {
			add: lazy(
				() => import("~/app/http/controllers/actions/team-domains").then((it) => it.addDomain),
				adminGuards(abilities.domains.write),
			),
			remove: lazy(
				() => import("~/app/http/controllers/actions/team-domains").then((it) => it.removeDomain),
				adminGuards(abilities.domains.write),
			),
			retryVerification: lazy(
				() =>
					import("~/app/http/controllers/actions/team-domains").then(
						(it) => it.retryDomainVerification,
					),
				adminGuards(abilities.domains.write),
			),
		},
	});
	router.map(routes.teamAdminActions.apiKey, {
		actions: {
			create: lazy(
				() => import("~/app/http/controllers/actions/api-keys").then((it) => it.createApiKey),
				adminGuards(abilities.apiKeys.write),
			),
			delete: lazy(
				() => import("~/app/http/controllers/actions/api-keys").then((it) => it.deleteApiKey),
				adminGuards(abilities.apiKeys.write),
			),
		},
	});

	/**
	 * Guarded by `requireUser` alone. Reached from the account page, which lists
	 * every team the viewer belongs to, so each action carries its own team id.
	 */
	router.map(routes.accountActions, {
		actions: {
			createTeam: lazy(
				() => import("~/app/http/controllers/actions/account").then((it) => it.createTeam),
				ACCOUNT_GUARDS,
			),
			leaveTeam: lazy(
				() => import("~/app/http/controllers/actions/account").then((it) => it.leaveTeam),
				ACCOUNT_GUARDS,
			),
			updateLanguage: lazy(
				() => import("~/app/http/controllers/actions/account").then((it) => it.updateLanguage),
				ACCOUNT_GUARDS,
			),
			updateEmails: lazy(
				() => import("~/app/http/controllers/actions/account").then((it) => it.updateEmails),
				ACCOUNT_GUARDS,
			),
			exportData: lazy(
				() => import("~/app/http/controllers/actions/account").then((it) => it.exportData),
				ACCOUNT_GUARDS,
			),
			requestDeletion: lazy(
				() => import("~/app/http/controllers/actions/account").then((it) => it.requestDeletion),
				ACCOUNT_GUARDS,
			),
			cancelDeletion: lazy(
				() => import("~/app/http/controllers/actions/account").then((it) => it.cancelDeletion),
				ACCOUNT_GUARDS,
			),
		},
	});

	/**
	 * Cron-job ping endpoint, authenticated by a `cron-jobs:ping` API key. Its
	 * `createAction()` middleware bakes in a per-caller budget; see its controller's
	 * docblock for the full authorization rationale.
	 */
	router.map(
		routes.api.cronJobPing,
		lazy(() => import("~/app/http/controllers/api/cron-job-ping")),
	);
	router.map(
		routes.api.metadata,
		lazy(() => import("~/app/http/controllers/api/protected-resource")),
	);

	/**
	 * Inbound webhooks, gated by `MACHINE_PATH_PREFIXES` above: the sender
	 * proves itself with a signature over the request body, verified by each
	 * controller before acting — standing in for the auth guard and `cop`.
	 */
	router.map(
		routes.webhooks.polar,
		lazy(() => import("~/app/http/controllers/webhooks/polar")),
	);

	/**
	 * Bearer-API-key-gated REST API. Each file with 2+ actions wires through one
	 * `createController()` call keyed by its own route-map object, declared in
	 * `routes/api-groups.ts` so mapping a group here leaves its controller unloaded.
	 */
	router.map(
		routes.api.v1.openapi,
		lazy(() => import("~/app/http/controllers/api/openapi")),
	);
	router.map(
		routes.api.v1.status,
		lazy(() => import("~/app/http/controllers/api/status").then((it) => it.statusShow)),
	);
	router.map(
		routes.api.v1.backfillDailyStats,
		lazy(() =>
			import("~/app/http/controllers/api/backfill-daily-stats").then(
				(it) => it.backfillDailyStatsCreate,
			),
		),
	);
	router.map(
		routes.api.v1.ping,
		lazy(() => import("~/app/http/controllers/api/ping")),
	);
	router.map(
		routes.api.v1.guestProbe,
		lazy(() => import("~/app/http/controllers/api/guest-probe")),
	);

	router.map(
		monitorsRoutes,
		lazy(() => import("~/app/http/controllers/api/monitors")),
	);
	router.map(
		monitorRoutes,
		lazy(() => import("~/app/http/controllers/api/monitor")),
	);
	router.map(
		monitorContentChecksRoutes,
		lazy(() => import("~/app/http/controllers/api/monitor-content-checks")),
	);

	router.map(
		dnsMonitorsRoutes,
		lazy(() => import("~/app/http/controllers/api/dns-monitors")),
	);
	router.map(
		dnsMonitorRoutes,
		lazy(() => import("~/app/http/controllers/api/dns-monitor")),
	);
	router.map(
		dnsMonitorRecordsRoutes,
		lazy(() => import("~/app/http/controllers/api/dns-monitor-records")),
	);

	router.map(
		tcpMonitorsRoutes,
		lazy(() => import("~/app/http/controllers/api/tcp-monitors")),
	);
	router.map(
		tcpMonitorRoutes,
		lazy(() => import("~/app/http/controllers/api/tcp-monitor")),
	);

	router.map(
		flowMonitorsRoutes,
		lazy(() => import("~/app/http/controllers/api/flow-monitors")),
	);

	router.map(
		cronJobsRoutes,
		lazy(() => import("~/app/http/controllers/api/cron-jobs")),
	);
	router.map(
		cronJobRoutes,
		lazy(() => import("~/app/http/controllers/api/cron-job")),
	);

	router.map(
		alertsRoutes,
		lazy(() => import("~/app/http/controllers/api/alerts")),
	);
	router.map(
		alertRoutes,
		lazy(() => import("~/app/http/controllers/api/alert")),
	);

	router.map(
		maintenanceRoutes,
		lazy(() => import("~/app/http/controllers/api/maintenance")),
	);
	router.map(
		maintenanceWindowRoutes,
		lazy(() => import("~/app/http/controllers/api/maintenance-window")),
	);

	router.map(
		statusPagesRoutes,
		lazy(() => import("~/app/http/controllers/api/status-pages")),
	);
	router.map(
		reportsRoutes,
		lazy(() => import("~/app/http/controllers/api/reports")),
	);
	router.map(
		statusPageRoutes,
		lazy(() => import("~/app/http/controllers/api/status-page")),
	);

	router.map(
		invitesRoutes,
		lazy(() => import("~/app/http/controllers/api/invites")),
	);
	router.map(
		routes.api.v1.invites.destroy,
		lazy(() => import("~/app/http/controllers/api/invite").then((it) => it.inviteDestroy)),
	);

	router.map(
		routes.api.v1.memberships,
		lazy(() => import("~/app/http/controllers/api/memberships").then((it) => it.membershipsIndex)),
	);

	router.map(
		teamRoutes,
		lazy(() => import("~/app/http/controllers/api/team")),
	);

	router.map(
		teamDomainsRoutes,
		lazy(() => import("~/app/http/controllers/api/team-domains")),
	);

	router.map(
		apiKeysRoutes,
		lazy(() => import("~/app/http/controllers/api/api-keys")),
	);
	router.map(
		routes.api.v1.apiKeys.destroy,
		lazy(() => import("~/app/http/controllers/api/api-key").then((it) => it.apiKeyDestroy)),
	);

	return router;
}

function isMachinePath(pathname: string): boolean {
	return MACHINE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Scopes a global middleware to the HTML surface: requests under one of the
 * {@link MACHINE_PATH_PREFIXES} skip it and continue the chain unchanged. Use
 * it for page-only work; middleware both surfaces need stays unwrapped.
 *
 * @param middleware - The middleware to run for everything outside those prefixes.
 * @returns A middleware that either delegates to it or continues the chain.
 */
function htmlOnly(middleware: Middleware): Middleware {
	return (context, next) => {
		if (isMachinePath(context.url.pathname)) return next();
		return middleware(context, next);
	};
}
