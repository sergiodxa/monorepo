/**
 * The hostname-polling cron job: refreshes the validation/SSL status of pending
 * custom hostnames from Cloudflare and activates the custom domain once a hostname
 * goes live, so custom-domain onboarding is hands-off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { HostnameClient } from "@pkg/hostname";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import Hostname from "~/app/models/hostname";
import { BlogProvisioner } from "~/app/services/blog-provisioner";

/**
 * Hostname polling cron (02:00 UTC): refreshes pending custom-hostname validation and
 * flips a blog to its custom domain once the hostname and SSL both report active.
 * Per-hostname errors are swallowed so a transient Cloudflare failure retries next poll.
 *
 * @returns A promise resolving once all pending hostnames have been polled.
 */
export async function pollHostnames(): Promise<void> {
	let db = getServiceContainer().get(Database);
	let client = getServiceContainer().get(HostnameClient);
	let provisioner = getServiceContainer().get(BlogProvisioner);

	for (let hostname of await Hostname.findIncomplete(db)) {
		try {
			let status = await client.status(hostname.id);
			await Hostname.setStatus(db, hostname.id, status.status, status.sslStatus);
			if (HostnameClient.isActive(status)) {
				await provisioner.activateCustomHostname(hostname.blog_id, hostname.hostname);
			}
		} catch {}
	}
}
