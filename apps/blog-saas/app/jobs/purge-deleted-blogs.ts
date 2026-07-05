import { platformDb } from "~/app/lib/db";
import Blog from "~/app/models/blog";
import { BlogProvisioner } from "~/app/services/blog-provisioner";

/** Retention window before a soft-deleted blog is hard-purged. */
const RETENTION_DAYS = 30;

/**
 * Daily purge cron (02:00 UTC): hard-deletes blogs soft-deleted more than
 * {@link RETENTION_DAYS} ago — wiping the DO storage and the D1 row.
 */
export async function purgeDeletedBlogs(): Promise<void> {
	let db = platformDb();
	let cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
	let provisioner = new BlogProvisioner(db);

	for (let blog of await Blog.findDeletedBefore(db, cutoff)) {
		await provisioner.purge(blog.id);
	}
}
