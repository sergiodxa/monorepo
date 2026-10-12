/**
 * Writes the weekly releases post every Friday: reads the week's GitHub releases, and when
 * they shipped a package, publishes the week's post and sends it out like any post the CMS
 * creates, through Webmentions, ActivityPub and the WebSub hub.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { dispatcher } from "~/app/initializers/dispatcher";
import jobs from "~/app/jobs";
import { weeklyReleases } from "~/app/services/releases/weekly";
import { pingHub } from "~/app/services/websub";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/**
 * The run covers the week closing at the latest Friday 17:00 UTC, so a retry hours later
 * still writes the same week. A GitHub failure retries the whole run; a week with no package
 * writes nothing; a week that already has its post keeps it as the author left it. The post
 * is attributed to the earliest admin, the blog's author.
 */
export default createJobHandler(jobs.releases.weekly, async (ctx) => {
	let token = env.GITHUB_TOKEN;
	if (!token) return ctx.exit("GITHUB_TOKEN is not set");

	let summary = await weeklyReleases(new Date(), token);
	if (isFailure(summary)) return ctx.retry({ delay: "15 minutes", cause: summary.error });
	if (summary.data === null) return void ctx.log.set({ releases: { posted: false } });

	let author = await ctx.models.users
		.query()
		.where({ role: "admin" })
		.orderBy("created_at", "asc")
		.first();
	if (author === null) return ctx.exit("No admin to attribute the releases post to");

	let published = await ctx.models.releases.publishWeek(summary.data, author.id);
	if (isFailure(published)) return ctx.retry({ cause: published.error });

	let postId = published.data;
	ctx.log.set({ releases: { posted: postId !== null, slug: summary.data.slug } });
	if (postId === null) return;

	await dispatcher.enqueue(jobs.webmentions.send, { postId });
	await dispatcher.enqueue(jobs.activityPub.publish, {
		postId,
		changedAt: new Date().toISOString(),
	});

	let feeds = [routes.rss.feed, routes.atom.feed, routes.jsonFeed.feed];
	await pingHub(
		feeds.map((feed) => new URL(feed.href(), PROFILE.canonical.origin).toString()),
		ctx.log,
	);
});
