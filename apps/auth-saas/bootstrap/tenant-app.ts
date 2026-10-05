/**
 * Builds the tenant router's fetch-router: the pure-JSON protocol endpoints a
 * request already resolved to one tenant reaches — discovery, JWKS, `/userinfo`,
 * and the token endpoint — alongside `/authorize` and the hosted sign-in,
 * sign-up, second-factor, step-up, verify, reset, magic-link, consent and error
 * pages served under `/u/`, and the device authorization grant's own
 * verification screen at `/device`, on the tenant's own hostname.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";

import { Turnstile } from "@sdxc/captcha/turnstile";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { log } from "@sdxc/logger/middleware";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import mail from "@sdxc/mail/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { redirect } from "@sdxc/well-known/change-password";
import { wellKnown } from "@sdxc/well-known/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import authorize from "~/app/http/controllers/authorize";
import { cspReports } from "~/app/http/controllers/csp-reports";
import { consentShow, consentSubmit } from "~/app/http/controllers/hosted/consent";
import { hostedDeviceShow, hostedDeviceSubmit } from "~/app/http/controllers/hosted/device";
import { errorShow } from "~/app/http/controllers/hosted/error";
import {
	magicLinkCompleteShow,
	magicLinkCompleteSubmit,
	magicLinkShow,
	magicLinkSubmit,
} from "~/app/http/controllers/hosted/magic-link";
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
import {
	stepUpContinueSubmit,
	stepUpEnrolSubmit,
	stepUpShow,
	stepUpSubmit,
} from "~/app/http/controllers/hosted/step-up";
import { verifyResend, verifyShow } from "~/app/http/controllers/hosted/verify";
import notFound from "~/app/http/controllers/not-found";
import deviceAuthorization from "~/app/http/controllers/oauth/device-authorization";
import introspect from "~/app/http/controllers/oauth/introspect";
import register from "~/app/http/controllers/oauth/register";
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
	deviceApprovalRateLimit,
	deviceAuthorizationRateLimit,
	interactiveCredentialRateLimit,
	magicLinkRateLimit,
	mailSendingRateLimit,
	protocolRateLimit,
	tokenRateLimit,
} from "~/app/http/middleware/tenant-rate-limit";
import { turnstileChallenge } from "~/app/http/middleware/turnstile-challenge";
import { turnstileVerification } from "~/app/http/middleware/turnstile-verification";
import { TENANT_SECURITY_POLICY } from "~/app/http/security-policy";
import { securityTxtEntry } from "~/app/lib/security-txt";
import { userinfoMetadataEntry } from "~/app/lib/userinfo-resource";
import { parseSenderAddress } from "~/app/mail/sender";
import routes from "~/routes/tenant";

import { logger } from "./logger";

/** The platform's own configured sender, shared by the mail middleware's base identity and every per-tenant override. */
let platformFrom = parseSenderAddress(env.EMAIL_FROM);

/** Kept as a non-tuple `Middleware[]` so the router context stays the base `RequestContext`. */
let globalMiddleware: Middleware[] = [
	log(logger) as Middleware,
	getClientIP(),
	trace() as Middleware,
	asyncContext(),
	securityHeaders(TENANT_SECURITY_POLICY) as Middleware,
	/**
	 * The hosted reset flow is the one page where a person sets a new password on a
	 * tenant host, so password managers are sent there.
	 */
	wellKnown({
		"security.txt": securityTxtEntry,
		"change-password": () => redirect(routes.hostedResetShow.href()),
		"oauth-protected-resource": userinfoMetadataEntry,
	}),
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
let credentialRateLimit = interactiveCredentialRateLimit(env.CREDENTIAL_RATE_LIMITER, env);
let mailRateLimit = mailSendingRateLimit(env.MAIL_RATE_LIMIT_KV, {}, env);
let resetMailRateLimit = mailSendingRateLimit(
	env.MAIL_RATE_LIMIT_KV,
	{
		// The reset form's complete leg carries a `ticket` and sends no mail of its own.
		skip: (context) => context.url.searchParams.get("ticket") !== null,
	},
	env,
);
let protocolLimit = protocolRateLimit(env.PROTOCOL_RATE_LIMITER, env);

/**
 * Shared across `/u/sign-in`, `/u/reset` and `/u/magic-link` alike, so one
 * address builds up a single trigger regardless of which of the three
 * screens it is on.
 */
let credentialTurnstileChallenge = turnstileChallenge(env.TURNSTILE_CHALLENGE_KV);

/** Verifies the token every hosted form that can challenge submits, after its rate limits. */
let submittedTurnstile = turnstileVerification(
	new Turnstile({ secretKey: env.TURNSTILE_SECRET_KEY }),
);

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
	middleware: [tokenRateLimit(env.TOKEN_RATE_LIMITER, env)],
	handler: token as RequestHandler,
});
tenantRouter.map(routes.register, {
	middleware: [protocolLimit],
	handler: register as RequestHandler,
});
tenantRouter.map(routes.deviceAuthorization, {
	middleware: [deviceAuthorizationRateLimit(env.DEVICE_AUTHORIZATION_RATE_LIMITER, env)],
	handler: deviceAuthorization as RequestHandler,
});
tenantRouter.map(routes.apiKeysIntrospect, introspect);
tenantRouter.map(routes.authorize, {
	middleware: [authorizationRateLimit(env.AUTHORIZATION_RATE_LIMITER, env)],
	handler: authorize as RequestHandler,
});
tenantRouter.map(routes.hostedSignInShow, {
	middleware: [credentialTurnstileChallenge],
	handler: signInShow as RequestHandler,
});
tenantRouter.map(routes.hostedSignInSubmit, {
	middleware: [credentialTurnstileChallenge, credentialRateLimit, submittedTurnstile],
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
tenantRouter.map(routes.hostedStepUpShow, stepUpShow);
tenantRouter.map(routes.hostedStepUpSubmit, {
	middleware: [credentialRateLimit],
	handler: stepUpSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedStepUpEnrolSubmit, stepUpEnrolSubmit);
tenantRouter.map(routes.hostedStepUpContinueSubmit, stepUpContinueSubmit);
tenantRouter.map(routes.hostedConsentShow, consentShow);
tenantRouter.map(routes.hostedConsentSubmit, consentSubmit);
tenantRouter.map(routes.hostedDeviceShow, {
	middleware: [
		deviceApprovalRateLimit(
			env.DEVICE_APPROVAL_SESSION_RATE_LIMIT_KV,
			env.DEVICE_APPROVAL_ADDRESS_RATE_LIMIT_KV,
			env,
		),
	],
	handler: hostedDeviceShow as RequestHandler,
});
tenantRouter.map(routes.hostedDeviceSubmit, hostedDeviceSubmit);
tenantRouter.map(routes.hostedSignUpShow, signUpShow);
tenantRouter.map(routes.hostedSignUpSubmit, {
	middleware: [credentialRateLimit, mailRateLimit, submittedTurnstile],
	handler: signUpSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedVerifyShow, verifyShow);
tenantRouter.map(routes.hostedVerifyResend, {
	middleware: [mailRateLimit],
	handler: verifyResend as RequestHandler,
});
tenantRouter.map(routes.hostedResetShow, {
	middleware: [credentialTurnstileChallenge],
	handler: resetShow as RequestHandler,
});
tenantRouter.map(routes.hostedResetSubmit, {
	middleware: [
		credentialTurnstileChallenge,
		credentialRateLimit,
		resetMailRateLimit,
		submittedTurnstile,
	],
	handler: resetSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedMagicLinkShow, {
	middleware: [credentialTurnstileChallenge],
	handler: magicLinkShow as RequestHandler,
});
tenantRouter.map(routes.hostedMagicLinkSubmit, {
	middleware: [
		credentialTurnstileChallenge,
		credentialRateLimit,
		magicLinkRateLimit(env.MAGIC_LINK_RATE_LIMIT_KV, env),
		submittedTurnstile,
	],
	handler: magicLinkSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedMagicLinkCompleteShow, magicLinkCompleteShow);
tenantRouter.map(routes.hostedMagicLinkCompleteSubmit, {
	middleware: [credentialRateLimit],
	handler: magicLinkCompleteSubmit as RequestHandler,
});
tenantRouter.map(routes.hostedError, errorShow);
tenantRouter.map(routes.cspReports, cspReports);

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
