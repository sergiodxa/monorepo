/**
 * A fully-provisioned tenant, a sibling tenant for cross-tenant tests, and the
 * token-signing and request-building helpers every resource area's own
 * HTTP-surface test shares, the way `scim/test-harness.ts` drives the SCIM
 * surface. A resource area builds its own router around this core and its own
 * `buildXHarness` that calls {@link buildManagementTestCore}, the way
 * `subjects/test-harness.ts` and `clients/test-harness.ts` each do.
 *
 * Every signed token is a real, machine-credential access token minted by a
 * freshly-constructed platform tenant object, through the same
 * client-credentials grant any tenant's own clients use — {@link
 * usePlatformTenantForTesting} points the management API's own bearer
 * verification at this same object, so a test never has to reach the real
 * `TENANT` binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { HostnameClient } from "@sdxc/hostname";
import { createConformanceRecorder } from "@sdxc/openapi/testing";
import { unwrap } from "@sdxc/result";
import { Database } from "remix/data-table";
import { afterAll, expect } from "vitest";

import type { Models } from "~/app/models";

import { buildManagementDocument } from "~/app/http/openapi/document";
import { usePlatformTenantForTesting } from "~/app/lib/platform-tenant";
import { MANAGEMENT_SCOPES } from "~/app/services/management-scopes";
import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";
import TenantObject from "~/database/tenant-do";

export const ISSUER = "https://api.example.com";

/** The platform tenant's own OIDC issuer, distinct from `ISSUER`, the management API's own resource identifier. */
const PLATFORM_ISSUER = "https://platform.example.com";

/** Records every exchange a harness router serves, against the published document. */
const CONFORMANCE = createConformanceRecorder(buildManagementDocument(ISSUER));

/**
 * Checks every response a harness router answers against the OpenAPI document, so a
 * route answering a status, problem type or body the document does not describe fails
 * the test file that exercised it. Install it first on a harness router.
 */
export const conformance = CONFORMANCE.middleware;

afterAll(() => {
	expect(CONFORMANCE.violations()).toEqual([]);
});

/** A fake `RateLimiterBinding` answering the same decision on every call. */
export function fakeLimiter(success = true): RateLimiterBinding {
	return { limit: async () => ({ success }) };
}

/** The Cloudflare zone {@link fakeHostnameClient} is pointed at, for a test's own MSW handlers to answer. */
export const HOSTNAME_ZONE_ID = "zone-1";

/**
 * Builds a `HostnameClient` pointed at a test zone, so every resource area's
 * own harness satisfies `ManagementControllerOptions` even when its routes
 * never call it. The tenants resource area's own domain routes do call it,
 * and point their tests' MSW handlers at this same zone, the way
 * `app/services/domain.test.ts` already drives that client.
 */
export function fakeHostnameClient(): HostnameClient {
	return new HostnameClient({
		apiToken: "test-token",
		zoneId: HOSTNAME_ZONE_ID,
		platformDomain: "auth.example.com",
	});
}

/** What every resource area's own harness wraps its own router around. */
export interface ManagementTestCore {
	db: Database;
	/** The control plane's models, bound to `db`. */
	models: Models;
	tenantId: string;
	otherTenantId: string;
	tenantDO: TenantObject;
	/**
	 * A plain `Database` bound to `tenantDO`'s own storage, for a test that
	 * needs to set up or inspect a row no RPC method hands back on its own —
	 * the same direct access `clients.test.ts` and its siblings already drive
	 * their own tables through, pointed at the storage this harness's router
	 * actually serves from.
	 */
	tenantDb: Database;
	/** Signs a management access token the way the token endpoint mints one. */
	signToken(overrides?: Partial<{ tenantId: string; scope: string }>): Promise<string>;
	/** A request against this harness's tenant, bearing the given bearer token. */
	request(path: string, token: string, init?: RequestInit): Request;
}

export interface BuildManagementTestCoreOptions {
	/** The scope a signed token carries when a test asks for none of its own. */
	defaultScope: string;
}

/**
 * Provisions a fresh tenant, a sibling tenant under the same customer, and
 * the token-signing and request-building helpers every resource area's own
 * HTTP-surface test shares.
 *
 * @param options - The scope a signed token carries by default.
 * @returns The provisioned state and helpers a resource area's own harness
 * wraps a router around.
 */
export async function buildManagementTestCore(
	options: BuildManagementTestCoreOptions,
): Promise<ManagementTestCore> {
	let db = await createTestDatabase();
	let models = bindModels(db);

	let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
	let tenant = unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.auth.example.com",
		}),
	);

	let other = unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name: "Other, Inc.",
			slug: "other",
			issuer: "https://other.auth.example.com",
		}),
	);

	let state = createDurableObjectState();
	let tenantDO = new TenantObject(state, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: tenant.id, issuer: "https://acme.auth.example.com" });

	let tenantDb = new Database(createSQLStorageDatabaseAdapter(state.storage.sql));

	let platformState = createDurableObjectState();
	let platformTenantDO = new TenantObject(platformState, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	await platformTenantDO.provision({ tenantId: "platform", issuer: PLATFORM_ISSUER });
	await platformTenantDO.applyEntitlements({
		plan: "pro",
		features: { machine_access: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});

	usePlatformTenantForTesting(
		() => platformTenantDO as unknown as DurableObjectStub<TenantObject>,
		PLATFORM_ISSUER,
	);

	/** One agent client registered per tenant id a test asks a token for, reused across repeated `signToken` calls. */
	let agentClients = new Map<string, { clientId: string; secret: string; scopes: Set<string> }>();

	/**
	 * Registers, and binds to `tenantId`, the one agent client every token
	 * minted for it reuses — widening its own registered ceiling whenever a
	 * later call asks for a scope narrower tests never named up front, so a
	 * resource area's own finer-grained scope (`export:credentials` alongside
	 * `export:read`, say) is never refused for a reason no test itself states.
	 */
	async function agentClientFor(
		tenantId: string,
		requestedScopes: string[],
	): Promise<{ clientId: string; secret: string }> {
		let existing = agentClients.get(tenantId);

		if (existing) {
			let missing = requestedScopes.filter((scope) => !existing.scopes.has(scope));
			if (missing.length > 0) {
				for (let scope of missing) existing.scopes.add(scope);
				await platformTenantDO.updateClient({
					clientId: existing.clientId,
					name: "test agent client",
					kind: "confidential",
					redirectUris: [],
					postLogoutRedirectUris: [],
					grantTypes: ["client_credentials"],
					responseTypes: [],
					scopes: [...existing.scopes],
					tokenEndpointAuthMethod: "client_secret_basic",
					requireConsent: false,
				});
			}
			return existing;
		}

		let scopes = new Set([...MANAGEMENT_SCOPES, ...requestedScopes]);

		let registered = await platformTenantDO.registerClient({
			name: "test agent client",
			kind: "confidential",
			redirectUris: [],
			postLogoutRedirectUris: [],
			grantTypes: ["client_credentials"],
			responseTypes: [],
			scopes: [...scopes],
			tokenEndpointAuthMethod: "client_secret_basic",
			requireConsent: false,
		});
		if (!registered.ok || registered.secret === null) {
			throw new Error("unreachable: test agent client registration failed");
		}

		unwrap(
			await models.agentClientBindings.create({
				client_id: registered.client.id,
				tenant_id: tenantId,
			}),
		);

		let created = { clientId: registered.client.id, secret: registered.secret, scopes };
		agentClients.set(tenantId, created);
		return created;
	}

	return {
		db,
		models,
		tenantId: tenant.id,
		otherTenantId: other.id,
		tenantDO,
		tenantDb,
		async signToken(overrides = {}) {
			let tenantId = overrides.tenantId ?? tenant.id;
			let scope = overrides.scope ?? options.defaultScope;
			let { clientId, secret } = await agentClientFor(tenantId, scope.split(" ").filter(Boolean));

			let outcome = await platformTenantDO.issueClientCredentialsToken({
				clientId,
				clientSecret: secret,
				scope,
				resource: null,
				authScheme: "basic",
				now: Date.now(),
			});
			if (outcome.kind !== "tokens") {
				throw new Error("unreachable: test agent client token issuance failed");
			}

			return outcome.accessToken;
		},
		request(path, token, init = {}) {
			let { headers: initHeaders, ...rest } = init;
			let headers = new Headers(initHeaders);
			headers.set("Authorization", `Bearer ${token}`);
			if (init.body && !headers.has("Content-Type"))
				headers.set("Content-Type", "application/json");

			return new Request(`${ISSUER}${path}`, { ...rest, headers });
		},
	};
}

/** Grants a tenant membership role, for a dashboard-session test. */
export async function grantMembership(
	db: Database,
	tenantId: string,
	subjectId: string,
	role: "owner" | "admin" | "member",
): Promise<void> {
	unwrap(
		await bindModels(db).memberships.create({ tenant_id: tenantId, subject_id: subjectId, role }),
	);
}

/**
 * Enforces a feature as entitled on a provisioned tenant object, for a test
 * whose success path costs an add-on the tenant's own plan must already
 * include.
 */
export async function grantEntitlement(tenantDO: TenantObject, feature: string): Promise<void> {
	await tenantDO.applyEntitlements({
		plan: "pro",
		features: { [feature]: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});
}
