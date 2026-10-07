/**
 * The management API's operations for the tenant, its members, its domains, and its sign-in
 * policies: the schemas each route's handler parses with and the OpenAPI document publishes,
 * so the two cannot drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";

import {
	AUTH_PROBLEMS,
	IDEMPOTENCY_DESCRIPTION,
	IDEMPOTENCY_PROBLEMS,
	requires,
} from "~/app/http/openapi/shared";
import routes from "~/routes/management";

/** The roles a membership grants, from full control (`owner`) down to read access (`member`). */
const MEMBER_ROLE = s.enum_(["owner", "admin", "member"] as const);

/** The tenant as its own administrators see it; timestamps are epoch milliseconds. */
export const TENANT = s
	.object({
		id: s.string(),
		name: s.string(),
		slug: s.string(),
		issuer: s.string(),
		region: s.enum_(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const),
		status: s.enum_(["active", "suspended", "deleted"] as const),
		planSlug: s.string(),
		subscriptionStatus: s.string(),
		currentPeriodEnd: s.nullable(s.integer()),
		cancelAtPeriodEnd: s.boolean(),
		graceUntil: s.nullable(s.integer()),
		lapsedAt: s.nullable(s.integer()),
		createdAt: s.integer(),
		updatedAt: s.integer(),
	})
	.meta({ id: "Tenant" });

/** One platform subject's access to the tenant's dashboard, at one role. */
export const MEMBERSHIP = s
	.object({
		id: s.string(),
		tenantId: s.string(),
		subjectId: s.string(),
		role: MEMBER_ROLE,
		createdAt: s.integer(),
		updatedAt: s.integer(),
	})
	.meta({ id: "Membership" });

/** A domain's verification and activation state; the DV record is `null` until Cloudflare issues one. */
export const DOMAIN_VERIFICATION = s
	.object({
		status: s.enum_(["pending", "active", "failed"] as const),
		certificateStatus: s.nullable(s.string()),
		verificationName: s.nullable(s.string()),
		verificationValue: s.nullable(s.string()),
	})
	.meta({ id: "DomainVerification" });

/** A hostname serving the tenant: the platform default, or a custom domain it attached. */
export const DOMAIN = s
	.object({
		id: s.string(),
		tenantId: s.string(),
		hostname: s.string(),
		kind: s.enum_(["platform", "custom"] as const),
		status: s.enum_(["pending", "active", "failed"] as const),
		certificateStatus: s.nullable(s.string()),
		verificationName: s.nullable(s.string()),
		verificationValue: s.nullable(s.string()),
		createdAt: s.integer(),
		updatedAt: s.integer(),
	})
	.meta({ id: "Domain" });

/** What a revocation after a password or credential change reaches: other sessions, or every one. */
const SESSIONS_AFTER_CREDENTIAL_CHANGE = s.enum_(["revoke-others", "revoke-all"] as const);

/** The tenant's own session customizations; a `null` field falls back to the platform default. */
export const STORED_SESSION_POLICY = s
	.object({
		sessionAbsoluteLifetimeMs: s.nullable(s.number()),
		sessionIdleLifetimeMs: s.nullable(s.number()),
		refreshTokenLifetimeMs: s.nullable(s.number()),
		concurrentSessionLimit: s.nullable(s.number()),
		sessionsAfterCredentialChange: s.nullable(SESSIONS_AFTER_CREDENTIAL_CHANGE),
	})
	.meta({ id: "StoredSessionPolicy" });

/**
 * One effective session setting and where it comes from.
 *
 * @param value - The setting's value schema.
 * @returns The `{ value, source }` pair the describe route reports.
 */
function sourced<Value extends s.Schema<any, any>>(value: Value) {
	return s.object({ value, source: s.enum_(["default", "tenant"] as const) });
}

/** A numeric setting's writable range and platform default. */
const LIFETIME_BOUNDS = s.object({ floor: s.number(), ceiling: s.number(), default: s.number() });

/** The session settings the tenant enforces now, and the range a write may choose within. */
export const SESSION_POLICY_DESCRIPTION = s
	.object({
		absoluteLifetimeMs: sourced(s.number()),
		idleLifetimeMs: sourced(s.number()),
		refreshTokenLifetimeMs: sourced(s.number()),
		concurrentSessionLimit: sourced(s.nullable(s.number())),
		sessionsAfterCredentialChange: sourced(SESSIONS_AFTER_CREDENTIAL_CHANGE),
		bounds: s.object({
			absoluteLifetimeMs: LIFETIME_BOUNDS,
			idleLifetimeMs: LIFETIME_BOUNDS,
			refreshTokenLifetimeMs: LIFETIME_BOUNDS,
			concurrentSessionLimit: s.object({
				floor: s.number(),
				ceiling: s.number(),
				default: s.nullable(s.number()),
			}),
			sessionsAfterCredentialChange: s.object({
				values: s.array(SESSIONS_AFTER_CREDENTIAL_CHANGE),
				default: SESSIONS_AFTER_CREDENTIAL_CHANGE,
			}),
		}),
	})
	.meta({ id: "SessionPolicyDescription" });

/** The path every tenant-level route shares. */
const TENANT_PARAMS = s.object({ tenantId: s.string() });

/** The path every single-membership route shares. */
const MEMBERSHIP_PARAMS = s.object({ tenantId: s.string(), membershipId: s.string() });

/** The path every single-domain route shares. */
const DOMAIN_PARAMS = s.object({ tenantId: s.string(), domainId: s.string() });

/** `GET /tenants/:tenantId`: the tenant's name, issuer, region and billing state. */
export const TENANT_READ = defineOperation("tenantRead", routes.tenantRead, {
	summary: "Read the tenant",
	tags: ["Tenant"],
	params: TENANT_PARAMS,
	responses: { 200: { description: "The tenant", body: TENANT } },
	problems: [...AUTH_PROBLEMS, "notFound"],
	security: requires("tenant:write"),
});

/** `GET /tenants/:tenantId/members`: every membership, unpaginated. */
export const TENANT_MEMBERS_LIST = defineOperation("tenantMembersList", routes.tenantMembersList, {
	summary: "List members",
	tags: ["Members"],
	params: TENANT_PARAMS,
	responses: { 200: { description: "Every membership", body: s.array(MEMBERSHIP) } },
	problems: [...AUTH_PROBLEMS],
	security: requires("members:write"),
});

/** `POST /tenants/:tenantId/members`: grants a known platform subject access at a role. */
export const TENANT_MEMBERS_CREATE = defineOperation(
	"tenantMembersCreate",
	routes.tenantMembersCreate,
	{
		summary: "Add a member",
		description:
			"Grants an existing platform subject access; invite an address instead to email one.",
		tags: ["Members"],
		params: TENANT_PARAMS,
		body: s.object({ subjectId: s.string(), role: MEMBER_ROLE }),
		responses: { 201: { description: "The membership granted", body: MEMBERSHIP } },
		problems: [...AUTH_PROBLEMS, "validationFailed"],
		security: requires("members:write"),
	},
);

/** `POST /tenants/:tenantId/members/invite`: emails a single-use accept link, superseding any pending one. */
export const TENANT_MEMBERS_INVITE = defineOperation(
	"tenantMembersInvite",
	routes.tenantMembersInvite,
	{
		summary: "Invite a member",
		description: `Emails the address a link, valid for 7 days, that grants the role once accepted. ${IDEMPOTENCY_DESCRIPTION}`,
		tags: ["Members"],
		params: TENANT_PARAMS,
		body: s.object({ email: s.string(), role: MEMBER_ROLE }),
		responses: {
			201: {
				description: "The invitation sent; `expiresAt` is epoch milliseconds",
				body: s.object({ id: s.string(), expiresAt: s.integer() }),
			},
		},
		problems: [...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS, "validationFailed"],
		security: requires("members:write"),
	},
);

/** `PUT /tenants/:tenantId/members/:membershipId`: replaces a membership's role. */
export const TENANT_MEMBERS_UPDATE_ROLE = defineOperation(
	"tenantMembersUpdateRole",
	routes.tenantMembersUpdateRole,
	{
		summary: "Change a member's role",
		tags: ["Members"],
		params: MEMBERSHIP_PARAMS,
		body: s.object({ role: MEMBER_ROLE }),
		responses: { 200: { description: "The updated membership", body: MEMBERSHIP } },
		problems: [...AUTH_PROBLEMS, "validationFailed", "notFound", "lastOwner"],
		security: requires("members:write"),
	},
);

/** `DELETE /tenants/:tenantId/members/:membershipId`: revokes a membership. */
export const TENANT_MEMBERS_REMOVE = defineOperation(
	"tenantMembersRemove",
	routes.tenantMembersRemove,
	{
		summary: "Remove a member",
		tags: ["Members"],
		params: MEMBERSHIP_PARAMS,
		responses: { 204: { description: "The membership was revoked" } },
		problems: [...AUTH_PROBLEMS, "notFound", "lastOwner"],
		security: requires("members:write"),
	},
);

/** `GET /tenants/:tenantId/domains`: the platform default and every custom domain, unpaginated. */
export const TENANT_DOMAINS_LIST = defineOperation("tenantDomainsList", routes.tenantDomainsList, {
	summary: "List domains",
	tags: ["Domains"],
	params: TENANT_PARAMS,
	responses: { 200: { description: "Every domain", body: s.array(DOMAIN) } },
	problems: [...AUTH_PROBLEMS],
	security: requires("tenant:write"),
});

/** `POST /tenants/:tenantId/domains`: registers a custom hostname with Cloudflare, pending verification. */
export const TENANT_DOMAINS_ATTACH = defineOperation(
	"tenantDomainsAttach",
	routes.tenantDomainsAttach,
	{
		summary: "Attach a custom domain",
		description:
			"Registers the hostname and answers the DV record to publish. Only `custom` is attachable, on a paid plan.",
		tags: ["Domains"],
		params: TENANT_PARAMS,
		body: s.object({ hostname: s.string(), kind: s.enum_(["platform", "custom"] as const) }),
		responses: { 201: { description: "The domain, pending verification", body: DOMAIN } },
		problems: [
			...AUTH_PROBLEMS,
			"validationFailed",
			"invalidDomainKind",
			"entitlementRequired",
			"hostnameRegistrationFailed",
		],
		security: requires("tenant:write"),
	},
);

/** `GET /tenants/:tenantId/domains/:domainId/verification`: one domain's verification state. */
export const TENANT_DOMAINS_VERIFICATION = defineOperation(
	"tenantDomainsVerification",
	routes.tenantDomainsVerification,
	{
		summary: "Read a domain's verification",
		tags: ["Domains"],
		params: DOMAIN_PARAMS,
		responses: { 200: { description: "The verification state", body: DOMAIN_VERIFICATION } },
		problems: [...AUTH_PROBLEMS, "notFound"],
		security: requires("tenant:write"),
	},
);

/** `DELETE /tenants/:tenantId/domains/:domainId`: removes a domain and deregisters it from Cloudflare. */
export const TENANT_DOMAINS_REMOVE = defineOperation(
	"tenantDomainsRemove",
	routes.tenantDomainsRemove,
	{
		summary: "Remove a domain",
		tags: ["Domains"],
		params: DOMAIN_PARAMS,
		responses: { 204: { description: "The domain was removed" } },
		problems: [...AUTH_PROBLEMS, "notFound"],
		security: requires("tenant:write"),
	},
);

/** `POST /tenants/:tenantId/mfa-policy`: whether every subject must enroll a second factor. */
export const TENANT_MFA_POLICY_SET = defineOperation(
	"tenantMfaPolicySet",
	routes.tenantMfaPolicySet,
	{
		summary: "Set the second-factor policy",
		tags: ["Sign-in policies"],
		params: TENANT_PARAMS,
		body: s.object({ policy: s.enum_(["optional", "required"] as const) }),
		responses: { 204: { description: "The policy was set" } },
		problems: [...AUTH_PROBLEMS, "validationFailed"],
		security: requires("tenant:write"),
	},
);

/** `POST /tenants/:tenantId/session-policy`: a partial update; an omitted field stays as it is. */
export const TENANT_SESSION_POLICY_SET = defineOperation(
	"tenantSessionPolicySet",
	routes.tenantSessionPolicySet,
	{
		summary: "Set the session policy",
		description:
			"Changes the session, idle and refresh-token lifetimes within the platform bounds. Requires the session_policy entitlement.",
		tags: ["Sign-in policies"],
		params: TENANT_PARAMS,
		body: s.object({
			policy: s.object({
				absoluteLifetimeMs: s.optional(s.number()),
				idleLifetimeMs: s.optional(s.number()),
				refreshTokenLifetimeMs: s.optional(s.number()),
				concurrentSessionLimit: s.optional(s.nullable(s.number())),
				sessionsAfterCredentialChange: s.optional(SESSIONS_AFTER_CREDENTIAL_CHANGE),
			}),
		}),
		responses: {
			200: {
				description: "The stored policy, and how many live sessions it shortened",
				body: s.object({ policy: STORED_SESSION_POLICY, sessionsShortened: s.integer() }),
			},
		},
		problems: [...AUTH_PROBLEMS, "validationFailed", "entitlementRequired"],
		security: requires("tenant:write"),
	},
);

/** `GET /tenants/:tenantId/session-policy`: readable on every plan, entitled or not. */
export const TENANT_SESSION_POLICY_DESCRIBE = defineOperation(
	"tenantSessionPolicyDescribe",
	routes.tenantSessionPolicyDescribe,
	{
		summary: "Describe the session policy",
		tags: ["Sign-in policies"],
		params: TENANT_PARAMS,
		responses: {
			200: { description: "The effective policy and its bounds", body: SESSION_POLICY_DESCRIPTION },
		},
		problems: [...AUTH_PROBLEMS],
		security: requires("tenant:write"),
	},
);

/** Every operation in this area, in route-map order, for the document to list. */
export const TENANTS_OPERATIONS = [
	TENANT_READ,
	TENANT_MEMBERS_LIST,
	TENANT_MEMBERS_CREATE,
	TENANT_MEMBERS_INVITE,
	TENANT_MEMBERS_UPDATE_ROLE,
	TENANT_MEMBERS_REMOVE,
	TENANT_DOMAINS_LIST,
	TENANT_DOMAINS_ATTACH,
	TENANT_DOMAINS_VERIFICATION,
	TENANT_DOMAINS_REMOVE,
	TENANT_MFA_POLICY_SET,
	TENANT_SESSION_POLICY_SET,
	TENANT_SESSION_POLICY_DESCRIBE,
] as const;
