---
title: "Join the IndieWeb: Webmention and Micropub"
description: Mark posts up with microformats, receive and send Webmentions from background jobs, and accept posts over Micropub.
section:
    title: Content & feeds
    order: 7
order: 3
lastUpdated: 2026-10-08
---

The IndieWeb is a set of small protocols that let independent sites talk to each other.
Webmention tells a page it was linked to, so a reply written on someone else's site shows up
under your post. Micropub lets a client you did not write publish to your site. Both read the
same vocabulary, microformats2: class names on ordinary HTML that say which part of a page is
the entry, its author and its date.

This guide adds all three to a Remix v3 app. It combines
[`@sdxc/microformats`](/api/microformats), [`@sdxc/webmention`](/api/webmention) and
[`@sdxc/micropub`](/api/micropub), with [`@sdxc/jobs`](/api/jobs) running every outbound
fetch off the request and [`@sdxc/backoff`](/api/backoff) spacing out the retries.

Mastodon and the rest of the fediverse reach your posts through a different protocol,
ActivityPub, which [Federate a site with ActivityPub](/docs/content-and-feeds/activitypub) adds
beside these. The two meet in one place: a fediverse reply, like or boost reads into the same
kind, author and content a verified Webmention carries, so both can share the table and the
moderation queue this guide builds.

```bash
npm add remix @sdxc/microformats @sdxc/webmention @sdxc/micropub @sdxc/jobs \
	@sdxc/backoff @sdxc/result
```

The packages hold the protocols. Storing posts and mentions, moderation, and verifying access
tokens stay yours, so the examples call a few functions from your own `~/app/models/*` modules.

## Mark up your posts

A receiver reads your page's microformats to decide what your post is, and a Webmention you
send is only as good as the markup it points at. `mf` from `@sdxc/microformats/ui` is a mixin
that adds the class names, typed so a misspelled property is a compile error:

```tsx {% title="app/components/post-entry.tsx" %}
import type { Handle, RemixNode } from "remix/component";

import { MicroTime, mf } from "@sdxc/microformats/ui";

interface PostEntryProps {
	title: string;
	url: string;
	publishedAt: Date;
	author: { name: string; url: string };
	children: RemixNode;
}

export function PostEntry(handle: Handle<PostEntryProps>) {
	return () => {
		let { author, children, publishedAt, title, url } = handle.props;
		return (
			<article mix={[mf("h-entry")]}>
				<h1 mix={[mf("p-name")]}>{title}</h1>
				<a href={author.url} mix={[mf("p-author", "h-card")]}>
					{author.name}
				</a>
				<a href={url} mix={[mf("u-url", "u-uid")]}>
					<MicroTime property="dt-published" value={publishedAt}>
						{publishedAt.toDateString()}
					</MicroTime>
				</a>
				<div mix={[mf("e-content")]}>{children}</div>
			</article>
		);
	};
}
```

`MicroTime` renders a `<time>` whose `datetime` is the ISO instant, so a parser reads an exact
time while the reader sees your formatted label. `mf` sits in `mix` beside your `css()` mixins
and appends its classes after theirs.

The parser that reads other people's pages reads yours too, which makes a template test short:
render the page, then `parse(html, url)` and `readEntry(findItem(document, "h-entry"))` should
hand back the title and author you rendered.

## Receive Webmentions

The guide maps three kinds of route: your posts, the Webmention endpoint, and a Micropub
endpoint that answers both `GET` and `POST`:

```typescript {% title="routes/web.ts" %}
import { get, post, route } from "remix/routes";

export default route({
	posts: { show: get("/posts/:slug") },
	webmention: post("/webmention"),
	micropub: { query: get("/micropub"), write: post("/micropub") },
});
```

Advertise the endpoint first, in both places a sender looks. `advertise` from
`@sdxc/webmention/discover` writes the `Link` header value for a post's response:

```typescript {% title="app/http/webmention-headers.ts" %}
import { advertise } from "@sdxc/webmention/discover";

import routes from "~/routes/web";

export function webmentionHeaders(base: URL) {
	return { link: advertise(new URL(routes.webmention.href(), base)).header };
}
```

Pass it when you render a post, as in
`ctx.render(<PostPage post={post} />, { headers: webmentionHeaders(ctx.url) })`. The header
reaches a sender that only reads headers; a `<link>` reaches one that parses the page. Render
the element in your document layout's `<head>`, where every page carries it, beside the one a
Micropub client looks for:

```tsx {% title="app/components/indieweb-links.tsx" %}
import routes from "~/routes/web";

export function IndieWebLinks() {
	return () => (
		<>
			<link rel="webmention" href={routes.webmention.href()} />
			<link rel="micropub" href={routes.micropub.query.href()} />
		</>
	);
}
```

The endpoint itself does as little as possible. `parseRequest` checks the request in the order
the specification lists (form-encoded, both URLs present and public, source and target
different, a target you accept) and fetches nothing. Verification means fetching `source`, a
URL an anonymous caller chose, so it goes on the queue:

```typescript {% title="app/http/controllers/webmention.ts" %}
import { isFailure } from "@sdxc/result";
import { accepted, parseRequest, rejected } from "@sdxc/webmention/receiver";
import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import { findPostByUrl } from "~/app/models/posts";
import routes from "~/routes/web";

export default createAction(routes.webmention, async (ctx) => {
	let parsed = await parseRequest(ctx.request, {
		formData: ctx.formData,
		accepts: async (target) => (await findPostByUrl(ctx.db, target)) !== null,
	});
	if (isFailure(parsed)) return rejected(parsed.error);

	let { source, target } = parsed.data;
	await ctx.jobs.enqueue(jobs.webmentions.verify, {
		source: source.href,
		target: target.href,
	});
	return accepted();
});
```

The form-data middleware already read the body, so `ctx.formData` is passed in rather than read
again. `rejected` answers `400` with the reason as text, and `accepted` answers `202`, which is
what tells the sender its mention is being processed rather than published.

`ctx.jobs` is published by `jobEnqueuer(queue)` from `@sdxc/jobs/router`, given the same queue
your dispatcher delivers from, so the request writes the message and none of the job's code
loads in the request path (see
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron)). Declare the jobs
this guide uses in one map:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	webmentions: {
		verify: job({ input: s.object({ source: s.string(), target: s.string() }) }),
		send: job({ input: s.object({ postId: s.string() }) }),
		deliver: job({
			input: s.object({
				postId: s.string(),
				target: s.string(),
				removed: s.boolean(),
			}),
		}),
	},
});
```

## Verify in the background

`verify` fetches the source under bounds (public hosts only, five redirects, one megabyte and
five seconds by default), checks that it links to the target, and summarizes it from its
microformats. Key what you store on the pair, since a repeated pair is an update:

```typescript {% title="app/jobs/webmentions/verify.ts" %}
import { createBackoff } from "@sdxc/backoff";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { verify } from "@sdxc/webmention/receiver";

import jobs from "~/app/jobs";
import { deleteMention, saveMention } from "~/app/models/mentions";
import { USER_AGENT } from "~/app/services/webmention";

const retryBackoff = createBackoff({ base: "2 minutes", max: "1 hour", jitter: 0.2 });

export default createJobHandler(jobs.webmentions.verify, async (ctx) => {
	let pair = {
		source: new URL(ctx.input.source),
		target: new URL(ctx.input.target),
	};

	let outcome = await verify(pair, { userAgent: USER_AGENT });
	if (isFailure(outcome)) {
		if (!outcome.error.retryable) return ctx.ack(outcome.error.message);
		let delay = retryBackoff.delay(ctx.attempts);
		return ctx.retry({ delay, cause: outcome.error });
	}

	if (outcome.data.status !== "linked") return await deleteMention(ctx.db, pair);

	await saveMention(ctx.db, pair, outcome.data.mention, { status: "pending" });
	ctx.log.set({ webmention: { kind: outcome.data.mention.kind } });
});
```

A timeout, a broken connection, a `5xx` or a `429` is `retryable`; a refused host, a redirect
chain past the limit or an oversized body is not, and retrying would get the same answer. A
retry waits two minutes after the first failure and doubles from there up to an hour, so a
source that was briefly down is read again quickly and one that stays down is left alone;
the jitter spreads out retries that failed together. `gone` (the source answered `410`) and `unlinked` both mean
the mention no longer stands, so both delete it. `USER_AGENT` is a string naming your site, such
as `Example Webmention (+https://example.com)`, so a publisher can see who is fetching.

A `linked` mention carries its `kind` (`reply`, `like`, `repost`, `bookmark` or `mention`), its
author and its content. `content.html` is already sanitized with the source as its base, so an
approved reply renders as it stands (in `remix/component`, through `unsafeHTML`); mark each one up as
an `mf("h-cite")` so the replies under your post are themselves readable microformats.

Store mentions as pending and show them once you approve them; the endpoint is anonymous, and
moderation is the one policy the protocol leaves entirely to you. Responses that arrive over
ActivityPub can go through `saveMention` too, since their summary carries the same fields.

## Send Webmentions

When a post is created, updated or deleted, enqueue `jobs.webmentions.send` with its id. The
send job works out which pages to notify: `outboundLinks` lists the links in the post's HTML
(other sites only, each once), and `plan` adds every page you notified before that the post no
longer links to, since the specification asks you to notify a removed link too. It already
runs inside a job, so it fans out through the dispatcher itself rather than `ctx.jobs`.

```typescript {% title="app/jobs/webmentions/send.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";
import { outboundLinks, plan } from "@sdxc/webmention/sender";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { sentTargets } from "~/app/models/mentions";
import { findPost } from "~/app/models/posts";

export default createJobHandler(jobs.webmentions.send, async (ctx) => {
	let post = await findPost(ctx.db, ctx.input.postId);
	if (!post) return ctx.ack("The post no longer exists");

	let source = new URL(post.url);
	let parsed = Markdown.parse(post.content);
	let html = post.deleted || isFailure(parsed) ? "" : toHTML(parsed.data.document);
	let current = outboundLinks(html, source);
	let linked = new Set(current.map((url) => url.href));

	let { targets } = plan(current, await sentTargets(ctx.db, post.id));
	await dispatcher.enqueueMany(
		jobs.webmentions.deliver,
		targets.map((url) => ({
			postId: post.id,
			target: url.href,
			removed: !linked.has(url.href),
		})),
	);
});
```

A deleted post links nowhere, so every past target is notified. Serve `410 Gone` from its URL
before the job runs, and each receiver's own verification sees the deletion and removes the
mention. One delivery per target means a slow endpoint delays nobody else:

```typescript {% title="app/jobs/webmentions/deliver.ts" %}
import { createBackoff } from "@sdxc/backoff";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { WebmentionFetchError } from "@sdxc/webmention";
import { send } from "@sdxc/webmention/sender";

import jobs from "~/app/jobs";
import { forgetTarget, recordTarget } from "~/app/models/mentions";
import { findPost } from "~/app/models/posts";
import { USER_AGENT } from "~/app/services/webmention";

const retryBackoff = createBackoff({
	base: "5 minutes",
	max: "6 hours",
	jitter: 0.2,
});

export default createJobHandler(jobs.webmentions.deliver, async (ctx) => {
	let { postId, removed, target } = ctx.input;
	let post = await findPost(ctx.db, postId);
	if (!post) return ctx.ack("The post no longer exists");

	let pair = { source: new URL(post.url), target: new URL(target) };
	let result = await send(pair, { userAgent: USER_AGENT });

	if (isFailure(result)) {
		let error = result.error;
		let transient =
			error instanceof WebmentionFetchError
				? error.retryable
				: error.status >= 500 || error.status === 429;
		let delay = retryBackoff.delay(ctx.attempts);
		if (transient) return ctx.retry({ delay, cause: error });
		return ctx.ack(error.message);
	}

	if (removed) return await forgetTarget(ctx.db, postId, target);
	await recordTarget(ctx.db, postId, target, result.data.status);
});
```

`send` discovers the target's endpoint (the `Link` header first, then the first `<link>` or
`<a>` in the page) and POSTs the pair. It answers `{ status: "no-endpoint" }` for a page that
takes no mentions, which is an ordinary outcome, not a failure. A failure is either a
`WebmentionFetchError`, which says itself whether it is `retryable`, or a
`WebmentionSendError` carrying the status the endpoint answered. A receiver is someone else's
server, so delivery backs off longer than verification: five minutes, doubling to six hours.
[Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) covers the
schedule's options.

## Accept posts over Micropub

A Micropub client finds your endpoint through the `rel="micropub"` link `IndieWebLinks`
renders, and signs in through IndieAuth, which ends with an access token you verify. The
`micropub` pair in the route table gives the endpoint both methods.

`parseOperation` decodes a POST in any of the three encodings clients use (form, multipart and
JSON) into one of four typed operations, and returns the token from wherever it was sent. Check
the token before you act on anything in the body:

```typescript {% title="app/http/controllers/micropub/write.ts" %}
import {
	created,
	deleted,
	error,
	parseOperation,
	requiredScopes,
	updated,
} from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { createPost, setDeleted, updatePost } from "~/app/models/posts";
import { verifyToken } from "~/app/services/indieauth";
import routes from "~/routes/web";

export default createAction(routes.micropub.write, async (ctx) => {
	let parsed = await parseOperation(ctx.request, { formData: ctx.formData });
	if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

	let { body: operation, accessToken } = parsed.data;
	let scopes = accessToken === null ? null : await verifyToken(accessToken);
	if (scopes === null) return error("unauthorized");

	let needed = requiredScopes(operation);
	if (!needed.some((scope) => scopes.has(scope))) {
		return error("insufficient_scope", undefined, { scope: needed });
	}

	switch (operation.action) {
		case "create":
			return created(await createPost(ctx.db, operation));
		case "update":
			await updatePost(ctx.db, operation);
			return updated();
		case "delete":
		case "undelete":
			await setDeleted(ctx.db, operation.url, operation.action === "delete");
			return deleted();
	}
});
```

`verifyToken` is yours: it asks your token endpoint about the token and returns the scopes it
grants, or `null`. `requiredScopes` names the scopes any one of which authorizes the operation,
so a draft needs `draft` or `create`. Every response comes from the package: `created` is a
`201` with `Location`, and `error` writes the status, the JSON body and the
`WWW-Authenticate` header the specification asks for.

A create arrives already reshaped: form fields become microformats2 properties, and `mp-slug`,
`mp-syndicate-to` and `post-status` are split out into `commands`. It has the shape of an
`MF2.Item`, so the microformats readers work on it directly:

```typescript {% title="app/services/micropub.ts" %}
import type { Micropub } from "@sdxc/micropub";

import { values } from "@sdxc/microformats";
import { postType } from "@sdxc/microformats/vocabulary";

export function draftFrom(operation: Micropub.Create) {
	return {
		kind: postType(operation),
		title: values(operation, "name")[0] ?? null,
		content: values(operation, "content")[0] ?? "",
		tags: values(operation, "category"),
		inReplyTo: values(operation, "in-reply-to")[0] ?? null,
		slug: operation.commands.slug,
		draft: operation.commands.status === "draft",
	};
}
```

Your `createPost` can store what `draftFrom` reads and return the new post's URL, which
`created` puts in `Location`. `postType` runs Post Type Discovery, so a create with `in-reply-to` is a `reply` and one with a
name that is not a prefix of its content is an `article`. A reply you store this way is also
a post whose `send` job notifies the page it replies to, which is the loop that makes a
conversation across two sites.

The `GET` side answers queries. `parseQuery` reads `q`, and each answer has its own builder:

```typescript {% title="app/http/controllers/micropub/query.ts" %}
import { config, error, parseQuery, source, syndicateTo } from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { postAsItem } from "~/app/models/posts";
import { verifyToken } from "~/app/services/indieauth";
import routes from "~/routes/web";

export default createAction(routes.micropub.query, async (ctx) => {
	let parsed = parseQuery(ctx.request);
	if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

	let { body: query, accessToken } = parsed.data;
	if (accessToken === null || (await verifyToken(accessToken)) === null) {
		return error("unauthorized");
	}

	switch (query.q) {
		case "config":
			return config({ q: ["source", "syndicate-to"] });
		case "syndicate-to":
			return syndicateTo([]);
		case "source": {
			let item = await postAsItem(ctx.db, query.url);
			if (!item) return error("invalid_request", "No such post");
			return source(item, query.properties);
		}
		default:
			return error("invalid_request", "Unsupported query");
	}
});
```

List only the queries you answer in `config({ q })`, since clients treat a missing one as
unsupported. `source` writes the post back in the shape a JSON create sends, so a client's
editor round-trips it.

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the HTML
  `outboundLinks` reads comes from `toHTML`.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — the other half
  of being followed from someone else's site.
- [Federate a site with ActivityPub](/docs/content-and-feeds/activitypub) — followers,
  replies and likes from Mastodon and the rest of the fediverse.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  retries and the queue behind every job here.
- [`@sdxc/microformats`](/api/microformats) — the authorship algorithm, representative
  `h-card` and the rest of the vocabulary.
