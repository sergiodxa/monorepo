import { platformDb } from "~/app/lib/db";
import Hostname from "~/app/models/hostname";
import { BlogProvisioner } from "~/app/services/blog-provisioner";
import { HostnameService } from "~/app/services/hostname";

/**
 * Hostname polling cron (02:00 UTC): refreshes pending custom-hostname validation
 * so activation is hands-off. When a hostname goes active, flips the blog to the
 * custom domain (subdomain stops working).
 */
export async function pollHostnames(): Promise<void> {
	let db = platformDb();
	let service = new HostnameService();
	let provisioner = new BlogProvisioner(db);

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
