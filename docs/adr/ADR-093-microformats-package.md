# ADR-093: Microformats2 Package

## Status

**Accepted** - 2026-09-24

## Background

[Microformats2](https://microformats.org/wiki/microformats2-parsing) is the vocabulary the
IndieWeb reads a page through: class names on ordinary HTML (`h-entry`, `p-name`,
`u-in-reply-to`, `dt-published`, `e-content`) that a parser turns into a JSON document of
typed items. Two W3C Recommendations the blog is about to adopt are built on it.
[Webmention](./ADR-094-webmention-package.md) tells a page it was linked to, and the
receiver reads the linking page's microformats to show the mention as a reply, a like or a
repost with its author's name and photo. [Micropub](./ADR-095-micropub-package.md) lets a
client publish to the blog, and its JSON request body is the microformats2 JSON shape, as is
the `q=source` answer that hands a post back to an editor.

Nothing in the repository reads or writes microformats today. `apps/blog` renders its posts
with no `h-entry` markup, no `h-card` for its author and no `rel="me"` links, so a
Webmention another site sends about one of its posts can read nothing about the post, and a
reply sent from the blog carries nothing a receiver can display.

## Context

### Two consumers, one format

| Consumer                 | Reads                                                                                                     | Writes                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Webmention receiver      | The source page's `h-entry`: author `h-card`, `content`, `published`, `in-reply-to`/`like-of`/`repost-of` | nothing                                                           |
| Micropub server          | A JSON create request, which is an mf2 item                                                               | `q=source`, which answers with an mf2 item                        |
| The blog's own templates | nothing                                                                                                   | `h-entry`, `h-card`, `h-feed` classes and `rel="me"` on each page |

Webmention alone would justify a parser inside the Webmention package. Micropub reads and
writes the JSON shape without ever touching HTML, and the blog's templates write the HTML
side without either protocol. A format with a reader and a writer, consumed by two protocol
packages that do not depend on each other, gets its own package.

### What the parsing specification asks of an implementation

| Rule                                                                                             | Consequence for the package                                                                                      |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| A root is any element with a class `h-*` whose suffix is lowercase letters and hyphens           | class tokens are matched by pattern, never against a list of known vocabularies                                  |
| Properties are `p-*` (text), `u-*` (URL), `dt-*` (date-time), `e-*` (embedded markup)            | four value parsers, each with its own element precedence (`a[href]`, `img[src]`, `abbr[title]`, `data[value]` …) |
| A property element that is also a root is a nested item carrying a `value`                       | a property value is a union: string, URL-with-alt, embedded markup, or nested item                               |
| A root that is not a property is one of the parent's `children`                                  | items form a tree the typed views walk                                                                           |
| `name`, `photo` and `url` are implied when no explicit property of that kind exists              | implied properties are computed after explicit ones, under the spec's exact conditions                           |
| The value-class pattern assembles `dt-*` from separate date, time and timezone parts             | `dt-*` values are normalized to the spec's date-time form, not to a JavaScript `Date`                            |
| `u-*` values and `e-*` markup resolve against the document URL, honoring `<base href>`           | parsing takes a base URL; a source parsed without one is a type error                                            |
| `rel` values on `a`, `area` and `link` are collected into `rels` and `rel-urls`                  | the document carries `rels` for `rel="me"` and `rel="webmention"` alike                                          |
| `img` with `alt` in a `u-*` property yields `{ value, alt }`                                     | alternative text survives into the display of a mention                                                          |
| Classic microformats (`hentry`, `vcard`, `entry-title`) map onto mf2 when no mf2 root is present | backward-compatible parsing is part of the parser, since much of the web that replies still uses it              |

### What the repository already has

`@sdxc/html` (ADR-055) parses HTML with linkedom and publishes the tree through
`@sdxc/html/document` so another package walks the same tree instead of running a second
parser. `@sdxc/distill` is that pattern's first consumer. `HTML.sanitize` rewrites foreign
markup into a safe subset, which is what an `e-content` from somebody else's page needs
before the blog renders it. The parser in this ADR is the second consumer of
`parseDocument`, and the sanitizer is where displayed `e-*` markup goes.

## Decision

Add `@sdxc/microformats`: parse HTML into canonical microformats2 JSON, read and write that
JSON, give typed views of the vocabularies the IndieWeb protocols use, and give `remix/ui`
templates typed class names to emit them.

### Package name

| Name                        | Trade-off                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **`@sdxc/microformats`**    | Names the format a reader searches for; covers classic and v2 alike, which the parser reads                                 |
| `@sdxc/mf2`                 | Short and what the community calls it, but opaque to anyone outside the IndieWeb                                            |
| Part of `@sdxc/html`        | Shares the parser, but puts a vocabulary, its JSON form and JSX helpers into a package whose contract is role-based queries |
| Part of `@sdxc/webmention`  | One package fewer, but Micropub would depend on Webmention to read its own request bodies                                   |
| `@sdxc/indieweb` (umbrella) | One import for mf2, Webmention and Micropub; evaluated under Alternatives Considered                                        |

`@sdxc/microformats` wins because the format has two protocol consumers and a template
consumer that are independent of each other, and the name says what it is to someone who
has never heard of mf2. The `MF2` namespace inside keeps the short form where it reads well.

### Scope

The package includes:

- The microformats2 parsing algorithm: roots, the four property kinds, nested items,
  `children`, implied `name`/`photo`/`url`, the value-class pattern, `rels` and `rel-urls`,
  `id` and `lang` on items, and URL resolution honoring `<base href>`
- Backward-compatible parsing of the classic roots the parsing specification maps
  (`hentry`, `hfeed`, `vcard`, `adr`, `geo`, `vevent`, `hreview` and the rest of its
  table) with their property classes
- Reading and writing the canonical JSON form, including a `remix/data-schema` schema for
  an mf2 item, which is what a Micropub JSON body is validated against
- Typed views of `h-entry`, `h-card`, `h-feed` and `h-cite`, the authorship algorithm, the
  representative `h-card` algorithm and Post Type Discovery
- Class-name helpers and a date-time component for `remix/ui` templates

What stays out:

- Fetching a page lives in `@sdxc/html` (`HTML.fetch`) and, with the bounds an arbitrary
  origin needs, in the Webmention receiver
- Sanitizing an `e-*` value for display lives in `@sdxc/html` (`HTML.sanitize`)
- Storing a parsed mention lives in the app that received it
- Mapping an item onto a post lives in the blog

### Exports

#### `"."` — parse and serialize

```ts
import type { DOMDocument } from "@sdxc/html/document";
import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/** Signals a source that carries no markup to parse. */
export class MicroformatsParseError extends Error {
	override name = "MicroformatsParseError";
}

/** Signals JSON that is not an mf2 item or document, carrying the data-schema issues. */
export class MicroformatsShapeError extends Error {
	override name = "MicroformatsShapeError";
	readonly issues: readonly StandardSchemaV1.Issue[];
}

export namespace MF2 {
	/** A parsed page: every top-level item, and every `rel` the page declares. */
	export interface Document {
		items: Item[];
		rels: Record<string, string[]>;
		/** `rel-urls` on the wire. */
		relUrls: Record<string, RelUrl>;
	}

	export interface Item {
		type: string[];
		/** Keys are vocabulary names (`in-reply-to`), which are data, kept as spelled. */
		properties: Record<string, PropertyValue[]>;
		id?: string;
		lang?: string;
		children?: Item[];
	}

	/** A property element that is also a root: the item, plus the value its property kind implies. */
	export interface NestedItem extends Item {
		value: string | Url;
		html?: string;
	}

	export interface Url {
		value: string;
		alt: string;
	}

	/** An `e-*` value: the markup as authored, URLs resolved, and its text. */
	export interface Embedded {
		html: string;
		value: string;
		lang?: string;
	}

	export type PropertyValue = string | Url | Embedded | NestedItem;

	export interface RelUrl {
		rels: string[];
		text?: string;
		title?: string;
		media?: string;
		hreflang?: string;
		type?: string;
	}

	export interface ParseOptions {
		/** Classic microformats roots are read when a subtree carries no mf2 root. @default true */
		backcompat?: boolean;
	}
}

/** Parses markup into the canonical document; `baseUrl` is what `u-*` values resolve against. */
export function parse(
	source: string,
	baseUrl: string | URL,
	options?: MF2.ParseOptions,
): Result<MF2.Document, MicroformatsParseError>;

/** Reads a tree `@sdxc/html/document` already built, so one fetch serves several readers. */
export function fromDocument(
	document: DOMDocument,
	baseUrl: string | URL,
	options?: MF2.ParseOptions,
): MF2.Document;

/** Writes the canonical JSON text, with wire names (`rel-urls`). */
export function stringify(value: MF2.Document | MF2.Item): string;

/** Reads canonical JSON text back into a document. */
export function parseJSON(text: string): Result<MF2.Document, MicroformatsShapeError>;

/** Validates one mf2 item already decoded from JSON, which is a Micropub JSON create body. */
export const ITEM_SCHEMA: Schema<unknown, MF2.Item>;

/** First item, depth-first through `children` and nested properties, whose type includes `type`. */
export function findItem(document: MF2.Document | MF2.Item[], type: string): MF2.Item | null;

/** Every value of a property as plain strings: a nested item's `value`, a URL's `value`, an embedded value's text. */
export function values(item: MF2.Item, property: string): string[];
```

`parse` is `fromDocument(parseDocument(source), baseUrl)`. `fromDocument` is the entry
point the Webmention receiver uses, because it has to both find the target link and read
the microformats of the same page, and one tree answers both.

A format package in this repository exposes `parse` and `stringify`. Here the two sides
are not symmetric: `parse` reads HTML, and the HTML side is written by templates through
`./ui`, so `stringify` writes the JSON form, which is the document the parser produces and
the one Micropub sends and receives. `parseJSON` completes the pair for that form.

`dt-*` values stay strings in the spec's normalized form (`2026-09-23 10:15:00-0300` or a
date alone). A date without a time or a timezone is common and meaningful, and turning it
into a `Date` would invent the missing parts. The typed views convert where they can.

#### `"./vocabulary"` — typed views

```ts
import type { Result } from "@sdxc/result";
import type { MF2, MicroformatsShapeError } from "@sdxc/microformats";

export namespace Vocabulary {
	export interface Card {
		name: string | null;
		url: string | null;
		photo: MF2.Url | null;
		/** Every `u-url`, where `url` is the first; the representative card algorithm compares them. */
		urls: string[];
		uid: string | null;
		note: string | null;
	}

	export interface Cite {
		url: string | null;
		name: string | null;
		author: Card | null;
		content: MF2.Embedded | null;
		published: DateTime | null;
	}

	export interface Entry {
		name: string | null;
		summary: string | null;
		content: MF2.Embedded | null;
		published: DateTime | null;
		updated: DateTime | null;
		url: string | null;
		uid: string | null;
		author: Card | null;
		photo: MF2.Url[];
		category: string[];
		inReplyTo: Cite[];
		likeOf: Cite[];
		repostOf: Cite[];
		bookmarkOf: Cite[];
		syndication: string[];
		rsvp: "yes" | "no" | "maybe" | "interested" | null;
	}

	export interface Feed {
		name: string | null;
		author: Card | null;
		entries: Entry[];
	}

	/** A `dt-*` value, as written and as an instant when it names one. */
	export interface DateTime {
		value: string;
		/** `null` for a date alone or a time with no timezone, where no instant is named. */
		instant: Date | null;
	}

	export type PostType =
		"rsvp" | "repost" | "like" | "reply" | "bookmark" | "photo" | "video" | "article" | "note";
}

export function readEntry(item: MF2.Item): Result<Vocabulary.Entry, MicroformatsShapeError>;
export function readCard(item: MF2.Item): Result<Vocabulary.Card, MicroformatsShapeError>;
export function readFeed(item: MF2.Item): Result<Vocabulary.Feed, MicroformatsShapeError>;

/** Reads any vocabulary through a caller's schema, after single-valued properties are unwrapped. */
export function readItem<Schema extends StandardSchemaV1>(
	item: MF2.Item,
	schema: Schema,
): Result<StandardSchemaV1.InferOutput<Schema>, MicroformatsShapeError>;

/** The author of an entry per the IndieWeb authorship algorithm: the entry, then its feed, then `rel=author`. */
export function authorOf(
	entry: MF2.Item,
	document: MF2.Document,
	pageUrl: string,
): Vocabulary.Card | { url: string } | null;

/** The representative `h-card` of a page: `uid` and `url` match the page, or a `rel=me` match, or the only card. */
export function representativeCard(document: MF2.Document, pageUrl: string): Vocabulary.Card | null;

/** Post Type Discovery over an entry's explicit properties. */
export function postType(entry: MF2.Item): Vocabulary.PostType;

/** The entry among a page's items that links to `target` by one of the response properties. */
export function responseTo(
	document: MF2.Document,
	target: string,
): { entry: MF2.Item; type: "reply" | "like" | "repost" | "bookmark" | "mention" } | null;
```

The views read the canonical document, so they are the same whether the item came from
HTML or from a Micropub JSON body. A property holding a nested item and one holding a
plain URL both become a `Cite` or a `Card` (a bare URL gives a card whose only field is
`url`), which is how the mf2 vocabulary is written in practice. `authorOf` returns
`{ url }` when authorship ends at a URL, since resolving it means fetching another page
and that is the caller's decision.

The authorship algorithm, the representative card and Post Type Discovery are IndieWeb
living specifications, not W3C ones. They belong here because both protocol packages would
otherwise carry their own copy: Webmention to label a mention, Micropub to decide whether a
create is a note, an article or a bookmark.

#### `"./ui"` — writing microformats from `remix/ui` templates

```ts
import type { Handle, MixinDescriptor, RemixNode } from "remix/ui";

export namespace MF2UI {
	export type EntryText = "name" | "summary" | "author" | "category" | "location" | "rsvp";
	export type EntryUrl =
		| "url"
		| "uid"
		| "photo"
		| "in-reply-to"
		| "like-of"
		| "repost-of"
		| "bookmark-of"
		| "syndication";
	export type CardText = "name" | "nickname" | "org" | "note" | "locality" | "country-name";
	export type CardUrl = "url" | "uid" | "photo" | "email";
	export type Root =
		"h-entry" | "h-card" | "h-feed" | "h-cite" | "h-event" | "h-adr" | `h-x-${string}`;
	export type Property =
		| `p-${EntryText | CardText}`
		| `u-${EntryUrl | CardUrl}`
		| `dt-${"published" | "updated" | "start" | "end" | "bday"}`
		| `e-${"content" | "note"}`
		| `${"p" | "u" | "dt" | "e"}-x-${string}`;
	export type ClassName = Root | Property;
}

/** A mixin adding microformats class tokens to its host; an unknown name is a type error. */
export function mf(...names: MF2UI.ClassName[]): MixinDescriptor;

/** The same tokens as a `class` string, for markup produced outside a component tree. */
export function classes(...names: MF2UI.ClassName[]): string;

/** A `<time>` carrying a `dt-*` class and an ISO `datetime`, so parsers read an instant with its offset. */
export function MicroTime(
	handle: Handle<{
		property: `dt-${string}`;
		value: Date;
		children?: RemixNode;
	}>,
): () => RemixNode;
```

`mf()` is a mixin so it goes where the blog already puts everything else, in `mix`, next
to the `css()` mixins, and it reaches through components that forward `mix` to their host
(`Heading`, `Link`, `Card` in `@sdxc/ui`) without each of them growing a `class` prop. The
vocabulary unions are written out for `h-entry`, `h-card`, `h-feed`, `h-cite` and
`h-event`, so a typo such as `p-in-reply-to` on a `u-*` property or a classic `hentry`
fails to compile. The `-x-` escape hatch is the spec's own vendor prefix.

### Usage

The blog marks up its post page, its author card and its listing pages once, and verifies
the result with its own parser in a test. `apps/blog/resources/views/post.tsx` renders
the article today as an `<article>` around `Typeset`, with a `Heading` for the title and
no date or author; it becomes:

```tsx
import { mf, MicroTime } from "@sdxc/microformats/ui";

<article mix={[mf("h-entry"), p(4), rounded("lg")]}>
	<Heading level={1} mix={[mf("p-name"), m(0), text("4xl")]}>
		{model.post.title}
	</Heading>
	<Link href={model.post.url} mix={[mf("u-url", "u-uid")]}>
		<MicroTime property="dt-published" value={model.post.publishedAt}>
			{model.post.publishedLabel}
		</MicroTime>
	</Link>
	<Link href={PROFILE.canonical.origin} mix={[mf("p-author", "h-card")]}>
		{PROFILE.name}
	</Link>
	<div mix={[mf("e-content")]}>
		<Typeset preset="reading">{toRemix(model.post.document)}</Typeset>
	</div>
</article>;
```

```ts
import { findItem, parse } from "@sdxc/microformats";
import { readEntry } from "@sdxc/microformats/vocabulary";

test("the post page is an h-entry with an author card", async () => {
	let response = await app.fetch(new Request("https://sergiodxa.com/articles/some-slug"));
	let document = assertSuccess(parse(await response.text(), response.url));
	let entry = assertSuccess(readEntry(findItem(document, "h-entry")!));
	expect(entry.author?.name).toBe("Sergio Xalambrí");
});
```

The Webmention verification job reads the fetched source once:

```ts
let document = fromDocument(tree, sourceUrl);
let response = responseTo(document, targetUrl);
let entry = response ? readEntry(response.entry) : null;
let author = response ? authorOf(response.entry, document, sourceUrl) : null;
```

The Micropub server validates a JSON create against `ITEM_SCHEMA` and answers `q=source`
with `stringify(item)` (ADR-095).

| File in `apps/blog`                         | Change                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `resources/views/post.tsx`                  | `h-entry` with `p-name`, `u-url`, `dt-published`, `p-author h-card`, `e-content` |
| `app/http/view-models/post.ts`              | exposes the published date and the absolute URL the view now renders             |
| `resources/views/feed.tsx`, `bookmarks.tsx` | `h-feed` around the list, one `h-entry` per item, `u-bookmark-of` on bookmarks   |
| `resources/layouts/document.tsx`            | `<link rel="me">` for each profile in `config/profile.ts`                        |
| `resources/layouts/blog.tsx`                | the site `h-card` (name, photo, `u-url u-uid` on the origin)                     |

## Consequences

### Positive

- **One reading of the format** - Webmention and Micropub see the same item for the same
  markup, and the blog's own pages are checked against the parser that reads everybody
  else's
- **Spec conformance is testable** - the official microformats test suite ships HTML with
  its expected JSON, so conformance is a fixture loop, not a judgement
- **Templates cannot drift from the vocabulary** - class names are typed, so a renamed
  property or a typo is a compile error on the page that emits it
- **No second HTML parser** - the tree comes from `@sdxc/html/document`, so this package
  and `@sdxc/distill` agree on what any markup is

### Negative

- **Backcompat is a large table** - classic microformats map by a per-vocabulary list of
  class names and exceptions, which is the most tedious part of the parser and the part the
  blog itself never emits
- **Living IndieWeb specs move** - authorship, representative card and Post Type Discovery
  are wiki-maintained and change without versions, so the vocabulary subpath follows them by
  hand
- **Three subpaths for one format** - a consumer reading only JSON still installs the
  linkedom dependency through `@sdxc/html`

### Neutral

- **`dt-*` values stay strings** - callers that need an instant use the vocabulary's
  `DateTime.instant`, which is `null` where the page named no instant
- **`e-*` markup is returned as authored** - display goes through `HTML.sanitize`, which is
  where the repository already decides what foreign markup may render

## Implementation Plan

### Phase 1: Parser against the official test suite

**Priority:** High
**Estimated Effort:** 1.5 days

1. Vendor the `microformats-v2` and `microformats-mixed` fixtures of
   `microformats/tests` under `packages/microformats/src/fixtures/`, with the upstream
   license and commit recorded, and write the fixture loop: parse each `.html` with the
   suite's base URL and compare with its `.json`
2. Implement roots, the four property parsers, nesting, implied properties, the value-class
   pattern, `rels`/`rel-urls` and URL resolution over `parseDocument`
3. Implement `stringify`, `parseJSON`, `ITEM_SCHEMA`, `findItem` and `values`

### Phase 2: Backward-compatible parsing

**Priority:** Medium
**Estimated Effort:** 1 day

1. Add the `microformats-v1` fixtures and the classic-to-mf2 mapping tables, starting with
   `hentry`, `hfeed` and `vcard` (what replying sites still emit) and finishing the table

### Phase 3: Vocabulary and templates

**Priority:** High
**Estimated Effort:** 1 day

1. Write tests from the IndieWeb wiki examples for authorship, the representative card and
   Post Type Discovery, then implement `./vocabulary`
2. Implement `mf()` and `MicroTime`, with type tests for the class-name unions
3. Write the README and add the row to the root README package table

### Phase 4: Mark up the blog

**Priority:** High
**Estimated Effort:** 0.5 days

1. Add `h-entry` to the post page, `h-feed` to listings, the site `h-card` and `rel="me"`
   links to the layout
2. Add the round-trip test that parses the rendered post page with the package itself

### Phase 5: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Remove `private: true`, add `description` and `LICENSE.md`, bootstrap the release and
   configure the trusted publisher

## Current Progress

- [x] Phase 1: Parser against the official test suite
  - [x] Vendor `microformats-v2`, `microformats-v2-unit` and `microformats-mixed` and run the fixture loop
  - [x] Roots, property parsers, nesting, implied properties, value-class pattern, rels, URL resolution
  - [x] `stringify`, `parseJSON`, `ITEM_SCHEMA`, `findItem`, `values`
- [x] Phase 2: Backward-compatible parsing
  - [x] `microformats-v1` fixtures and the classic-to-mf2 tables
- [x] Phase 3: Vocabulary and templates
  - [x] `./vocabulary`, tested against the IndieWeb wiki's examples
  - [x] `mf()`, `classes()`, `MicroTime`, with type tests for the class-name unions
  - [x] README and root README row
- [ ] Phase 4: Mark up the blog
- [ ] Phase 5: Publish

## Notes

- Implementation: the test suite (CC0, commit `d49f5d7`) is vendored under
  `docs/vendor/microformats-tests` rather than `src/fixtures`, because whitespace in its HTML
  and JSON is data and the formatter rewrites both everywhere outside `docs/vendor`. 135 of
  140 fixtures run and match; `src/conformance.test.ts` lists each departure with its reason.
  They are markup linkedom builds differently from an HTML5 parser (it splits `class` on
  Unicode whitespace and drops repeated tokens, and nests an `<a>` inside an `<a>`), the
  classic include pattern, which the mf2 backcompat rules never read, and two places where
  the suite contradicts itself (a value-class timezone keeps its colon in the unit suite and
  loses it in `h-event/time`; a mistyped nested `u-*` item's fallback value).
- Implementation: an absolute URL is kept as written and an empty reference is the base as
  given, since the suite expects `http://example.com` without the slash a URL serializer adds.
- Implementation: a custom `remix/ui` mixin adds class names alongside `css()` the same way
  `css()` itself does, by returning the host element with `className` extended; the runtime
  merges `class` and `className` on render. `mf()` is that mixin, so no alternative was needed.
- Implementation: `ITEM_SCHEMA` always outputs a canonical item. Micropub clients send
  `{ html }` content and nested `h-card`s without a `value`, so a missing `value` is read from
  the markup's text, or from the nested item's first `name`, then its first `url`.
- Implementation: `readEntry`, `readCard` and `readFeed` fail only for an item of another
  type; property values in an unexpected shape are read as the closest field value instead.
- Implementation: `representativeCard`'s last rule follows the living specification, which
  takes the page's only card only when one of its `url`s is the page.
- Implementation: `Item.lang` and `Embedded.lang` are the nearest `lang` in scope, so a page
  declaring `<html lang>` gives every item its language.

## Alternatives Considered

### 1. `@sdxc/indieweb`, one package for microformats, Webmention and Micropub

One install, one README, and the three specs are almost always adopted together.

**Rejected because**: the three have different dependency weights and different consumers.
A site that only marks up its pages would install a Webmention sender and a Micropub request
parser; a Micropub client needs the JSON form and none of the HTML parsing. Subpaths could
separate the code but not the release notes, and ADR-007 publishes a package whenever any
file in it changes, so a Webmention fix would republish the parser every consumer pins.
Three packages that depend in one direction (Webmention and Micropub on microformats) keep
each change where it belongs. The umbrella decision is the same in ADR-094 and ADR-095.

### 2. Put the parser in `@sdxc/html`

**Rejected because**: `@sdxc/html` answers role-and-name questions about a page, and its
`./document` subpath exists precisely so vocabularies built on the tree live elsewhere.
Adding a vocabulary, a JSON format and JSX helpers would make every consumer of a query
helper carry them.

### 3. Use `microformats-parser` from npm

It passes the official suite and is maintained.

**Rejected because**: it parses with `parse5` into its own tree, so the Webmention receiver
would parse every source twice (once for the link check with `@sdxc/html`, once for
microformats) with two parsers that can disagree about malformed markup. It throws on bad
input rather than returning a `Result`, and its output types have no data-schema
counterpart for Micropub's JSON bodies. The typed views and template helpers would still
have to be written here.

### 4. Only the JSON form, no HTML parser

Micropub needs only the JSON shape, and a mention could be displayed from the source's
title alone.

**Rejected because**: a mention without its author, its content and its response type is
a bare link, and telling a reply from a like is the point of receiving one.

## References

- [Microformats2 parsing specification](https://microformats.org/wiki/microformats2-parsing)
- [microformats/tests - the official parser test suite](https://github.com/microformats/tests)
- [h-entry](https://microformats.org/wiki/h-entry), [h-card](https://microformats.org/wiki/h-card), [h-feed](https://microformats.org/wiki/h-feed), [h-cite](https://microformats.org/wiki/h-cite)
- [Authorship algorithm](https://indieweb.org/authorship-spec)
- [Representative h-card parsing](https://microformats.org/wiki/representative-h-card-parsing)
- [Post Type Discovery](https://www.w3.org/TR/post-type-discovery/)
- [ADR-055: HTML Package](./ADR-055-html-package.md)
- [ADR-094: Webmention Package](./ADR-094-webmention-package.md)
- [ADR-095: Micropub Package](./ADR-095-micropub-package.md)
