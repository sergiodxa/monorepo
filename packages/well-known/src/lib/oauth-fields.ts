/**
 * The mapping tables and identity check the OAuth and OpenID Connect metadata
 * documents share, so OpenID Connect Discovery extends the RFC 8414 members by
 * spreading one table instead of repeating it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { WellKnownParseError } from "../parse-error.js";

import type { FieldTable } from "./metadata.js";

import { sameIdentifier } from "./identifier.js";

/** Every RFC 8414 member, by camelCase field. */
export const AUTHORIZATION_SERVER_FIELDS = {
	issuer: { wire: "issuer", kind: "text", required: true },
	authorizationEndpoint: { wire: "authorization_endpoint", kind: "url" },
	tokenEndpoint: { wire: "token_endpoint", kind: "url" },
	jwksUri: { wire: "jwks_uri", kind: "url" },
	registrationEndpoint: { wire: "registration_endpoint", kind: "url" },
	revocationEndpoint: { wire: "revocation_endpoint", kind: "url" },
	introspectionEndpoint: { wire: "introspection_endpoint", kind: "url" },
	deviceAuthorizationEndpoint: { wire: "device_authorization_endpoint", kind: "url" },
	pushedAuthorizationRequestEndpoint: {
		wire: "pushed_authorization_request_endpoint",
		kind: "url",
	},
	scopesSupported: { wire: "scopes_supported", kind: "strings" },
	responseTypesSupported: { wire: "response_types_supported", kind: "strings", required: true },
	responseModesSupported: { wire: "response_modes_supported", kind: "strings" },
	grantTypesSupported: { wire: "grant_types_supported", kind: "strings" },
	tokenEndpointAuthMethodsSupported: {
		wire: "token_endpoint_auth_methods_supported",
		kind: "strings",
	},
	tokenEndpointAuthSigningAlgValuesSupported: {
		wire: "token_endpoint_auth_signing_alg_values_supported",
		kind: "strings",
	},
	revocationEndpointAuthMethodsSupported: {
		wire: "revocation_endpoint_auth_methods_supported",
		kind: "strings",
	},
	introspectionEndpointAuthMethodsSupported: {
		wire: "introspection_endpoint_auth_methods_supported",
		kind: "strings",
	},
	codeChallengeMethodsSupported: { wire: "code_challenge_methods_supported", kind: "strings" },
	uiLocalesSupported: { wire: "ui_locales_supported", kind: "strings" },
	serviceDocumentation: { wire: "service_documentation", kind: "url" },
	opPolicyUri: { wire: "op_policy_uri", kind: "url" },
	opTosUri: { wire: "op_tos_uri", kind: "url" },
	authorizationResponseIssParameterSupported: {
		wire: "authorization_response_iss_parameter_supported",
		kind: "boolean",
	},
	protectedResources: { wire: "protected_resources", kind: "urls" },
	signedMetadata: { wire: "signed_metadata", kind: "text" },
} satisfies FieldTable;

/**
 * Adds the §3.3 check to a read: the published `issuer` must name the issuer the
 * document was fetched for.
 *
 * @param expected - The issuer asked for, if the caller named one.
 */
export function issuerCheck(expected: URL | string | undefined) {
	return (fields: Record<string, unknown>, issues: WellKnownParseError.Issue[]) => {
		if (expected === undefined) return;
		if (sameIdentifier(String(fields.issuer), expected)) return;
		issues.push({
			at: "/issuer",
			message: `The document names issuer "${String(fields.issuer)}", not "${String(expected)}".`,
		});
	};
}

/**
 * OpenID Connect Discovery §3 members over the RFC 8414 ones. `authorization_endpoint`
 * and `jwks_uri` become required, and `request_uri_parameter_supported` defaults to
 * `true`, as §3 states for an absent member.
 */
export const OPENID_PROVIDER_FIELDS = {
	...AUTHORIZATION_SERVER_FIELDS,
	authorizationEndpoint: { wire: "authorization_endpoint", kind: "url", required: true },
	jwksUri: { wire: "jwks_uri", kind: "url", required: true },
	userinfoEndpoint: { wire: "userinfo_endpoint", kind: "url" },
	endSessionEndpoint: { wire: "end_session_endpoint", kind: "url" },
	checkSessionIframe: { wire: "check_session_iframe", kind: "url" },
	subjectTypesSupported: { wire: "subject_types_supported", kind: "strings", required: true },
	idTokenSigningAlgValuesSupported: {
		wire: "id_token_signing_alg_values_supported",
		kind: "strings",
		required: true,
	},
	claimsSupported: { wire: "claims_supported", kind: "strings" },
	promptValuesSupported: { wire: "prompt_values_supported", kind: "strings" },
	acrValuesSupported: { wire: "acr_values_supported", kind: "strings" },
	requestParameterSupported: { wire: "request_parameter_supported", kind: "boolean" },
	requestUriParameterSupported: {
		wire: "request_uri_parameter_supported",
		kind: "boolean",
		default: true,
	},
	frontchannelLogoutSupported: { wire: "frontchannel_logout_supported", kind: "boolean" },
	frontchannelLogoutSessionSupported: {
		wire: "frontchannel_logout_session_supported",
		kind: "boolean",
	},
	backchannelLogoutSupported: { wire: "backchannel_logout_supported", kind: "boolean" },
	backchannelLogoutSessionSupported: {
		wire: "backchannel_logout_session_supported",
		kind: "boolean",
	},
} satisfies FieldTable;
