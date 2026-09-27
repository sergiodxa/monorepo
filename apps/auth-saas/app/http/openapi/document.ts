/**
 * The management API's OpenAPI 3.1 document, assembled from every area's operations and
 * the shared problem catalog. It is the API's reference: the schemas it publishes are the
 * ones the handlers parse with, and the management tests check every response against it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { managementProblems } from "@sdxc/auth/management-client";
import { createDocument } from "@sdxc/openapi";
import { oauth2 } from "@sdxc/openapi/security";

import { PUBLISHED_API_VERSIONS } from "~/app/http/lib/api-version";
import { API_KEYS_OPERATIONS } from "~/app/http/openapi/api-keys";
import { AUDIT_OPERATIONS } from "~/app/http/openapi/audit";
import { CLIENTS_OPERATIONS } from "~/app/http/openapi/clients";
import { CREDENTIALS_OPERATIONS } from "~/app/http/openapi/credentials";
import { PUBLIC_OPERATIONS } from "~/app/http/openapi/public";
import { ROLES_OPERATIONS } from "~/app/http/openapi/roles";
import { SECURITY_SCHEME } from "~/app/http/openapi/shared";
import { SUBJECTS_OPERATIONS } from "~/app/http/openapi/subjects";
import { TENANTS_OPERATIONS } from "~/app/http/openapi/tenants";
import { WEBHOOK_ENDPOINTS_OPERATIONS } from "~/app/http/openapi/webhook-endpoints";
import { MANAGEMENT_SCOPES } from "~/app/services/management-scopes";

/** What each scope lets a token do, for the OAuth flow the document advertises. */
const SCOPE_DESCRIPTIONS: Record<(typeof MANAGEMENT_SCOPES)[number], string> = {
	"subjects:read": "Read subjects, their identifiers, roles, grants and credentials",
	"subjects:write": "Create, change, block and delete subjects, and import subjects",
	"sessions:write": "Revoke a subject's sessions",
	"clients:write": "Register, change and delete clients and their secrets",
	"keys:write": "Create, rotate and revoke API keys",
	"webhooks:write": "Register and change webhook endpoints, and replay deliveries",
	"audit:read": "Read the tenant's audit events",
	"export:read": "Export the tenant's subjects",
	"tenant:write": "Change the tenant's domains and sign-in policies",
	"members:write": "Add, invite, change and remove the tenant's members",
};

/**
 * Builds the document for the API served at `issuer`. `info.version` is the
 * `X-API-Version` date it describes; each later published date gets its own document.
 *
 * @param issuer - The management API's own origin, `https://api.{PLATFORM_DOMAIN}`.
 * @returns The builder, for `openapiHandler` to build on first request and for the
 * conformance recorder.
 * @example
 * router.map(routes.openapi, openapiHandler(() => buildManagementDocument(issuer).build()));
 */
export function buildManagementDocument(issuer: string) {
	return createDocument({
		info: {
			title: "Management API",
			version: PUBLISHED_API_VERSIONS[PUBLISHED_API_VERSIONS.length - 1] ?? "2026-09-21",
		},
		servers: [{ url: issuer }],
		securitySchemes: {
			[SECURITY_SCHEME]: oauth2({
				description: `A client-credentials token from ${issuer}/oauth/token. Protected-resource metadata is at ${issuer}/.well-known/oauth-protected-resource.`,
				flows: {
					clientCredentials: { tokenUrl: `${issuer}/oauth/token`, scopes: SCOPE_DESCRIPTIONS },
				},
			}),
		},
		problems: managementProblems,
	}).add(
		...PUBLIC_OPERATIONS,
		...SUBJECTS_OPERATIONS,
		...CLIENTS_OPERATIONS,
		...API_KEYS_OPERATIONS,
		...WEBHOOK_ENDPOINTS_OPERATIONS,
		...ROLES_OPERATIONS,
		...CREDENTIALS_OPERATIONS,
		...AUDIT_OPERATIONS,
		...TENANTS_OPERATIONS,
	);
}
