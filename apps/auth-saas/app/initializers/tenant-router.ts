/**
 * The tenant router for `routes/tenant.ts`: the protocol endpoints a request resolved to one
 * tenant reaches (discovery, JWKS, `/userinfo`, token, registration), `/authorize`, the hosted
 * `/u/*` pages, `/device`, and SCIM, each imported on first use behind its rate limits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { assets } from "@sdxc/assets-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import mailer from "@sdxc/mail/middleware";
import { SecurityHeadersKey, securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { redirect } from "@sdxc/well-known/change-password";
import { wellKnown } from "@sdxc/well-known/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import notFound from "~/app/http/controllers/not-found";
import i18n from "~/app/http/middleware/i18n";
import { platformSender } from "~/app/http/middleware/mail-sender";
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
import { turnstileProvider } from "~/app/http/middleware/turnstile-verification";
import { assetResolver } from "~/app/initializers/assets";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { MAIL_FROM, queue, transport } from "~/app/initializers/mail-transport";
import { turnstile } from "~/app/initializers/turnstile";
import { userinfoMetadataEntry } from "~/app/initializers/userinfo-resource";
import { TENANT_SECURITY_POLICY } from "~/config/security-policy";
import { securityTxtEntry } from "~/config/security-txt";
import routes from "~/routes/tenant";

/**
 * The tenant router, with a `404` default handler. `bootstrap/worker.ts` and the platform
 * router's hosted-page fallback call `tenantRouter.fetch(request)` once the resolved
 * tenant's facts are stamped onto the request's internal headers.
 *
 * @example
 * return await tenantRouter.fetch(request);
 */
export const tenantRouter = createRouter({
	middleware: [
		log(logger),
		getClientIP(),
		trace(),
		asyncContext(),
		securityHeaders(TENANT_SECURITY_POLICY),
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
		/**
		 * Every hosted page links the hosted document's stylesheets and the island entry under
		 * the nonce `securityHeaders()` above publishes, so the policy allows the inline import map.
		 */
		assets(assetResolver, {
			stylesheets: "resources/views/hosted/document.tsx",
			script: "bootstrap/browser.ts",
			nonce: (ctx) =>
				ctx.has(SecurityHeadersKey) ? ctx.get(SecurityHeadersKey)?.nonce : undefined,
		}),
		render({ assets: assetResolver }),
		formData(),
		i18n,
		platformSender(MAIL_FROM),
		mailer({ transport, from: MAIL_FROM, mail, queue }),
		turnstileProvider(turnstile),
	],
	defaultHandler: notFound,
});

/**
 * One shared registration per protected surface: every route mounted with the
 * same instance spends from that one surface's own budget, keyed the way its
 * class requires, rather than each route getting a budget of its own.
 */
let credentialRateLimit = interactiveCredentialRateLimit(env.CREDENTIAL_RATE_LIMITER, env);
let mailRateLimit = mailSendingRateLimit(env.MAIL_RATE_LIMIT_KV, {}, env);
/** The reset form's complete leg carries a `ticket` and sends no mail of its own. */
let resetMailRateLimit = mailSendingRateLimit(
	env.MAIL_RATE_LIMIT_KV,
	{ skip: (context) => context.url.searchParams.get("ticket") !== null },
	env,
);
let protocolLimit = protocolRateLimit(env.PROTOCOL_RATE_LIMITER, env);

/**
 * Shared across `/u/sign-in`, `/u/reset` and `/u/magic-link` alike, so one
 * address builds up a single trigger regardless of which of the three
 * screens it is on.
 */
let credentialTurnstileChallenge = turnstileChallenge(env.TURNSTILE_CHALLENGE_KV);

tenantRouter.map(
	routes.openidConfiguration,
	lazy(() => import("~/app/http/controllers/well-known/openid-configuration"), [protocolLimit]),
);
tenantRouter.map(
	routes.oauthAuthorizationServer,
	lazy(
		() => import("~/app/http/controllers/well-known/oauth-authorization-server"),
		[protocolLimit],
	),
);
tenantRouter.map(
	routes.jwks,
	lazy(() => import("~/app/http/controllers/well-known/jwks"), [protocolLimit]),
);
tenantRouter.map(
	routes.userinfoGet,
	lazy(
		() => import("~/app/http/controllers/userinfo").then((it) => it.userinfoGet),
		[protocolLimit],
	),
);
tenantRouter.map(
	routes.userinfoPost,
	lazy(
		() => import("~/app/http/controllers/userinfo").then((it) => it.userinfoPost),
		[protocolLimit],
	),
);
tenantRouter.map(
	routes.token,
	lazy(
		() => import("~/app/http/controllers/oauth/token"),
		[tokenRateLimit(env.TOKEN_RATE_LIMITER, env)],
	),
);
tenantRouter.map(
	routes.pushedAuthorizationRequest,
	lazy(
		() => import("~/app/http/controllers/oauth/par"),
		[tokenRateLimit(env.TOKEN_RATE_LIMITER, env)],
	),
);
tenantRouter.map(
	routes.register,
	lazy(() => import("~/app/http/controllers/oauth/register"), [protocolLimit]),
);
tenantRouter.map(
	routes.deviceAuthorization,
	lazy(
		() => import("~/app/http/controllers/oauth/device-authorization"),
		[deviceAuthorizationRateLimit(env.DEVICE_AUTHORIZATION_RATE_LIMITER, env)],
	),
);
tenantRouter.map(
	routes.tokenIntrospection,
	lazy(
		() => import("~/app/http/controllers/oauth/token-introspection"),
		[tokenRateLimit(env.TOKEN_RATE_LIMITER, env)],
	),
);
tenantRouter.map(
	routes.revoke,
	lazy(
		() => import("~/app/http/controllers/oauth/revoke"),
		[tokenRateLimit(env.TOKEN_RATE_LIMITER, env)],
	),
);
tenantRouter.map(
	routes.apiKeysIntrospect,
	lazy(() => import("~/app/http/controllers/oauth/introspect")),
);
tenantRouter.map(
	routes.authorize,
	lazy(
		() => import("~/app/http/controllers/authorize"),
		[authorizationRateLimit(env.AUTHORIZATION_RATE_LIMITER, env)],
	),
);
tenantRouter.map(
	routes.hostedSignInShow,
	lazy(
		() => import("~/app/http/controllers/hosted/sign-in").then((it) => it.signInShow),
		[credentialTurnstileChallenge],
	),
);
tenantRouter.map(
	routes.hostedSignInSubmit,
	lazy(
		() => import("~/app/http/controllers/hosted/sign-in").then((it) => it.signInSubmit),
		[credentialTurnstileChallenge, credentialRateLimit],
	),
);
tenantRouter.map(
	routes.hostedSignInPasskeyOptions,
	lazy(() =>
		import("~/app/http/controllers/hosted/sign-in-passkey").then((it) => it.signInPasskeyOptions),
	),
);
tenantRouter.map(
	routes.hostedSignInPasskeyVerify,
	lazy(() =>
		import("~/app/http/controllers/hosted/sign-in-passkey").then((it) => it.signInPasskeyVerify),
	),
);
tenantRouter.map(
	routes.hostedSecondFactorShow,
	lazy(() =>
		import("~/app/http/controllers/hosted/second-factor").then((it) => it.secondFactorShow),
	),
);
tenantRouter.map(
	routes.hostedSecondFactorSubmit,
	lazy(
		() => import("~/app/http/controllers/hosted/second-factor").then((it) => it.secondFactorSubmit),
		[credentialRateLimit],
	),
);
tenantRouter.map(
	routes.hostedSecondFactorEnrolSubmit,
	lazy(() =>
		import("~/app/http/controllers/hosted/second-factor").then((it) => it.secondFactorEnrolSubmit),
	),
);
tenantRouter.map(
	routes.hostedSecondFactorContinueSubmit,
	lazy(() =>
		import("~/app/http/controllers/hosted/second-factor").then(
			(it) => it.secondFactorContinueSubmit,
		),
	),
);
tenantRouter.map(
	routes.hostedStepUpShow,
	lazy(() => import("~/app/http/controllers/hosted/step-up").then((it) => it.stepUpShow)),
);
tenantRouter.map(
	routes.hostedStepUpSubmit,
	lazy(
		() => import("~/app/http/controllers/hosted/step-up").then((it) => it.stepUpSubmit),
		[credentialRateLimit],
	),
);
tenantRouter.map(
	routes.hostedStepUpEnrolSubmit,
	lazy(() => import("~/app/http/controllers/hosted/step-up").then((it) => it.stepUpEnrolSubmit)),
);
tenantRouter.map(
	routes.hostedStepUpContinueSubmit,
	lazy(() => import("~/app/http/controllers/hosted/step-up").then((it) => it.stepUpContinueSubmit)),
);
tenantRouter.map(
	routes.hostedConsentShow,
	lazy(() => import("~/app/http/controllers/hosted/consent").then((it) => it.consentShow)),
);
tenantRouter.map(
	routes.hostedConsentSubmit,
	lazy(() => import("~/app/http/controllers/hosted/consent").then((it) => it.consentSubmit)),
);
tenantRouter.map(
	routes.hostedDeviceShow,
	lazy(
		() => import("~/app/http/controllers/hosted/device").then((it) => it.hostedDeviceShow),
		[
			deviceApprovalRateLimit(
				env.DEVICE_APPROVAL_SESSION_RATE_LIMIT_KV,
				env.DEVICE_APPROVAL_ADDRESS_RATE_LIMIT_KV,
				env,
			),
		],
	),
);
tenantRouter.map(
	routes.hostedDeviceSubmit,
	lazy(() => import("~/app/http/controllers/hosted/device").then((it) => it.hostedDeviceSubmit)),
);
tenantRouter.map(
	routes.hostedSignUpShow,
	lazy(() => import("~/app/http/controllers/hosted/sign-up").then((it) => it.signUpShow)),
);
tenantRouter.map(
	routes.hostedSignUpSubmit,
	lazy(
		() => import("~/app/http/controllers/hosted/sign-up").then((it) => it.signUpSubmit),
		[credentialRateLimit, mailRateLimit],
	),
);
tenantRouter.map(
	routes.hostedVerifyShow,
	lazy(() => import("~/app/http/controllers/hosted/verify").then((it) => it.verifyShow)),
);
tenantRouter.map(
	routes.hostedVerifyResend,
	lazy(
		() => import("~/app/http/controllers/hosted/verify").then((it) => it.verifyResend),
		[mailRateLimit],
	),
);
tenantRouter.map(
	routes.hostedResetShow,
	lazy(
		() => import("~/app/http/controllers/hosted/reset").then((it) => it.resetShow),
		[credentialTurnstileChallenge],
	),
);
tenantRouter.map(
	routes.hostedResetSubmit,
	lazy(
		() => import("~/app/http/controllers/hosted/reset").then((it) => it.resetSubmit),
		[credentialTurnstileChallenge, credentialRateLimit, resetMailRateLimit],
	),
);
tenantRouter.map(
	routes.hostedMagicLinkShow,
	lazy(
		() => import("~/app/http/controllers/hosted/magic-link").then((it) => it.magicLinkShow),
		[credentialTurnstileChallenge],
	),
);
tenantRouter.map(
	routes.hostedMagicLinkSubmit,
	lazy(
		() => import("~/app/http/controllers/hosted/magic-link").then((it) => it.magicLinkSubmit),
		[
			credentialTurnstileChallenge,
			credentialRateLimit,
			magicLinkRateLimit(env.MAGIC_LINK_RATE_LIMIT_KV, env),
		],
	),
);
tenantRouter.map(
	routes.hostedMagicLinkCompleteShow,
	lazy(() =>
		import("~/app/http/controllers/hosted/magic-link").then((it) => it.magicLinkCompleteShow),
	),
);
tenantRouter.map(
	routes.hostedMagicLinkCompleteSubmit,
	lazy(
		() =>
			import("~/app/http/controllers/hosted/magic-link").then((it) => it.magicLinkCompleteSubmit),
		[credentialRateLimit],
	),
);
tenantRouter.map(
	routes.hostedError,
	lazy(() => import("~/app/http/controllers/hosted/error").then((it) => it.errorShow)),
);
tenantRouter.map(
	routes.cspReports,
	lazy(() => import("~/app/http/controllers/csp-reports").then((it) => it.cspReports)),
);

/**
 * Every `/scim/v2/*` resource route shares the write budget `MANAGEMENT_RATE_LIMITER`
 * gives it, keyed on the presented token's own digest: its 100-per-60s rate is the closest
 * single number the binding can express to the write volume a provisioning sync produces.
 */
tenantRouter.map(
	routes.scimUsersCreate,
	lazy(() =>
		import("~/app/http/controllers/scim/users").then(
			(it) => it.createScimUsersController(env.MANAGEMENT_RATE_LIMITER).create,
		),
	),
);
tenantRouter.map(
	routes.scimUsersList,
	lazy(() =>
		import("~/app/http/controllers/scim/users").then(
			(it) => it.createScimUsersController(env.MANAGEMENT_RATE_LIMITER).list,
		),
	),
);
tenantRouter.map(
	routes.scimUsersRead,
	lazy(() =>
		import("~/app/http/controllers/scim/users").then(
			(it) => it.createScimUsersController(env.MANAGEMENT_RATE_LIMITER).read,
		),
	),
);
tenantRouter.map(
	routes.scimUsersReplace,
	lazy(() =>
		import("~/app/http/controllers/scim/users").then(
			(it) => it.createScimUsersController(env.MANAGEMENT_RATE_LIMITER).replace,
		),
	),
);
tenantRouter.map(
	routes.scimUsersPatch,
	lazy(() =>
		import("~/app/http/controllers/scim/users").then(
			(it) => it.createScimUsersController(env.MANAGEMENT_RATE_LIMITER).patch,
		),
	),
);
tenantRouter.map(
	routes.scimUsersDelete,
	lazy(() =>
		import("~/app/http/controllers/scim/users").then(
			(it) => it.createScimUsersController(env.MANAGEMENT_RATE_LIMITER).delete,
		),
	),
);

tenantRouter.map(
	routes.scimGroupsCreate,
	lazy(() =>
		import("~/app/http/controllers/scim/groups").then(
			(it) => it.createScimGroupsController(env.MANAGEMENT_RATE_LIMITER).create,
		),
	),
);
tenantRouter.map(
	routes.scimGroupsList,
	lazy(() =>
		import("~/app/http/controllers/scim/groups").then(
			(it) => it.createScimGroupsController(env.MANAGEMENT_RATE_LIMITER).list,
		),
	),
);
tenantRouter.map(
	routes.scimGroupsRead,
	lazy(() =>
		import("~/app/http/controllers/scim/groups").then(
			(it) => it.createScimGroupsController(env.MANAGEMENT_RATE_LIMITER).read,
		),
	),
);
tenantRouter.map(
	routes.scimGroupsReplace,
	lazy(() =>
		import("~/app/http/controllers/scim/groups").then(
			(it) => it.createScimGroupsController(env.MANAGEMENT_RATE_LIMITER).replace,
		),
	),
);
tenantRouter.map(
	routes.scimGroupsPatch,
	lazy(() =>
		import("~/app/http/controllers/scim/groups").then(
			(it) => it.createScimGroupsController(env.MANAGEMENT_RATE_LIMITER).patch,
		),
	),
);
tenantRouter.map(
	routes.scimGroupsDelete,
	lazy(() =>
		import("~/app/http/controllers/scim/groups").then(
			(it) => it.createScimGroupsController(env.MANAGEMENT_RATE_LIMITER).delete,
		),
	),
);
tenantRouter.map(
	routes.scimServiceProviderConfig,
	lazy(() =>
		import("~/app/http/controllers/scim/discovery").then((it) => it.scimServiceProviderConfig),
	),
);
tenantRouter.map(
	routes.scimResourceTypes,
	lazy(() => import("~/app/http/controllers/scim/discovery").then((it) => it.scimResourceTypes)),
);
tenantRouter.map(
	routes.scimSchemas,
	lazy(() => import("~/app/http/controllers/scim/discovery").then((it) => it.scimSchemas)),
);
tenantRouter.map(
	routes.scimBulk,
	lazy(() => import("~/app/http/controllers/scim/unsupported").then((it) => it.scimBulk)),
);
tenantRouter.map(
	routes.scimMe,
	lazy(() => import("~/app/http/controllers/scim/unsupported").then((it) => it.scimMe)),
);
