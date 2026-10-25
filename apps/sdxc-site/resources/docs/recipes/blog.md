---
title: Build a blog
description: Put the markdown, feed, SEO, social card and Webmention guides together into one blog on Cloudflare Workers.
section:
    title: Recipes
    order: 1.7
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a blog, and in what order to follow them"
    - "Where one list of posts feeds the feeds, the sitemap, the social cards and Webmentions"
    - "How to test that every published post reaches the sitemap and the feed"
---

By the end of this recipe you have a blog on Cloudflare Workers: posts written as markdown files
in your repository, RSS, Atom and JSON feeds, a sitemap and robots file, a social card for every
post, and Webmentions from other sites. Each step follows an existing guide, and every guide
lists the packages it installs. The test at the end adds:

```bash
npm add @sdxc/feed @sdxc/result
```

## Create the project

`sdxc create` gives you the router, the D1 database Webmentions are stored in and the queue
their fetches run on. Follow [Create the project](/docs/getting-started/build-an-app#create-the-project).

## Publish posts from markdown

Posts are what every later step reads. Follow
[A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline), including the
`listPosts` function in
[Load and parse inside the request](/docs/content-and-feeds/markdown-pipeline#load-and-parse-inside-the-request):
every later step reads its list of published posts. The SEO and card guides call the post
route `post` and the card route `postCard`; in this blog they are `posts.show` and a
`posts.card: get("/posts/:slug.png")` declared beside it.

## Publish feeds

Readers subscribe next. Follow
[Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds), whose `feedEntries`
already reads `listPosts`.

## Add SEO, a sitemap and robots.txt

Follow [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots),
reading posts from `readPost` and `listPosts` where it reads the `Post` model: a post's
`description` is its excerpt, and its `publishedAt` is the sitemap's `updatedAt`. Pass `false`
for `feeds`, `posts.card` and `webmention` in the sitemap.

## Draw social cards

The card is the `og:image` the `Seo` tags advertise, so it follows them. Follow
[Draw social card images](/docs/building-remix-apps/social-card-images), finding the card's
post in `listPosts()` by its slug.

## Accept Webmentions

Replies from other sites come last, once each post has a stable URL and markup to point at.
Follow [Join the IndieWeb](/docs/content-and-feeds/indieweb) from
[Mark up your posts](/docs/content-and-feeds/indieweb#mark-up-your-posts) through
[Send Webmentions](/docs/content-and-feeds/indieweb#send-webmentions). Its `findPostByUrl`
answers a post `listPosts()` returns whose `posts.show` URL is the target.

## Deploy

The cards need an R2 bucket and the feeds a `WEBSUB_HUB` value, so create both alongside the
database and queue. Follow [Deploy your app](/docs/getting-started/first-deploy).

## Test that every post reaches each surface

The feed and the sitemap come from different guides, so check one against the other:

```typescript {% title="app/http/controllers/blog.test.ts" %}
import { Feed } from "@sdxc/feed";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

async function read(path: string) {
	let response = await createWebRouter().fetch(
		new URL(path, "https://example.com"),
	);
	return response.text();
}

test("lists every post the feed announces in the sitemap", async () => {
	let sitemap = await read(routes.sitemap.href());
	let feed = unwrap(Feed.parse(await read(routes.feeds.rss.href())));

	expect(feed.items.length).toBeGreaterThan(0);
	for (let item of feed.items) expect(sitemap).toContain(`<loc>${item.url}</loc>`);
});
```

## Where to go next

- [Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) — typographic
  punctuation, embeds and a content check in CI for every post.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — keep posts
  and feeds cheap to serve as readers arrive.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — publish the blog in more
  than one language.
