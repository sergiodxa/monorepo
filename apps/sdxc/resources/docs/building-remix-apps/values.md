---
title: Dates, text and identifiers
description: Mint prefixed record IDs, slug and summarize titles, show dates in the viewer's zone, and compare client versions.
section:
    title: Building Remix apps
    order: 3
order: 6
lastUpdated: 2026-10-08
---

Every app handles the same handful of values: the ids its records carry, the slugs and
summaries it derives from what people type, the dates it shows, and the version numbers
clients send. Each is easy to get almost right, and almost right ends up as a URL that moves,
a date that is off by a day for half your readers, or an id from the wrong table that finds
nothing.

This guide follows one record, a blog post, through a Remix v3 app.
[`@sdxc/uuid`](/api/uuid) and [`@sdxc/typeid`](/api/typeid) mint and check its id,
[`@sdxc/strings`](/api/strings) derives its title, slug and summary,
[`@sdxc/dates`](/api/dates) shows when it was published, and [`@sdxc/semver`](/api/semver)
decides which API clients may still read it.

```bash
npm add @sdxc/uuid @sdxc/typeid @sdxc/strings @sdxc/dates @sdxc/semver \
	@sdxc/result @sdxc/validate @sdxc/http remix
```

## Mint record ids

A bare UUID says nothing about what it identifies, so one pasted into a support ticket has to
be tried against every table. A TypeID puts the answer in the string, `post_01h455vb4pex5…`,
and keeps the UUID recoverable. Bind each prefix once, in one module:

```typescript {% title="app/ids.ts" %}
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
id at compile time. A UUID from `@sdxc/uuid/v7` puts a millisecond timestamp in front of the
random bits, and a TypeID sorts the way its UUID does, so new ids arrive in creation order and
a listing can page on the id alone. Import `generateUUID` from `@sdxc/uuid/v4` instead for an
id you hand to someone outside the system, since a v7 value reveals when it was minted.

## Keep UUIDs typed below the edge

Store the UUID and show the TypeID. The column holds the 36-character UUID the database
indexes well, and the prefix is added where an id leaves your app. `UUID` is a branded string:
a plain `string` is not assignable to it, so a repository typed on `UUID` cannot be handed a
raw path segment by mistake.

```typescript {% title="app/data/post.ts" %}
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

`assertUUID` narrows `row.id` for the rest of the function and throws when it is not a UUID.
That fits here, where a malformed id is corrupt data rather than something a visitor typed.
For input a person controls, `isUUID(value)` gives the same narrowing as a boolean you can
branch on.

## Derive the title, slug and summary

A slug typed into a form and a slug a background job derives from the same title must agree,
or the published URL moves. Put the derivation in one function and call it from both:

```typescript {% title="app/posts/derive.ts" %}
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

`titleize` follows the Chicago Manual of Style, so "how to deploy remix on cloudflare"
becomes "How to Deploy Remix on Cloudflare": small words stay lowercase, and the `special`
list spells your product vocabulary the way you do. A built-in list already covers names
like `TypeScript`, `GitHub` and `JavaScript`. `slugify` folds accents rather than dropping
them, so "Cómo usar Remix" becomes `como-usar-remix`, and keeps letters outside Latin as
letters. `excerpt` collapses the body onto one line and cuts at a word boundary, counting
grapheme clusters, so an emoji is never split in half; it makes a good meta description.
`wordCount` segments words with `Intl.Segmenter`, which also counts a script written without
spaces.

Slugs are not unique on their own. Check for a collision when you insert, and append a short
suffix when there is one.

## Create and address the record

The create action puts the two together: a new id, the derived fields, and a redirect to the
edit page addressed by the TypeID. The route table maps `admin.posts.create` to
`post("/admin/posts")` and `admin.posts.edit` to `get("/admin/posts/:id")`, and `Posts` is your
repository, which maps each row it reads through `toPost`.

```tsx {% title="app/http/controllers/admin/posts/create.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Posts } from "~/app/data/posts";
import { newPostId } from "~/app/ids";
import { derivePost } from "~/app/posts/derive";
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

`toUUID()` hands the database the value its column holds, typed `UUID`, and `toString()` is
the `post_…` form for the URL.
[Validate forms and route params](/docs/building-remix-apps/forms-and-params) covers the
schema and the error page in depth.

The edit page reads the id back. `TypeID.isValid` with the expected prefix answers the routing
question, so an author id pasted into a post URL is a `404` at the edge instead of a query that
quietly finds nothing:

```tsx {% title="app/http/controllers/admin/posts/edit.tsx" %}
import { text } from "@sdxc/http/response";
import { TypeID } from "@sdxc/typeid";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Posts } from "~/app/data/posts";
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

The log records `post_01h455vb4pex5…`, which a person reading it can place at a glance.
Going the other way, `postId(post.id)` turns a stored `UUID` back into the TypeID for a link.

## Show dates in the viewer's zone

A post published at 02:00 UTC on the 29th was published on the 28th for a reader in New York.
Formatting on the server with the server's zone gets that wrong for everyone who does not
live in UTC. `@sdxc/dates` never assumes a zone: every function that answers a calendar
question takes one, so resolve the viewer's once per request and pass it down.

```typescript {% title="app/http/viewer.ts" %}
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

A signed-in person's saved preference wins. Otherwise Cloudflare's `request.cf.timezone`
names the zone the request came from, which is right for most readers on the first visit.
Check a zone a person picks with `isSupportedTimeZone` before saving it, so the stored value
is one the runtime's own zone list offers;
[Calendars, date ranges and time zones](/docs/building-remix-apps/calendars-and-date-ranges)
builds that picker. For the locale,
[Translate your app](/docs/building-remix-apps/translate-your-app) already negotiates one.

The page handler passes `viewerOf(ctx.request)` down to the component that renders the date:

```tsx {% title="resources/components/post-meta.tsx" %}
import type { Handle } from "remix/component";

import { diffInDays, formatDate, formatRelative } from "@sdxc/dates";
import { pluralize } from "@sdxc/strings";

import type { Viewer } from "~/app/http/viewer";

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

`diffInDays` counts the calendar days crossed in the viewer's zone, not 24-hour periods, so
"yesterday" means yesterday on the reader's wall calendar. `formatRelative` picks the unit
and lets `Intl` word it ("yesterday", "3 days ago", "hace 3 días"), and `formatDate` uses one
cached `Intl.DateTimeFormat` per locale and options. The `dateTime` attribute keeps the exact
instant in the markup for machines. `pluralize("comment", comments)` returns the singular when
the count is exactly 1.

The same zone groups a list into days: `toDayKey(post.publishedAt, timeZone)` gives the
`"YYYY-MM-DD"` key of the reader's calendar day, which makes a stable key for an archive
heading or a count per day. Arithmetic on instants takes no zone at all, because a length of
time is the same everywhere: `add(new Date(), "30 days")` is when a draft preview link
expires.

## Compare client versions

Your API also serves a mobile app that sends its version in `X-Client-Version`. Old builds
read a field you are about to remove, so the API turns them away with a message telling the
person to update:

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

Versions compare element by element as numbers, so `2.10.0` is newer than `2.9.0`, and a
prerelease such as `2.4.0-rc.1` precedes `2.4.0`. `satisfies` answers `false` whenever either
side is not a version, which is why the handler parses first: without that check, a header
reading `nightly` would pass as "not below the minimum". `parse` accepts a leading `v`, as a
git tag writes it, and drops build metadata, which carries no precedence.

For a list, `compare` is a sort comparator: `versions.sort(compare)` orders a registry's
answer by precedence, with anything that is not a version collected at the front, so
`.at(-1)` is the newest release. `satisfies(version, "^", "2.0.0")` expresses a compatible
range when a rule lives in data an operator edits.

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — schemas
  for the create form and for route params.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — negotiating the locale
  the formatters take.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — the tables
  behind `Posts`.
- [Calendars, date ranges and time zones](/docs/building-remix-apps/calendars-and-date-ranges)
  — a month grid, a report's day range, and a time-zone picker.
- [`@sdxc/dates`](/api/dates) — day grids, week boundaries and the zone math underneath.
