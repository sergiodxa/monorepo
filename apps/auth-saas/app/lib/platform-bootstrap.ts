/**
 * Idempotent bootstrap for the dogfooded "platform" tenant. The platform tenant row is
 * inserted by a control-plane migration, but its Durable Object is only migrated and
 * given signing keys on boot — nothing ever calls `/api/setup` for it, so its OIDC
 * issuer stays unset and dashboard token exchange fails with "Issuer not configured".
 *
 * This module provisions the platform tenant (issuer + region) exactly once per isolate,
 * guarding the first request that targets the platform tenant so no manual out-of-band
 * setup step is required. Provisioning is itself idempotent (the Management API upserts
 * tenant metadata), so repeating it across isolates is harmless.
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
 * Memoized provisioning promise, so the platform tenant is set up once per isolate. A
 * failed attempt is not cached, so a transient failure is retried on the next request.
 */
let provisioned: Promise<void> | null = null;

/**
 * Ensures the platform tenant's Durable Object has been provisioned via `/api/setup`.
 *
 * Memoized per isolate. On failure the memo is cleared so the next request retries,
 * rather than serving a permanently un-provisioned platform tenant.
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
		// Do not cache a failed attempt: clear the memo so the next request retries.
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
