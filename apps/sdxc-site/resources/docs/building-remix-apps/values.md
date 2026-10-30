---
title: Dates, text and identifiers
description: Mint prefixed record IDs, slug and summarize titles, show dates in the viewer's zone, and compare client versions.
section:
    title: Building Remix apps
    order: 4
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "How to mint prefixed record IDs and keep UUIDs typed below the edge"
    - "How to derive a title, slug and summary and show dates in the viewer's zone"
    - "How to compare client versions"
---

Every app handles the same values: record ids, slugs and summaries derived from what people
type, dates, and the versions clients send. Almost right ends up as a URL that moves, a date off
by a day, or an id from the wrong table that finds nothing. This guide follows one record, a blog post, through a Remix v3 app.
[`@sdxc/uuid`](/api/uuid) and [`@sdxc/typeid`](/api/typeid) mint and check its id,
[`@sdxc/strings`](/api/strings) derives its title, slug and summary,
[`@sdxc/dates`](/api/dates) shows when it was published, and [`@sdxc/semver`](/api/semver)
decides which API clients may still read it.

```bash
npm add @sdxc/dates @sdxc/http @sdxc/result @sdxc/semver @sdxc/strings @sdxc/typeid \
	@sdxc/uuid @sdxc/validate remix
```

## Mint record ids

A TypeID puts the table in the id, `post_01h455vb4pex5…`, and keeps the UUID recoverable. Bind
each prefix once, in one module:

```typescript {% title="app/services/ids.ts" %}
import type { TypeID } from "@sdxc/typeid";

import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

export const postId = typeid("post");
export const authorId = typeid("author");

export type PostId = TypeID<"post">;

export function newPostId(): PostId {
	return postId(generateUUID());
}
```

The prefix is a literal type, so a function asking for a `TypeID<"post">` refuses an author
id at compile time. A v7 UUID starts with a timestamp, so new ids sort in creation order.

> [!NOTE]
> A v7 value reveals when it was minted. Import `generateUUID` from `@sdxc/uuid/v4` instead for
> an id you hand to someone outside the system.

## Keep UUIDs typed below the edge

Store the UUID and show the TypeID. `UUID` is a branded string, so a model typed on `UUID`
cannot be handed a raw path segment by mistake:

```typescript {% title="app/models/post.ts" %}
import type { UUID } from "@sdxc/uuid";

import { assertUUID } from "@sdxc/uuid";

export interface Post {
	id: UUID;
	title: string;
	slug: string;
	summary: string;
	publishedAt: Date | null;
}

export function toPost(row: {
	id: string;
	title: string;
	slug: string;
	summary: string;
	published_at: number | null;
}): Post {
	assertUUID(row.id);
	return {
		id: row.id,
		title: row.title,
		slug: row.slug,
		summary: row.summary,
		publishedAt: row.published_at === null ? null : new Date(row.published_at),
	};
}
```

`assertUUID` narrows `row.id` and throws, which fits corrupt stored data. For input a person
controls, branch on `isUUID(value)` instead.

## Derive the title, slug and summary

A slug typed into a form and a slug a background job derives from the same title must agree,
or the published URL moves. Put the derivation in one function and call it from both:

```typescript {% title="app/services/posts/derive.ts" %}
import { createTitleizer, excerpt, slugify, wordCount } from "@sdxc/strings";

const titleize = createTitleizer({ special: ["Remix", "Cloudflare", "SQLite"] });

export function derivePost(input: { title: string; body: string }) {
	let title = titleize(input.title.trim());
	return {
		title,
		slug: slugify(title),
		summary: excerpt(input.body, { length: 160 }),
		readingMinutes: Math.max(1, Math.ceil(wordCount(input.body) / 200)),
	};
}
```

`titleize` follows the Chicago Manual of Style, and `special` spells your product vocabulary
the way you do. `slugify` folds accents, so "Cómo usar Remix" becomes `como-usar-remix`, and
`excerpt` cuts at a word boundary, which makes a good meta description.

> [!NOTE]
> Slugs are not unique on their own. Check for a collision when you insert, and append a short
> suffix when there is one.

## Create and address the record

The create action mints an id, derives the fields, and redirects to the edit page addressed by
the TypeID. `Posts` is your model, which maps each row it reads through `toPost`.

```tsx {% title="app/http/controllers/admin/posts/create.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Posts } from "~/app/models/posts";
import { newPostId } from "~/app/services/ids";
import { derivePost } from "~/app/services/posts/derive";
import { NewPostPage } from "~/resources/views/admin/new-post";
import routes from "~/routes/web";

const NEW_POST = s.object({ title: s.string(), body: s.string() });

export default createAction(routes.admin.posts.create, async (ctx) => {
	let input = await validate(ctx.formData, NEW_POST);
	if (isFailure(input))
		return ctx.render(<NewPostPage issues={input.error.issues} />);

	let id = newPostId();
	let fields = derivePost(input.data);
	await Posts.create(ctx.db, { id: id.toUUID(), body: input.data.body, ...fields });

	let edit = routes.admin.posts.edit.href({ id: id.toString() });
	return redirect(edit, { status: redirect.Status.SeeOther });
});
```

`toUUID()` is the value the column holds, and `toString()` is the `post_…` form for the URL. The
edit page reads it back; `TypeID.isValid` with the expected prefix turns an author id pasted into
a post URL into a `404`:

```tsx {% title="app/http/controllers/admin/posts/edit.tsx" %}
import { text } from "@sdxc/http/response";
import { TypeID } from "@sdxc/typeid";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Posts } from "~/app/models/posts";
import { EditPostPage } from "~/resources/views/admin/edit-post";
import routes from "~/routes/web";

export default createAction(routes.admin.posts.edit, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
	if (!TypeID.isValid(id, "post")) return text("Not found", { status: 404 });

	ctx.log.set({ post: { id } });
	let post = await Posts.find(ctx.db, TypeID.fromString(id, "post").toUUID());
	if (post === null) return text("Not found", { status: 404 });

	return ctx.render(<EditPostPage post={post} />);
});
```

Going the other way, `postId(post.id)` turns a stored `UUID` back into the TypeID for a link.

## Show dates in the viewer's zone

A post published at 02:00 UTC on the 29th was published on the 28th for a reader in New York.
Every `@sdxc/dates` function that answers a calendar question takes a zone, so resolve the
viewer's once per request and pass it down:

```typescript {% title="app/services/viewer.ts" %}
import type { TimeZone } from "@sdxc/dates";

export interface Viewer {
	locale: string;
	timeZone: TimeZone;
}

export function viewerOf(request: Request, saved: Partial<Viewer> = {}): Viewer {
	let cf = request.cf as IncomingRequestCfProperties | undefined;
	return {
		locale: saved.locale ?? "en-US",
		timeZone: saved.timeZone ?? cf?.timezone ?? "UTC",
	};
}
```

A saved preference wins; otherwise Cloudflare's `request.cf.timezone` names the zone the request
came from. The page handler passes `viewerOf(ctx.request)` down to the component that renders the date:

```tsx {% title="resources/components/post-meta.tsx" %}
import type { Handle } from "remix/component";

import { diffInDays, formatDate, formatRelative } from "@sdxc/dates";
import { pluralize } from "@sdxc/strings";

import type { Viewer } from "~/app/services/viewer";

interface Props {
	publishedAt: Date;
	comments: number;
	viewer: Viewer;
}

export function PostMeta(handle: Handle<Props>) {
	return () => {
		let { publishedAt, comments, viewer } = handle.props;
		let { locale, timeZone } = viewer;
		let now = new Date();
		let when =
			diffInDays(now, publishedAt, timeZone) < 7
				? formatRelative(publishedAt, { locale, now })
				: formatDate(publishedAt, { locale, timeZone, dateStyle: "long" });

		let count = `${comments} ${pluralize("comment", comments)}`;

		return (
			<p>
				<time dateTime={publishedAt.toISOString()}>{when}</time> · {count}
			</p>
		);
	};
}
```

`diffInDays` counts calendar days crossed in the viewer's zone, so "yesterday" means yesterday
on the reader's wall calendar, and `formatRelative` lets `Intl` word it ("3 days ago").

## Compare client versions

A mobile app sends its version in `X-Client-Version`, and the API turns away builds older than
the minimum it supports:

```typescript {% title="app/http/middleware/client-version.ts" %}
import type { Middleware } from "remix/router";

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { parse, satisfies } from "@sdxc/semver";

const MINIMUM_CLIENT = "2.4.0";

export const requireSupportedClient: Middleware = (ctx, next) => {
	let version = ctx.request.headers.get("X-Client-Version");
	if (version === null) return next();

	if (isFailure(parse(version))) {
		return json({ error: "X-Client-Version is not a version" }, { status: 400 });
	}
	if (satisfies(version, "<", MINIMUM_CLIENT)) {
		let body = {
			error: "This version is no longer supported",
			minimum: MINIMUM_CLIENT,
		};
		return json(body, { status: 426 });
	}

	return next();
};
```

Versions compare as numbers, so `2.10.0` is newer than `2.9.0`.

> [!WARNING]
> `satisfies` answers `false` whenever either side is not a version, which is why the
> middleware parses first: without that check, a header reading `nightly` passes as "not below
> the minimum".

## Test the derivation and the ids

Both services are plain functions, so a test checks the derived title and slug and that a
TypeID refuses another table's prefix:

```typescript {% title="app/services/posts/derive.test.ts" %}
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import { expect, test } from "vitest";

import { authorId, newPostId } from "~/app/services/ids";
import { derivePost } from "~/app/services/posts/derive";

test("derives the title and slug from what was typed", () => {
	let post = derivePost({
		title: " how to deploy remix on cloudflare ",
		body: "Hello",
	});

	expect(post.title).toBe("How to Deploy Remix on Cloudflare");
	expect(post.slug).toBe("how-to-deploy-remix-on-cloudflare");
});

test("tells a post id from an author id", () => {
	expect(TypeID.isValid(newPostId().toString(), "post")).toBe(true);
	expect(TypeID.isValid(authorId(generateUUID()).toString(), "post")).toBe(false);
});
```

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — schemas
  for the create form and for route params.
- [Calendars, date ranges and time zones](/docs/building-remix-apps/calendars-and-date-ranges)
  — a month grid, a report's day range, and a time-zone picker.
- [`@sdxc/dates`](/api/dates) — day grids, week boundaries and the zone math underneath.
