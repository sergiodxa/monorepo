/**
 * The management API's own client-credentials grant: authenticates a management
 * client, binds the token to the resource(s) requested — refusing anything but the
 * client's own tenant under RFC 8707's `invalid_target` — narrows the requested
 * scope to the client's registered ceiling, and signs with the platform's own key
 * under the platform's own issuer. Modeled on `database/tokens.ts`'s
 * `issueClientCredentialsToken`, but against `management_clients` and the
 * platform's identity rather than a tenant's own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { JWK } from "@sdxc/jwt";
import * as s from "remix/data-schema";

import { MANAGEMENT_ACCESS_TOKEN_TTL_MS, ManagementAccessToken } from "~/app/lib/management-token";
import { verifyManagementClientSecret } from "~/app/models/management-client";
import { currentPlatformSigningKeyPair } from "~/app/models/platform-signing-key";

export interface IssueManagementClientCredentialsTokenInput {
	clientId: string;
	clientSecret: string;
	/** The `scope` field as presented, or `null` to be granted the client's whole ceiling. */
	scope: string | null;
	/** Every `resource` field presented, per RFC 8707; an empty list defaults to the client's own tenant. */
	resources: string[];
	now: number;
	/** The management API's own issuer, `https://api.{PLATFORM_DOMAIN}`, stamped onto the token as `iss`. */
	issuer: string;
}

export type ManagementTokenOutcome =
	| {
			kind: "tokens";
			accessToken: string;
			tokenType: "Bearer";
			expiresIn: number;
			scope: string;
	  }
	| { kind: "error"; status: 400 | 401 | 500; error: string; description: string };

let IssueManagementClientCredentialsTokenSchema = s.object({
	clientId: s.string(),
	clientSecret: s.string(),
	scope: s.nullable(s.string()),
	resources: s.array(s.string()),
	now: s.number(),
	issuer: s.string(),
});

/** The one resource a client's own tenant may be addressed by, and everything under it. */
function isWithinTenantResource(resource: string, expected: string): boolean {
	return resource === expected || resource.startsWith(`${expected}/`);
}

/**
 * Exchanges a management client's id and secret for a token about the client
 * itself, scoped to the tenant it was registered under.
 *
 * @param db - The control-plane database.
 * @param input - The client's credentials, the scope and resources requested, and
 * the clock and issuer to mint against.
 * @returns The minted access token, or the error this grant was refused for.
 */
export async function issueManagementClientCredentialsToken(
	db: Database,
	input: IssueManagementClientCredentialsTokenInput,
): Promise<ManagementTokenOutcome> {
	let parsed = s.parse(IssueManagementClientCredentialsTokenSchema, input);

	let verified = await verifyManagementClientSecret(db, {
		clientId: parsed.clientId,
		secret: parsed.clientSecret,
	});
	if (!verified.ok) {
		return {
			kind: "error",
			status: 401,
			error: "invalid_client",
			description: "The client id or secret did not verify.",
		};
	}
	let client = verified.client;

	let expectedResource = `${parsed.issuer}/tenants/${encodeURIComponent(client.tenantId)}`;
	let resources = parsed.resources.length > 0 ? parsed.resources : [expectedResource];

	for (let resource of resources) {
		if (!isWithinTenantResource(resource, expectedResource)) {
			return {
				kind: "error",
				status: 400,
				error: "invalid_target",
				description: "The requested resource does not name this client's own tenant.",
			};
		}
	}

	let ceiling = client.scopes;
	let grantedScopes = parsed.scope ? parsed.scope.split(/\s+/).filter(Boolean) : ceiling;
	if (grantedScopes.some((scope) => !ceiling.includes(scope))) {
		return {
			kind: "error",
			status: 400,
			error: "invalid_scope",
			description: "One or more requested scopes are not allowed for this client.",
		};
	}

	let keyPair = await currentPlatformSigningKeyPair(db);
	if (!keyPair) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "No signing key is available for the platform.",
		};
	}

	let issuedAt = Math.floor(parsed.now / 1000);
	let expiresIn = Math.floor(MANAGEMENT_ACCESS_TOKEN_TTL_MS / 1000);

	let accessToken = await new ManagementAccessToken({
		iss: parsed.issuer,
		sub: client.id,
		client_id: client.id,
		tenant_id: client.tenantId,
		aud: resources.length === 1 ? resources[0] : resources,
		scope: grantedScopes.join(" "),
		iat: issuedAt,
		exp: issuedAt + expiresIn,
	}).sign(JWK.Algorithm.ES256, [keyPair]);

	return {
		kind: "tokens",
		accessToken,
		tokenType: "Bearer",
		expiresIn,
		scope: grantedScopes.join(" "),
	};
}
