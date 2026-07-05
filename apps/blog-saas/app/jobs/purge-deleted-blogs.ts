/**
 * The deleted-blog purge cron job: permanently removes blogs whose retention window
 * has elapsed, wiping each tenant Durable Object's storage and its control-plane row
 * so soft-deleted blogs eventually stop incurring any cost.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import Blog from "~/app/models/blog";
import { BlogProvisioner } from "~/app/services/blog-provisioner";

/** Retention window before a soft-deleted blog is hard-purged. */
const RETENTION_DAYS = 30;

/**
 * Daily purge cron (02:00 UTC): hard-deletes blogs soft-deleted more than
 * {@link RETENTION_DAYS} ago — wiping the DO storage and the D1 row.
 *
 * @returns A promise resolving once all eligible blogs have been purged.
 */
export async function purgeDeletedBlogs(): Promise<void> {
	let db = getServiceContainer().get(Database);
	let cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
	let provisioner = getServiceContainer().get(BlogProvisioner);

	for (let blog of await Blog.findDeletedBefore(db, cutoff)) {
		await provisioner.purge(blog.id);
	}
}
