---
title: Send a weekly digest
description: Email your team every Monday with the posts published that week, summarized from their markdown by a scheduled job.
section:
    title: Recipes
    order: 1.7
order: 12
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a weekly digest email, and in what order to follow them"
    - "How a scheduled job turns the week's markdown posts into one email"
    - "When the digest skips a week"
---

By the end of this recipe your team's inbox gets an email every Monday morning listing the posts
published that week, each with its title, link and a summary taken from its markdown. A cron
trigger starts the job, and a failed send is retried like any other job.

```bash
npm add @sdxc/jobs @sdxc/result
```

## Publish posts from markdown

The digest reads the same posts your site renders. Follow
[A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline), including
[HTML and plain text for everything else](/docs/content-and-feeds/markdown-pipeline#html-and-plain-text-for-everything-else),
whose `summarize` gives each post the plain-text summary an email shows and whose `listPosts`
names the published posts newest first.

## Send email from jobs

Follow [Send email](/docs/data-and-background-work/send-email) through
[Publish a mailer to requests and jobs](/docs/data-and-background-work/send-email#publish-a-mailer-to-requests-and-jobs),
declaring `digests.weekly` with props
`posts: s.array(s.object({ title: s.string(), url: s.string(), summary: s.string() }))` and a
template that lists each post with `Email.Link` and `Email.Text`.

## Schedule the digest

Follow [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) for the queue,
the dispatcher and the Worker's `scheduled` handler, then write the job with
`sdxc make job weekly-digest --cron "0 8 * * 1"`. The handler sends one digest of the last seven
days' posts and skips a week with nothing new:

```typescript {% title="app/jobs/weekly-digest.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import emails from "~/app/emails";
import jobs from "~/app/jobs";
import { listPosts } from "~/app/services/content/list-posts";
import { readPost } from "~/app/services/content/posts";
import { summarize } from "~/app/services/content/render";
import { DIGEST_TO, SITE_URL } from "~/config/constants";
import routes from "~/routes/web";

const WEEK_MS = 7 * 86_400_000;

export default createJobHandler(jobs.weeklyDigest, async (ctx) => {
	let since = Date.now() - WEEK_MS;
	let recent = (await listPosts()).filter(
		(post) => post.publishedAt.getTime() >= since,
	);
	let posts = [];

	for (let { slug, title } of recent) {
		let post = await readPost(slug);
		if (post === null || isFailure(post)) continue;

		let url = new URL(routes.posts.show.href({ slug }), SITE_URL);
		posts.push({ title, url: url.href, summary: summarize(post.data.document) });
	}

	ctx.log.set({ digest: { posts: posts.length } });
	if (posts.length === 0) return;

	let sent = await ctx.email.send(emails.digests.weekly, {
		to: DIGEST_TO,
		locale: "en",
		props: { posts },
	});
	if (isFailure(sent)) return ctx.retry({ delay: "15 minutes", cause: sent.error });
});
```

`DIGEST_TO` is your team's address. The digest is one message, so the job sends it itself and a
failed send retries with the job.

## Test it

Test each stage as its guide does:
[Run jobs in a test](/docs/data-and-background-work/jobs-and-cron#run-jobs-in-a-test) drains the
job once you pin the clock to a Monday after one of your posts, and
[Test with the memory transport](/docs/data-and-background-work/send-email#test-with-the-memory-transport)
checks the digest that was sent.

## Where to go next

- [Run a newsletter list](/docs/data-and-background-work/newsletter) — send the digest to
  readers who subscribed, from a platform built for lists.
- [Validate a schedule someone typed](/docs/data-and-background-work/jobs-and-cron#validate-a-schedule-someone-typed)
  — let each person pick when their digest arrives.
- [Preview an email](/docs/data-and-background-work/send-email#preview-an-email) — check the
  digest's layout before the first Monday.
