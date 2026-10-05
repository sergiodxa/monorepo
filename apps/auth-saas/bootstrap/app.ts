/**
 * Builds the platform Worker's fetch-router: assembles the global middleware chain
 * (trailing-slash, logging, async context, database, rendering, form data, method
 * override) and maps the public routes to their controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";

import { Turnstile } from "@sdxc/captcha/turnstile";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { log } from "@sdxc/logger/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { wellKnown } from "@sdxc/well-known/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { createRouter } from "remix/router";

import billingCheckout from "~/app/http/controllers/billing/checkout";
import billingCheckoutReturn from "~/app/http/controllers/billing/checkout-return";
import billingPortal from "~/app/http/controllers/billing/portal";
import billingWebhook from "~/app/http/controllers/billing/webhook";
import { cspReports } from "~/app/http/controllers/csp-reports";
import {
	dashboardAgentClientsRegister,
	dashboardAgentClientsShow,
} from "~/app/http/controllers/dashboard/agent-clients";
import { dashboardCreateTenant, dashboardShow } from "~/app/http/controllers/dashboard/show";
import { dashboardSignOut } from "~/app/http/controllers/dashboard/sign-out";
import health from "~/app/http/controllers/health";
import index from "~/app/http/controllers/index";
import notFound from "~/app/http/controllers/not-found";
import signupPending from "~/app/http/controllers/signup/pending";
import signupResend from "~/app/http/controllers/signup/resend";
import { signupShow, signupSubmit } from "~/app/http/controllers/signup/show";
import signupVerify from "~/app/http/controllers/signup/verify";
import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import { mail } from "~/app/http/middleware/mail";
import render from "~/app/http/middleware/render";
import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
} from "~/app/http/middleware/tenant";
import { turnstileVerification } from "~/app/http/middleware/turnstile-verification";
import { PLATFORM_SECURITY_POLICY } from "~/app/http/security-policy";
import { createDatabase } from "~/app/lib/database";
import { securityTxtEntry } from "~/app/lib/security-txt";
import routes from "~/routes/web";

import { logger } from "./logger";
import { tenantRouter } from "./tenant-app";

/**
 * The hosted pages this platform's own bare domain answers directly, addressed
 * at the platform tenant's own subject store rather than a signed-up
 * customer's. Matched exactly, never by prefix, so a path that merely shares a
 * segment with one of these (`/u/sign-up` alongside `/u/sign-in`) stays a 404;
 * a hosted path added later reaches this domain only by a deliberate addition
 * here.
 */
const PLATFORM_HOSTED_PATHS = new Set([
	"/u/sign-in",
	"/u/sign-in/passkey/options",
	"/u/sign-in/passkey/verify",
	"/u/second-factor",
	"/u/second-factor/enrol",
	"/u/second-factor/continue",
	"/u/reset",
	"/u/magic-link",
	"/u/magic-link/complete",
	"/u/error",
]);

/**
 * Forwards a request to the tenant router carrying the platform tenant's own
 * synthetic identity: it has no control-plane row to resolve one from, being
 * addressed purely by the Durable Object name every other platform-tenant call
 * already uses.
 *
 * A `GET`/`HEAD` request's body is untouched, so the original request crosses
 * over unchanged. Anything else already had its body drained by this router's
 * own `formData()` middleware before the fallback ever ran, so it is rebuilt
 * from the form fields that middleware already parsed rather than replayed
 * from a stream that can only be read once; the original `Content-Type` is
 * dropped first so the rebuilt body's own multipart header takes its place.
 *
 * @param ctx - The request context (provides `request` and `formData`).
 * @returns The tenant router's response for that request.
 */
async function forwardToPlatformTenant(ctx: RequestContext): Promise<Response> {
	let headers = new Headers(ctx.request.headers);
	headers.set(TENANT_ID_HEADER, env.PLATFORM_DOMAIN);
	headers.set(TENANT_REGION_HEADER, "wnam");
	headers.set(TENANT_ISSUER_HEADER, `https://${env.PLATFORM_DOMAIN}`);

	let method = ctx.request.method;
	if (method === "GET" || method === "HEAD") {
		return await tenantRouter.fetch(new Request(ctx.request.url, { method, headers }));
	}

	headers.delete("content-type");
	return await tenantRouter.fetch(
		new Request(ctx.request.url, { method, headers, body: ctx.formData }),
	);
}

/**
 * The platform router's fallback: forwards an allowlisted hosted path to the
 * tenant router addressed at the platform tenant, and answers the same `404`
 * as before for anything else.
 *
 * @param ctx - The request context (provides `request`, `url` and `formData`).
 * @returns The forwarded hosted page, or a plain `404 Not Found`.
 */
export const platformTenantForward: RequestHandler = (ctx) => {
	if (PLATFORM_HOSTED_PATHS.has(ctx.url.pathname)) return forwardToPlatformTenant(ctx);
	return notFound(ctx);
};

/**
 * Kept as a non-tuple Middleware[] so the router context stays the base
 * RequestContext; `formData()` is cast to Middleware since its value is
 * surfaced via the global `formData` context augmentation.
 */
let globalMiddleware: Middleware[] = [
	/**
	 * Runs first so every later middleware treats a `HEAD` probe as the `GET`
	 * request behind it.
	 */
	headRequests(),
	trailingSlash(),
	log(logger) as Middleware,
	getClientIP(),
	trace() as Middleware,
	asyncContext(),
	securityHeaders(PLATFORM_SECURITY_POLICY) as Middleware,
	wellKnown({ "security.txt": securityTxtEntry }),
	database(createDatabase),
	mail(),
	render as Middleware,
	formData() as Middleware,
	methodOverride(),
];

/**
 * The platform Worker's router, configured with the global middleware chain and a
 * default handler that forwards the platform tenant's own allowlisted hosted
 * pages and answers `404` for anything else. Routes are registered onto it
 * below; the worker entry calls `router.fetch(request)`.
 *
 * @example
 * return await router.fetch(request);
 */
export const router = createRouter({
	middleware: globalMiddleware,
	defaultHandler: platformTenantForward,
});

router.map(routes.index, index);
router.map(routes.health, health);
router.map(routes.cspReports, cspReports);
router.map(routes.billing.checkout, billingCheckout);
router.map(routes.billing.checkoutReturn, billingCheckoutReturn);
router.map(routes.billing.portal, billingPortal);
router.map(routes.billing.webhook, billingWebhook);

router.map(routes.signup.show, signupShow);
router.map(routes.signup.submit, {
	middleware: [
		i18n as Middleware,
		turnstileVerification(new Turnstile({ secretKey: env.TURNSTILE_SECRET_KEY })),
	],
	handler: signupSubmit as RequestHandler,
});
router.map(routes.signup.pending, signupPending);
router.map(routes.signup.verify, signupVerify);
router.map(routes.signup.resend, signupResend);

router.map(routes.dashboard.show, dashboardShow);
router.map(routes.dashboard.createTenant, dashboardCreateTenant);
router.map(routes.dashboard.agentClients, dashboardAgentClientsShow);
router.map(routes.dashboard.registerAgentClient, dashboardAgentClientsRegister);
router.map(routes.dashboard.signOut, dashboardSignOut);
