/**
 * The daily sweep ADR-005 calls for: walks every domain still pending verification or
 * certificate issuance and refreshes its status against Cloudflare, promoting one that
 * has gone active and failing one that has sat pending past its seven-day window.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";

import { createDatabase } from "~/app/lib/database";
import Domain from "~/app/models/domain";
import { refreshDomainStatus } from "~/app/services/domain";

/**
 * Refreshes every pending domain's verification/certificate status.
 *
 * @returns A promise that resolves once every pending domain has been refreshed.
 * @example
 * export default { scheduled: () => refreshPendingDomains() };
 */
export async function refreshPendingDomains(): Promise<void> {
	let db = createDatabase();
	let hostnameClient = new HostnameClient({
		apiToken: env.CF_API_TOKEN,
		zoneId: env.CF_ZONE_ID,
		platformDomain: env.PLATFORM_DOMAIN,
	});

	for (let domain of await Domain.listPending(db)) {
		await refreshDomainStatus(db, hostnameClient, domain);
	}
}
