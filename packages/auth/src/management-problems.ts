/**
 * The management API's problem types, declared once: the server builds each failure
 * from its entry, and the client reads a failure back through the same catalog, so
 * a `type`, its status and its title are written in exactly one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@remix-run/data-schema";
import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";

/**
 * Every problem type the management API answers with. The base URL and slugs are the
 * wire contract a caller branches on, so an entry's slug never changes once published.
 * `validationFailed` carries `errors`, one `{ pointer, code, message }` per invalid field.
 *
 * @example return managementProblems.notFound({ detail: "No subject has that id." });
 */
export const managementProblems = defineProblems("https://docs.example.com/errors/", {
	attributeNotWritable: {
		slug: "attribute-not-writable",
		status: 403,
		title: "This caller may not write one of the given attributes",
	},
	badCursor: {
		slug: "bad-cursor",
		status: 400,
		title: "The given cursor no longer matches this ordering",
	},
	duplicatePermission: {
		slug: "duplicate-permission",
		status: 409,
		title: "This tenant already has a permission under this key",
	},
	duplicateRole: {
		slug: "duplicate-role",
		status: 409,
		title: "This scope already has a role under this key",
	},
	duplicateUsername: {
		slug: "duplicate-username",
		status: 400,
		title: "Only one username may be claimed at creation",
	},
	entitlementRequired: {
		slug: "entitlement-required",
		status: 403,
		title: "This tenant's plan does not include this feature",
	},
	expiredTicket: {
		slug: "expired-ticket",
		status: 400,
		title: "This verification ticket has expired",
	},
	expiryTooFar: {
		slug: "expiry-too-far",
		status: 400,
		title: "The requested expiry exceeds the longest a key may live",
	},
	forbidden: {
		slug: "forbidden",
		status: 403,
		title: "This caller may not administer this tenant",
	},
	hostnameRegistrationFailed: {
		slug: "hostname-registration-failed",
		status: 502,
		title: "Cloudflare refused to register this hostname",
	},
	identifierTaken: {
		slug: "identifier-taken",
		status: 409,
		title: "An identifier is already claimed",
	},
	invalidAuthMethod: {
		slug: "invalid-auth-method",
		status: 400,
		title: "This auth method does not match the client's kind",
	},
	invalidDomainKind: {
		slug: "invalid-domain-kind",
		status: 400,
		title: "A platform domain may not be attached through this API",
	},
	invalidGrantType: {
		slug: "invalid-grant-type",
		status: 400,
		title: "One of the given grant types is not supported",
	},
	invalidIdentifier: {
		slug: "invalid-identifier",
		status: 400,
		title: "An identifier is not valid",
	},
	invalidPostLogoutRedirectUri: {
		slug: "invalid-post-logout-redirect-uri",
		status: 400,
		title: "One of the given post-logout redirect URIs is not valid",
	},
	invalidReassignment: {
		slug: "invalid-reassignment",
		status: 400,
		title: "The reassignment target does not exist at this role's own scope",
	},
	invalidRedirectUri: {
		slug: "invalid-redirect-uri",
		status: 400,
		title: "One of the given redirect URIs is not valid",
	},
	invalidRequest: {
		slug: "invalid-request",
		status: 400,
		title: "The paging parameters are not valid",
	},
	invalidResponseType: {
		slug: "invalid-response-type",
		status: 400,
		title: "One of the given response types is not supported",
	},
	invalidVerificationTicket: {
		slug: "invalid-verification-ticket",
		status: 400,
		title: "This verification ticket does not match a pending identifier",
	},
	invalidTicket: {
		slug: "invalid-ticket",
		status: 404,
		title: "This link no longer works",
	},
	invalidUrl: {
		slug: "invalid-url",
		status: 400,
		title: "The given URL is not valid for a webhook endpoint",
	},
	kindImmutable: {
		slug: "kind-immutable",
		status: 409,
		title: "A client's kind may not change once registered",
	},
	lastCredential: {
		slug: "last-credential",
		status: 409,
		title: "This subject's last remaining credential may not be removed",
	},
	lastLiveSecret: {
		slug: "last-live-secret",
		status: 409,
		title: "This client's last live secret may not be revoked",
	},
	lastOwner: {
		slug: "last-owner",
		status: 409,
		title: "This scope's last owner may not be reassigned",
	},
	lastVerifiedIdentifier: {
		slug: "last-verified-identifier",
		status: 409,
		title: "This subject's last verified identifier may not be removed",
	},
	noPassword: {
		slug: "no-password",
		status: 409,
		title: "This subject holds no password to reset",
	},
	notConfidential: {
		slug: "not-confidential",
		status: 409,
		title: "Only a confidential client holds a secret to rotate",
	},
	notFound: {
		slug: "not-found",
		status: 404,
		title: "The resource does not exist",
	},
	notMember: {
		slug: "not-member",
		status: 409,
		title: "This subject does not belong to this organization",
	},
	overlapTooLong: {
		slug: "overlap-too-long",
		status: 400,
		title: "The requested overlap window exceeds the longest one a rotation may open",
	},
	permissionSetTooLarge: {
		slug: "permission-set-too-large",
		status: 400,
		title: "This set of permission keys exceeds what a role may grant",
	},
	prefixNotSet: {
		slug: "prefix-not-set",
		status: 409,
		title: "This tenant has not set its own API key prefix yet",
	},
	rateLimited: {
		slug: "rate-limited",
		status: 429,
		title: "Too many requests have been sent",
	},
	reservedKey: {
		slug: "reserved-key",
		status: 400,
		title: "This key is reserved for the platform",
	},
	scopeNotHeld: {
		slug: "scope-not-held",
		status: 400,
		title: "The issuing subject does not hold one of the requested scopes",
	},
	systemRole: {
		slug: "system-role",
		status: 409,
		title: "A system role may not be changed",
	},
	tooManyLiveSecrets: {
		slug: "too-many-live-secrets",
		status: 409,
		title: "This client already holds the most secrets it may hold at once",
	},
	unauthorized: {
		slug: "unauthorized",
		status: 401,
		title: "This request could not be authenticated",
	},
	unknownAttribute: {
		slug: "unknown-attribute",
		status: 400,
		title: "One of the given attributes has no declared definition",
	},
	unknownEventType: {
		slug: "unknown-event-type",
		status: 400,
		title: "One of the given event types is not recognized",
	},
	unknownPermission: {
		slug: "unknown-permission",
		status: 400,
		title: "One of the given permission keys has no declared definition",
	},
	unsupportedApiVersion: {
		slug: "unsupported-api-version",
		status: 400,
		title: "This API version is not published",
	},
	unverified: {
		slug: "unverified",
		status: 409,
		title: "An unverified identifier may not become primary",
	},
	usernameAlreadySet: {
		slug: "username-already-set",
		status: 409,
		title: "This subject already holds a username",
	},
	validationFailed: {
		slug: "validation-failed",
		status: 400,
		title: "The request did not pass validation",
		extensions: s.object({ errors: s.optional(ISSUES_SCHEMA) }),
	},
});
