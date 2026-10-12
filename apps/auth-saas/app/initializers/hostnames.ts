/**
 * Opens the platform zone's Cloudflare custom-hostname client, memoized so every unit
 * of work an isolate serves shares one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";

/** The isolate's client, built by whichever unit of work reaches it first. */
let hostnames: HostnameClient | undefined;

/**
 * Builds the custom-hostname client for the platform zone. Tags each hostname's
 * metadata with `tenant_id`, `HostnameClient`'s own default, matching what
 * `HostMetadataSchema` reads back from `request.cf.hostMetadata`.
 *
 * @returns A client for the zone's custom hostnames.
 * @example let created = await createHostnameClient().create(hostname, tenant.id, tenant.region);
 */
export function createHostnameClient(): HostnameClient {
	return (hostnames ??= new HostnameClient({
		apiToken: env.CF_API_TOKEN,
		zoneId: env.CF_ZONE_ID,
		platformDomain: env.PLATFORM_DOMAIN,
	}));
}
