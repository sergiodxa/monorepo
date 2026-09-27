/**
 * A fully-provisioned tenant, a sibling tenant for cross-tenant tests, and the
 * token-signing and request-building helpers every resource area's own
 * HTTP-surface test shares, the way `scim/test-harness.ts` drives the SCIM
 * surface. A resource area builds its own router around this core and its own
 * `buildXHarness` that calls {@link buildManagementTestCore}, the way
 * `subjects/test-harness.ts` and `clients/test-harness.ts` each do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { HostnameClient } from "@sdxc/hostname";
import { JWK } from "@sdxc/jwt";
import { Database } from "remix/data-table";

import { ManagementAccessToken } from "~/app/lib/management-token";
import Customer from "~/app/models/customer";
import Membership from "~/app/models/membership";
import {
	advancePlatformSigningKeys,
	currentPlatformSigningKeyPair,
} from "~/app/models/platform-signing-key";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";
import TenantObject from "~/database/tenant-do";

export const ISSUER = "https://api.example.com";

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
	await advancePlatformSigningKeys(db, { now: Date.now() });

	let customer = await Customer.create(db, { name: "Acme, Inc." });
	let tenant = await Tenant.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.auth.example.com",
	});

	let other = await Tenant.create(db, {
		customerId: customer.id,
		name: "Other, Inc.",
		slug: "other",
		issuer: "https://other.auth.example.com",
	});

	let state = createDurableObjectState();
	let tenantDO = new TenantObject(state, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: tenant.id, issuer: "https://acme.auth.example.com" });

	let tenantDb = new Database(createSQLStorageDatabaseAdapter(state.storage.sql));

	return {
		db,
		tenantId: tenant.id,
		otherTenantId: other.id,
		tenantDO,
		tenantDb,
		async signToken(overrides = {}) {
			let pair = await currentPlatformSigningKeyPair(db);
			if (!pair) throw new Error("unreachable");

			let now = Math.floor(Date.now() / 1000);
			let tenantId = overrides.tenantId ?? tenant.id;

			return new ManagementAccessToken({
				iss: ISSUER,
				sub: "mgmt_client_1",
				client_id: "mgmt_client_1",
				aud: `${ISSUER}/tenants/${tenantId}`,
				tenant_id: tenantId,
				scope: overrides.scope ?? options.defaultScope,
				iat: now,
				exp: now + 900,
			}).sign(JWK.Algorithm.ES256, [pair]);
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
	await Membership.create(db, { tenantId, subjectId, role });
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
