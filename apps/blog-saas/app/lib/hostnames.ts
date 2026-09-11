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
 * Builds the custom-hostname client for the platform zone, tagging each hostname's
 * metadata with `blog_id` so the worker can route a request straight from it.
 *
 * @returns A client for the zone's custom hostnames.
 * @example let created = await createHostnameClient().create(hostname, blog.id, blog.region);
 */
export function createHostnameClient(): HostnameClient {
	return (hostnames ??= new HostnameClient({
		apiToken: env.CF_API_TOKEN,
		zoneId: env.CF_ZONE_ID,
		platformDomain: env.PLATFORM_DOMAIN,
		metadataKey: "blog_id",
	}));
}
