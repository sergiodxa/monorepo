/**
 * Idempotent bootstrap for the dogfooded "platform" tenant: this module
 * provisions its Durable Object's OIDC issuer via `/api/setup` ahead of the
 * first request, since boot-time migration only creates the tenant and its
 * signing keys. Provisioning is itself idempotent, so repeating it across
 * isolates is harmless.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TenantApiService } from "~/app/services/tenant-api";

/** Durable Object name of the dogfooded platform tenant. */
export const PLATFORM_TENANT = "platform";

/**
 * Region of the platform tenant. Matches the value seeded for the platform tenant row
 * in the control-plane migration, so the DO's location hint and stored region agree.
 */
export const PLATFORM_TENANT_REGION = "wnam";

/**
 * Memoized provisioning promise: setup runs once per isolate, and a failed
 * attempt clears the memo so the next request retries.
 */
let provisioned: Promise<void> | null = null;

/**
 * Ensures the platform tenant's Durable Object has been provisioned via
 * `/api/setup`, memoized per isolate; a failed attempt clears the memo so the
 * next request retries.
 *
 * @param setup - Provisioning callback (defaults to calling the platform tenant's
 * Management API). Injectable so tests can assert the guard without a Durable Object.
 * @param platformDomain - The platform domain used as the OIDC issuer (hostname only).
 * @returns A promise that resolves once the platform tenant is provisioned.
 * @example
 * await ensurePlatformProvisioned(undefined, env.PLATFORM_DOMAIN);
 */
export function ensurePlatformProvisioned(
	setup: ((issuer: string) => Promise<void>) | undefined,
	platformDomain: string,
): Promise<void> {
	let run =
		setup ??
		((issuer: string) =>
			new TenantApiService(PLATFORM_TENANT).setup({
				issuer,
				region: PLATFORM_TENANT_REGION,
			}));

	return (provisioned ??= run(platformDomain).catch((error) => {
		provisioned = null;
		throw error;
	}));
}

/**
 * Clears the memoized platform-provisioning promise. Test-only, so each test exercises
 * the guard from a clean state.
 *
 * @example
 * beforeEach(() => resetPlatformBootstrap());
 */
export function resetPlatformBootstrap(): void {
	provisioned = null;
}
