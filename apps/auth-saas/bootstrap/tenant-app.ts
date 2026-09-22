/**
 * Builds the tenant router's fetch-router: the pure-JSON protocol endpoints a
 * request already resolved to one tenant reaches — discovery, JWKS, `/userinfo`,
 * and the token endpoint — alongside `/authorize` and the hosted sign-in,
 * sign-up, second-factor, verify, reset, consent and error pages served under
 * `/u/` on the tenant's own hostname.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";

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
import {
	secondFactorContinueSubmit,
	secondFactorEnrolSubmit,
	secondFactorShow,
	secondFactorSubmit,
} from "~/app/http/controllers/hosted/second-factor";
import { signInShow, signInSubmit } from "~/app/http/controllers/hosted/sign-in";
import {
	signInPasskeyOptions,
	signInPasskeyVerify,
} from "~/app/http/controllers/hosted/sign-in-passkey";
import { signUpShow, signUpSubmit } from "~/app/http/controllers/hosted/sign-up";
import { verifyResend, verifyShow } from "~/app/http/controllers/hosted/verify";
import notFound from "~/app/http/controllers/not-found";
import introspect from "~/app/http/controllers/oauth/introspect";
import token from "~/app/http/controllers/oauth/token";
import {
	scimResourceTypes,
	scimSchemas,
	scimServiceProviderConfig,
} from "~/app/http/controllers/scim/discovery";
import { createScimGroupsController } from "~/app/http/controllers/scim/groups";
import { scimBulk, scimMe } from "~/app/http/controllers/scim/unsupported";
import { createScimUsersController } from "~/app/http/controllers/scim/users";
import { userinfoGet, userinfoPost } from "~/app/http/controllers/userinfo";
import jwks from "~/app/http/controllers/well-known/jwks";
import oauthAuthorizationServer from "~/app/http/controllers/well-known/oauth-authorization-server";
import openidConfiguration from "~/app/http/controllers/well-known/openid-configuration";
import i18n from "~/app/http/middleware/i18n";
import { platformSender } from "~/app/http/middleware/mail-sender";
import render from "~/app/http/middleware/render";
import { tenant } from "~/app/http/middleware/tenant";
import {
	authorizationRateLimit,
	interactiveCredentialRateLimit,
	mailSendingRateLimit,
	protocolRateLimit,
	tokenRateLimit,
} from "~/app/http/middleware/tenant-rate-limit";
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

/**
 * One shared registration per protected surface: every route mounted with the
 * same instance spends from that one surface's own budget, keyed the way its
 * class requires, rather than each route getting a budget of its own.
 */
let credentialRateLimit = interactiveCredentialRateLimit(env.CREDENTIAL_RATE_LIMITER);
let mailRateLimit = mailSendingRateLimit(env.MAIL_RATE_LIMIT_KV);
let resetMailRateLimit = mailSendingRateLimit(env.MAIL_RATE_LIMIT_KV, {
	// The reset form's complete leg carries a `ticket` and sends no mail of its own.
	skip: (context) => context.url.searchParams.get("ticket") !== null,
});
let protocolLimit = protocolRateLimit(env.PROTOCOL_RATE_LIMITER);

tenantRouter.map(routes.openidConfiguration, {
	middleware: [protocolLimit],
	handler: openidConfiguration as RequestHandler,
});
tenantRouter.map(routes.oauthAuthorizationServer, {
	middleware: [protocolLimit],
	handler: oauthAuthorizationServer as RequestHandler,
});
tenantRouter.map(routes.jwks, { middleware: [protocolLimit], handler: jwks as RequestHandler });
tenantRouter.map(routes.userinfoGet, {
	middleware: [protocolLimit],
	handler: userinfoGet as RequestHandler,
});
tenantRouter.map(routes.userinfoPost, {
	middleware: [protocolLimit],
	handler: userinfoPost as RequestHandler,
});
tenantRouter.map(routes.token, {
	middleware: [tokenRateLimit(env.TOKEN_RATE_LIMITER)],
	handler: token as RequestHandler,
});
tenantRouter.map(routes.apiKeysIntrospect, introspect);
tenantRouter.map(routes.authorize, {
	middleware: [authorizationRateLimit(env.AUTHORIZATION_RATE_LIMITER)],
	handler: authorize as RequestHandler,
});
tenantRouter.map(routes.hostedSignInShow, signInShow);
tenantRouter.map(routes.hostedSignInSubmit, {
	middleware: [credentialRateLimit],
	handler: signInSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedSignInPasskeyOptions, signInPasskeyOptions);
tenantRouter.map(routes.hostedSignInPasskeyVerify, signInPasskeyVerify);
tenantRouter.map(routes.hostedSecondFactorShow, secondFactorShow);
tenantRouter.map(routes.hostedSecondFactorSubmit, {
	middleware: [credentialRateLimit],
	handler: secondFactorSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedSecondFactorEnrolSubmit, secondFactorEnrolSubmit);
tenantRouter.map(routes.hostedSecondFactorContinueSubmit, secondFactorContinueSubmit);
tenantRouter.map(routes.hostedConsentShow, consentShow);
tenantRouter.map(routes.hostedConsentSubmit, consentSubmit);
tenantRouter.map(routes.hostedSignUpShow, signUpShow);
tenantRouter.map(routes.hostedSignUpSubmit, {
	middleware: [credentialRateLimit, mailRateLimit],
	handler: signUpSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedVerifyShow, verifyShow);
tenantRouter.map(routes.hostedVerifyResend, {
	middleware: [mailRateLimit],
	handler: verifyResend as RequestHandler,
});
tenantRouter.map(routes.hostedResetShow, resetShow);
tenantRouter.map(routes.hostedResetSubmit, {
	middleware: [credentialRateLimit, resetMailRateLimit],
	handler: resetSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedError, errorShow);

/**
 * The write budget every `/scim/v2/*` resource route shares, keyed on the
 * presented token's own digest rather than the caller's address —
 * `MANAGEMENT_RATE_LIMITER`'s 100-per-60s configured rate is the closest
 * single number this binding can express to the write volume a provisioning
 * sync produces, standing in for the 20/s-sustained, 100-burst shape a
 * Cloudflare rate limiter cannot represent as two tiers.
 */
let scimUsers = createScimUsersController(env.MANAGEMENT_RATE_LIMITER);
let scimGroups = createScimGroupsController(env.MANAGEMENT_RATE_LIMITER);

tenantRouter.map(routes.scimUsersCreate, scimUsers.create);
tenantRouter.map(routes.scimUsersList, scimUsers.list);
tenantRouter.map(routes.scimUsersRead, scimUsers.read);
tenantRouter.map(routes.scimUsersReplace, scimUsers.replace);
tenantRouter.map(routes.scimUsersPatch, scimUsers.patch);
tenantRouter.map(routes.scimUsersDelete, scimUsers.delete);

tenantRouter.map(routes.scimGroupsCreate, scimGroups.create);
tenantRouter.map(routes.scimGroupsList, scimGroups.list);
tenantRouter.map(routes.scimGroupsRead, scimGroups.read);
tenantRouter.map(routes.scimGroupsReplace, scimGroups.replace);
tenantRouter.map(routes.scimGroupsPatch, scimGroups.patch);
tenantRouter.map(routes.scimGroupsDelete, scimGroups.delete);

tenantRouter.map(routes.scimServiceProviderConfig, scimServiceProviderConfig);
tenantRouter.map(routes.scimResourceTypes, scimResourceTypes);
tenantRouter.map(routes.scimSchemas, scimSchemas);
tenantRouter.map(routes.scimBulk, scimBulk);
tenantRouter.map(routes.scimMe, scimMe);
