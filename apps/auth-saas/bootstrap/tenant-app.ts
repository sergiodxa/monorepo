/**
 * Builds the tenant router's fetch-router: the pure-JSON protocol endpoints a
 * request already resolved to one tenant reaches — discovery, JWKS, `/userinfo`,
 * and the token endpoint — alongside `/authorize` and the hosted sign-in,
 * sign-up, verify, reset, consent and error pages served under `/u/` on the
 * tenant's own hostname.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import mail from "@sdxc/mail/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import authorize from "~/app/http/controllers/authorize";
import { consentShow, consentSubmit } from "~/app/http/controllers/hosted/consent";
import { errorShow } from "~/app/http/controllers/hosted/error";
import { resetShow, resetSubmit } from "~/app/http/controllers/hosted/reset";
import { signInShow, signInSubmit } from "~/app/http/controllers/hosted/sign-in";
import {
	signInPasskeyOptions,
	signInPasskeyVerify,
} from "~/app/http/controllers/hosted/sign-in-passkey";
import { signUpShow, signUpSubmit } from "~/app/http/controllers/hosted/sign-up";
import { verifyResend, verifyShow } from "~/app/http/controllers/hosted/verify";
import notFound from "~/app/http/controllers/not-found";
import token from "~/app/http/controllers/oauth/token";
import { userinfoGet, userinfoPost } from "~/app/http/controllers/userinfo";
import jwks from "~/app/http/controllers/well-known/jwks";
import oauthAuthorizationServer from "~/app/http/controllers/well-known/oauth-authorization-server";
import openidConfiguration from "~/app/http/controllers/well-known/openid-configuration";
import i18n from "~/app/http/middleware/i18n";
import { platformSender } from "~/app/http/middleware/mail-sender";
import render from "~/app/http/middleware/render";
import { tenant } from "~/app/http/middleware/tenant";
import { parseSenderAddress } from "~/app/mail/sender";
import routes from "~/routes/tenant";

import { logger } from "./logger";

/** The platform's own configured sender, shared by the mail middleware's base identity and every per-tenant override. */
let platformFrom = parseSenderAddress(env.EMAIL_FROM);

/** Kept as a non-tuple `Middleware[]` so the router context stays the base `RequestContext`. */
let globalMiddleware: Middleware[] = [
	log(logger) as Middleware,
	asyncContext(),
	tenant((tenantId) => env.TENANT.getByName(tenantId)),
	render as Middleware,
	formData() as Middleware,
	i18n as Middleware,
	platformSender(platformFrom),
	mail({ transport: new CloudflareTransport(env.SEND_EMAIL), from: platformFrom }) as Middleware,
];

/**
 * The tenant router, configured with the global middleware chain and a `404`
 * default handler. `bootstrap/worker.ts`'s `forwardToTenant` calls
 * `tenantRouter.fetch(request)` once it has stamped the resolved tenant's facts
 * onto the request's internal headers.
 *
 * @example
 * return await tenantRouter.fetch(request);
 */
export const tenantRouter = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

tenantRouter.map(routes.openidConfiguration, openidConfiguration);
tenantRouter.map(routes.oauthAuthorizationServer, oauthAuthorizationServer);
tenantRouter.map(routes.jwks, jwks);
tenantRouter.map(routes.userinfoGet, userinfoGet);
tenantRouter.map(routes.userinfoPost, userinfoPost);
tenantRouter.map(routes.token, token);
tenantRouter.map(routes.authorize, authorize);
tenantRouter.map(routes.hostedSignInShow, signInShow);
tenantRouter.map(routes.hostedSignInSubmit, signInSubmit);
tenantRouter.map(routes.hostedSignInPasskeyOptions, signInPasskeyOptions);
tenantRouter.map(routes.hostedSignInPasskeyVerify, signInPasskeyVerify);
tenantRouter.map(routes.hostedConsentShow, consentShow);
tenantRouter.map(routes.hostedConsentSubmit, consentSubmit);
tenantRouter.map(routes.hostedSignUpShow, signUpShow);
tenantRouter.map(routes.hostedSignUpSubmit, signUpSubmit);
tenantRouter.map(routes.hostedVerifyShow, verifyShow);
tenantRouter.map(routes.hostedVerifyResend, verifyResend);
tenantRouter.map(routes.hostedResetShow, resetShow);
tenantRouter.map(routes.hostedResetSubmit, resetSubmit);
tenantRouter.map(routes.hostedError, errorShow);
