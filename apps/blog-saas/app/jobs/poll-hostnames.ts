import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import Hostname from "~/app/models/hostname";
import { BlogProvisioner } from "~/app/services/blog-provisioner";
import { HostnameService } from "~/app/services/hostname";

/**
 * Hostname polling cron (02:00 UTC): refreshes pending custom-hostname validation
 * so activation is hands-off. When a hostname goes active, flips the blog to the
 * custom domain (subdomain stops working).
 */
export async function pollHostnames(): Promise<void> {
	let db = getServiceContainer().get(Database);
	let service = getServiceContainer().get(HostnameService);
	let provisioner = getServiceContainer().get(BlogProvisioner);

	for (let hostname of await Hostname.findPending(db)) {
		try {
			let status = await service.status(hostname.id);
			await Hostname.setStatus(db, hostname.id, status.status, status.sslStatus);
			if (service.isActive(status)) {
				await provisioner.activateCustomHostname(hostname.blog_id, hostname.hostname);
			}
		} catch {
			// Transient CF API errors retry on the next poll.
		}
	}
}
