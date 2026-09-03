/**
 * The deleted-blog purge job: permanently removes blogs whose retention window has
 * elapsed, wiping each tenant Durable Object's storage and its control-plane row so
 * soft-deleted blogs eventually stop incurring any cost.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@pkg/jobs-next";

import jobs from "~/app/jobs";
import Blog from "~/app/models/blog";

const RETENTION_DAYS = 30;

/**
 * Hard-deletes blogs soft-deleted more than {@link RETENTION_DAYS} ago — wiping the DO
 * storage and the D1 row. A run that gives up part-way leaves the blogs it has yet to
 * reach for the next day's purge, which selects them again.
 */
export default createJobHandler(jobs.purgeDeletedBlogs, async (ctx) => {
	let cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
	let expired = await Blog.findDeletedBefore(ctx.database, cutoff);

	for (let blog of expired) {
		if (ctx.signal.aborted) ctx.ack("The next purge removes the blogs left.");
		await ctx.provisioner.purge(blog.id);
	}

	ctx.logger.info("blogs.purged", { count: expired.length, cutoff });
});
