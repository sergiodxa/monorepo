/**
 * Composition root for the authorization server. Builds the fetch router with the
 * global middleware chain every request passes through and maps each route to its
 * controller, so the wiring lives in one place rather than being spread across
 * controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { Middleware, RequestContext, Router } from "remix/router";
import type { RemixNode } from "remix/ui";
import type { ResolveFrameContext } from "remix/ui/server";

import billing from "@sdxc/billing/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import logger from "@sdxc/logger/middleware";
import mail from "@sdxc/mail/middleware";
import { getServiceContainer } from "@sdxc/service-container";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import grants from "~/app/http/controllers/account/grants";
import profile from "~/app/http/controllers/account/profile";
import profileEdit from "~/app/http/controllers/account/profile-edit";
import sessions from "~/app/http/controllers/account/sessions";
import verifyEmailResend from "~/app/http/controllers/account/verify-email-resend";
import adminClient from "~/app/http/controllers/admin/client";
import adminClientEdit from "~/app/http/controllers/admin/client-edit";
import adminClientNew from "~/app/http/controllers/admin/client-new";
import adminClients from "~/app/http/controllers/admin/clients";
import adminDashboard from "~/app/http/controllers/admin/dashboard";
import adminSubject from "~/app/http/controllers/admin/subject";
import adminSubjectEdit from "~/app/http/controllers/admin/subject-edit";
import adminSubjects from "~/app/http/controllers/admin/subjects";
import apiSubject from "~/app/http/controllers/api/subject";
import selfCallback from "~/app/http/controllers/auth/callback";
import providerLogin from "~/app/http/controllers/auth/provider";
import providerCallback from "~/app/http/controllers/auth/provider-callback";
import authorizeController from "~/app/http/controllers/authorize";
import defaultHandler from "~/app/http/controllers/default-handler";
import healthcheck from "~/app/http/controllers/healthcheck";
import home from "~/app/http/controllers/home";
import introspect from "~/app/http/controllers/oauth/introspect";
import revoke from "~/app/http/controllers/oauth/revoke";
import token from "~/app/http/controllers/oauth/token";
import checkSession from "~/app/http/controllers/oidc/check-session";
import logout from "~/app/http/controllers/oidc/logout";
import passwordForgot from "~/app/http/controllers/password/forgot";
import passwordReset from "~/app/http/controllers/password/reset";
import userinfo from "~/app/http/controllers/userinfo";
import verifyEmail from "~/app/http/controllers/verify-email";
import jwks from "~/app/http/controllers/well-known/jwks";
import oauthAuthorizationServer from "~/app/http/controllers/well-known/oauth-authorization-server";
import openidConfiguration from "~/app/http/controllers/well-known/openid-configuration";
import i18n from "~/app/http/middleware/i18n";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import { polar } from "~/app/lib/billing";
import { MailTransport } from "~/app/services/mail-transport";
import routes from "~/routes/web";

/**
 * Paths exempt from cross-origin protection, each authenticated by its own
 * credential — a client secret or signed token — so misconfiguring this list
 * breaks every relying party's login at once.
 */
const COP_BYPASS_PATTERNS = ["/oauth/{path...}", "/api/{path...}", "/oidc/logout"];

namespace application {
	export interface Options {
		/** KV namespace backing session storage. */
		kv: KVNamespace;
		/** Secret the session cookie is signed with. */
		cookieSecret: string;
		/** Whether the session cookie should be marked `Secure`. */
		secure: boolean;
		/** Cookie domain, so one sign-in covers every subdomain in production. */
		cookieDomain?: string;
		/** Billing platform published on every request; defaults to the configured Polar organization. */
		billing?: Billing;
	}
}

/**
 * Builds the app's fetch-router: global middleware, then every route mapped
 * to its controller. Middleware order matters: normalizing `HEAD` to `GET`
 * runs first so every downstream check treats it like the request it probes.
 */
export default function application(options: application.Options) {
	let middleware: Middleware[] = [
		headRequests(),
		asyncContext(),
		logger,
		formData() as Middleware,
		methodOverride(),
		createSessionMiddleware(
			options.kv,
			options.cookieSecret,
			options.secure,
			options.cookieDomain,
		) as Middleware,
		i18n,
		billing({ provider: options.billing ?? polar }),
		mail({
			transport: () => getServiceContainer().get(MailTransport),
			from: MAIL_FROM,
			replyTo: MAIL_REPLY_TO,
		}),
		cop({ insecureBypassPatterns: COP_BYPASS_PATTERNS }),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({ middleware, defaultHandler });

	router.map(routes.home, home);
	router.map(routes.healthcheck, healthcheck);
	router.map(routes.userinfo, userinfo);
	router.map(routes.authorize, authorizeController);
	router.map(routes.verifyEmail, verifyEmail);

	router.map(routes.password.forgot, passwordForgot);
	router.map(routes.password.reset, passwordReset);

	router.map(routes.auth.provider, providerLogin);
	router.map(routes.auth.providerCallback, providerCallback);
	router.map(routes.auth.callback, selfCallback);

	router.map(routes.oauth.token, token);
	router.map(routes.oauth.revoke, revoke);
	router.map(routes.oauth.introspect, introspect);

	router.map(routes.oidc.logout, logout);
	router.map(routes.oidc.checkSession, checkSession);

	router.map(routes.account.profile, profile);
	router.map(routes.account.profileEdit, profileEdit);
	router.map(routes.account.sessions, sessions);
	router.map(routes.account.grants, grants);
	router.map(routes.account.verifyEmailResend, verifyEmailResend);

	router.map(routes.wellKnown.openidConfiguration, openidConfiguration);
	router.map(routes.wellKnown.oauthAuthorizationServer, oauthAuthorizationServer);
	router.map(routes.wellKnown.jwks, jwks);

	router.map(routes.admin.dashboard, adminDashboard);
	router.map(routes.admin.clients, adminClients);
	router.map(routes.admin.clientNew, adminClientNew);
	router.map(routes.admin.client, adminClient);
	router.map(routes.admin.clientEdit, adminClientEdit);
	router.map(routes.admin.subjects, adminSubjects);
	router.map(routes.admin.subject, adminSubject);
	router.map(routes.admin.subjectEdit, adminSubjectEdit);

	router.map(routes.api.subject, apiSubject);

	return router;
}

/**
 * Creates a request-scoped renderer for server-side HTML responses.
 *
 * Uses `createHtmlResponse` to prepend `<!DOCTYPE html>` onto the stream's
 * first chunk, since JSX serializes text as escaped content.
 */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveFrame(ctx.router, ctx.request, src, target, context);
			},
		});

		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return createHtmlResponse(stream, { ...init, headers });
	};
}

/** Fetches frame HTML through the current router so SSR frames share request context. */
async function resolveFrame(
	router: Router,
	request: Request,
	src: string,
	target?: string,
	context?: ResolveFrameContext,
) {
	let frameSrc = context?.currentFrameSrc ?? request.url;
	let url = new URL(src, frameSrc);
	let headers = new Headers();
	headers.set("accept", "text/html");
	headers.set("accept-encoding", "identity");
	headers.set("x-remix-frame", "true");

	if (target) headers.set("x-remix-target", target);

	let cookie = request.headers.get("cookie");
	if (cookie) headers.set("cookie", cookie);

	let res = await followFrameRedirects(router, request, url, headers);
	if (res.body) return res.body;
	if (res.ok) return res.text();
	return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`;
}

/** Follows SSR frame redirects manually, keeping the original request headers on each hop. */
async function followFrameRedirects(router: Router, request: Request, url: URL, headers: Headers) {
	let currentUrl = url;
	let redirectsRemaining = 10;

	while (true) {
		let res = await router.fetch(
			new Request(currentUrl, { method: "GET", headers, signal: request.signal }),
		);
		let location = res.headers.get("location");
		if (!location || res.status < 300 || res.status >= 400) return res;

		if (redirectsRemaining-- <= 0) throw new Error("Too many frame redirects");
		currentUrl = new URL(location, currentUrl);
	}
}
