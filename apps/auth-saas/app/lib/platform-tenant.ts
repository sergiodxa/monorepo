/**
 * Where every part of the management API reaches the platform tenant's own
 * Durable Object and its own OIDC issuer — the authorization server every
 * management credential, machine or human, is verified against. Overridable
 * only for tests, which construct their own platform tenant object the way
 * `@sdxc/cloudflare-mocks` builds one for any other Durable Object test,
 * rather than reaching the real `TENANT` binding a plain Vitest run has no
 * use for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import type Tenant from "~/database/tenant-do";

/** Opens a stub for the platform tenant's own Durable Object. */
let resolveStub: () => DurableObjectStub<Tenant> = () => env.TENANT.getByName(env.PLATFORM_DOMAIN);

/** The platform tenant's own OIDC issuer, distinct from the management API's own resource identifier. */
let resolveIssuer: () => string = () => `https://${env.PLATFORM_DOMAIN}`;

/** A stub for the platform tenant's own Durable Object. */
export function platformTenantStub(): DurableObjectStub<Tenant> {
	return resolveStub();
}

/** The platform tenant's own OIDC issuer, that every token it mints carries as `iss`. */
export function platformTenantIssuer(): string {
	return resolveIssuer();
}

/**
 * Points every later call to {@link platformTenantStub} and
 * {@link platformTenantIssuer} at a test's own constructed platform tenant
 * object and issuer, instead of the real `TENANT` binding. Call once, in a
 * shared test harness's own setup, before a router reaching either function
 * serves its first request.
 *
 * @param stub - Opens the test's own constructed platform tenant object.
 * @param issuer - The issuer that object was provisioned under.
 */
export function usePlatformTenantForTesting(
	stub: () => DurableObjectStub<Tenant>,
	issuer: string,
): void {
	resolveStub = stub;
	resolveIssuer = () => issuer;
}
