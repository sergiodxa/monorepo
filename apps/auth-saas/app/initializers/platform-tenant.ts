/**
 * Where every part of the management API reaches the platform tenant's own Durable
 * Object and its own OIDC issuer — the authorization server every management
 * credential, machine or human, is verified against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import type Tenant from "~/app/models/tenant/object";

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
 * Points every later call to {@link platformTenantStub} and {@link
 * platformTenantIssuer} at a test's own constructed platform tenant object and
 * issuer, instead of the real `TENANT` binding.
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
