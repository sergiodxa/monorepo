---
title: "Join the IndieWeb: Webmention and Micropub"
description: Mark posts up with microformats, receive and send Webmentions from background jobs, and accept posts over Micropub.
section:
    title: Content & feeds
    order: 8
order: 3
lastUpdated: 2026-10-25
outcomes:
    - "How to mark posts up with microformats using `@sdxc/microformats`"
    - "How to receive, verify and send Webmentions from background jobs"
    - "How to accept posts over Micropub"
---

The IndieWeb is a set of small protocols that let independent sites talk to each other.
Webmention tells a page it was linked to, so a reply written on someone else's site shows up
under your post. Micropub lets a client you did not write publish to your site. Both read the
same vocabulary, microformats2: class names on ordinary HTML that say which part of a page is
the entry, its author and its date.

This guide adds all three to a Remix v3 app with [`@sdxc/microformats`](/api/microformats),
[`@sdxc/webmention`](/api/webmention) and [`@sdxc/micropub`](/api/micropub), with
[`@sdxc/jobs`](/api/jobs) running every outbound fetch off the request.

```bash
npm add @sdxc/backoff @sdxc/jobs @sdxc/markdown @sdxc/microformats @sdxc/micropub \
	@sdxc/result @sdxc/webmention remix
```

The packages hold the protocols. Storing posts and mentions, moderation, and verifying access
tokens stay yours, so the examples call a few functions from your own `~/app/models/*` modules.

## Mark up your posts

A receiver reads your page's microformats to decide what your post is, and a Webmention you
send is only as good as the markup it points at. `mf` from `@sdxc/microformats/ui` is a mixin
that adds the class names, typed so a misspelled property is a compile error:

```tsx {% title="resources/components/post-entry.tsx" %}
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
time while the reader sees your formatted label.

## Receive Webmentions

Map your posts, the Webmention endpoint, and a Micropub endpoint that answers `GET` and `POST`:

```typescript {% title="routes/web.ts" %}
import { get, post, route } from "remix/routes";

export default route({
	posts: { show: get("/posts/:slug") },
	webmention: post("/webmention"),
	micropub: { query: get("/micropub"), write: post("/micropub") },
});
```

Advertise the endpoint in both places a sender looks. `advertise` writes the `Link` header
value for a post's response:

```typescript {% title="app/services/webmention.ts" %}
import { advertise } from "@sdxc/webmention/discover";

import routes from "~/routes/web";

export const USER_AGENT = "Example Webmention (+https://example.com)";

export function webmentionHeaders(base: URL) {
	return { link: advertise(new URL(routes.webmention.href(), base)).header };
}
```

Pass it when you render a post, as in
`ctx.render(<PostPage post={post} />, { headers: webmentionHeaders(ctx.url) })`, and render the
`<link>` elements in your document layout's `<head>`, beside the one a Micropub client looks for:

```tsx {% title="resources/components/indieweb-links.tsx" %}
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

`parseRequest` validates the request without fetching anything. Verification means fetching
`source`, a URL an anonymous caller chose, so it goes on the queue:

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

`rejected` answers `400` with the reason, and `accepted` answers `202`. `ctx.jobs` comes from
`jobEnqueuer(queue)` in `@sdxc/jobs/router` (see
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

`verify` fetches the source under bounds (public hosts only, limited redirects, size and time),
checks that it links to the target, and summarizes it from its microformats. Key what you
store on the pair, since a repeated pair is an update:

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

A timeout, a `5xx` or a `429` is `retryable`; a refused host or an oversized body is not.
`gone` (the source answered `410`) and `unlinked` both mean the mention no longer stands, so
both delete it. A `linked` mention carries its `kind`, author and content, and `content.html`
is already sanitized, so an approved reply renders as it stands.

> [!WARNING]
> Store mentions as pending and show them once you approve them. The endpoint is anonymous, and
> moderation is the one policy the protocol leaves entirely to you.

## Send Webmentions

When a post is created, updated or deleted, enqueue `jobs.webmentions.send` with its id.
`outboundLinks` lists the links in the post's HTML, and `plan` adds every page you notified
before that the post no longer links to, since a removed link is notified too.

```typescript {% title="app/jobs/webmentions/send.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";
import { outboundLinks, plan } from "@sdxc/webmention/sender";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/initializers/dispatcher";
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

> [!NOTE]
> Serve `410 Gone` from a deleted post's URL before the send job runs, so each receiver's own
> verification sees the deletion and removes the mention.

Deliver one job per target, so a slow endpoint delays nobody else:

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

`send` discovers the target's endpoint and POSTs the pair, answering
`{ status: "no-endpoint" }` for a page that takes no mentions. A failure is either a
`WebmentionFetchError`, which says whether it is `retryable`, or a `WebmentionSendError`
carrying the status the endpoint answered.

## Accept posts over Micropub

A Micropub client finds your endpoint through the `rel="micropub"` link and signs in through
IndieAuth, which ends with an access token you verify. `parseOperation` decodes a form,
multipart or JSON POST into one of four typed operations, plus the token.

> [!WARNING]
> Verify the access token and its scopes before you act on anything in the body. A Micropub
> request writes to your site, and the token is the only thing that says who sent it.

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
grants, or `null`. `requiredScopes` names the scopes any one of which authorizes the operation.

A create arrives as microformats2 properties, with `mp-slug` and `post-status` split out into
`commands`, so the microformats readers work on it directly:

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

Your `createPost` stores what `draftFrom` reads and returns the new post's URL, which `created`
puts in `Location`. `postType` runs Post Type Discovery, so a create with `in-reply-to` is a
`reply`.

The `GET` side answers queries; `parseQuery` reads `q`, and each answer has its own builder:

```typescript {% title="app/http/controllers/micropub/query.ts" %}
import { config, error, parseQuery, syndicateTo } from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

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
			return config({ q: ["syndicate-to"] });
		case "syndicate-to":
			return syndicateTo([]);
		default:
			return error("invalid_request", "Unsupported query");
	}
});
```

> [!NOTE]
> List only the queries you answer in `config({ q })`, since clients treat a missing one as
> unsupported.

## Test it

A malformed mention is refused before anything reads your database, so a request through the
router proves the endpoint is mapped. Test how a Micropub create becomes a draft from a plain
form post:

```typescript {% title="app/http/controllers/webmention.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

test("refuses a mention whose source is its target", async () => {
	let url = new URL(routes.webmention.href(), "https://example.com");
	let page = "https://example.com/posts/hello";

	let response = await createWebRouter().fetch(
		new Request(url, {
			method: "POST",
			body: new URLSearchParams({ source: page, target: page }),
		}),
	);

	expect(response.status).toBe(400);
});
```

```typescript {% title="app/services/micropub.test.ts" %}
import { parseOperation } from "@sdxc/micropub";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { draftFrom } from "~/app/services/micropub";

test("reads a form post with in-reply-to as a reply", async () => {
	let request = new Request("https://example.com/micropub", {
		method: "POST",
		body: new URLSearchParams({
			h: "entry",
			content: "Agreed!",
			"in-reply-to": "https://other.com/posts/1",
			"mp-slug": "agreed",
		}),
	});

	let { body } = unwrap(await parseOperation(request));
	if (body.action !== "create") throw new Error("Expected a create");

	expect(draftFrom(body)).toMatchObject({
		kind: "reply",
		inReplyTo: "https://other.com/posts/1",
		slug: "agreed",
		draft: false,
	});
});
```

## Where to go next

- [Federate a site with ActivityPub](/docs/content-and-feeds/activitypub) — followers,
  replies and likes from Mastodon and the rest of the fediverse.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  retries and the queue behind every job here.
- [`@sdxc/microformats`](/api/microformats) — the authorship algorithm, representative
  `h-card` and the rest of the vocabulary.
