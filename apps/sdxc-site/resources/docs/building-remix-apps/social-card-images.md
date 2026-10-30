---
title: Draw social card images
description: Render an Open Graph image for every page inside a Cloudflare Worker, serve it at the page's own address with .png added, keep each card in R2 under a hash of its text, and advertise it with its size.
section:
    title: Building Remix apps
    order: 4
order: 14
lastUpdated: 2026-10-25
outcomes:
    - "How to render an Open Graph image inside a Worker with `@sdxc/raster` and `@sdxc/font`"
    - "How to store each card in R2 under a hash of its text"
    - "How to serve the card at the page's own address with `.png` added and advertise its size"
---

A link to your site shared in a chat or a timeline shows the image its page names in
`og:image`. A hand-made image per page goes stale the day a title changes, and a single image for
the whole site says nothing about the page. This guide draws a card for every blog post from the
post's own title and description, inside the Worker that serves the post, so the card always
matches the page.

[`@sdxc/raster`](/api/raster) is the canvas, [`@sdxc/font`](/api/font) reads the TrueType fonts
the text is set in, and [`@sdxc/png`](/api/png) encodes the result, all in plain TypeScript with
no WebAssembly. [`@sdxc/file-storage-r2`](/api/file-storage-r2) keeps every card drawn in an R2
bucket, [`@sdxc/crypto`](/api/crypto) names each card by a hash of its text, and
[`@sdxc/seo`](/api/seo) writes the tags that advertise it.

```bash
npm add @sdxc/crypto @sdxc/file-storage-r2 @sdxc/font @sdxc/http @sdxc/png \
    @sdxc/raster @sdxc/result @sdxc/seo remix
```

A post at `/blog/hello` advertises its card as `/blog/hello.png?v=<hash>`, where the hash covers
the card's text. A request reads the card from R2 and draws it only when it is missing, so each
card is drawn once per text and a matching `?v=` can be cached for a year.

## Bundle the fonts

`@sdxc/font` reads TrueType `.ttf` files with `glyf` outlines; pick faces whose license allows
embedding, such as Inter's SIL Open Font License. Rename each file with a `.bin` extension, for example
`resources/fonts/inter-bold.ttf.bin`: Wrangler and the Cloudflare Vite plugin bundle a `.bin`
import as a data module, which the Worker receives as an `ArrayBuffer`. Declare that shape once
for TypeScript:

```typescript {% title="env.d.ts" %}
declare module "*.bin" {
	const bytes: ArrayBuffer;
	export default bytes;
}
```

Parse the fonts on the first card an isolate draws and keep them for the isolate's life.

> [!WARNING]
> Parsing at module scope runs while Cloudflare validates the upload, which can fail the
> deploy, and again on every cold start, including the ones that only serve a page. Keep the
> parse inside a function, as `cardFonts` does.

```typescript {% title="app/initializers/card-fonts.ts" %}
import type { FontError } from "@sdxc/font";
import type { Result } from "@sdxc/result";

import { parseFont } from "@sdxc/font";
import { isFailure, success } from "@sdxc/result";

import type { CardFonts } from "~/app/services/social-cards/draw";

import INTER_BOLD from "~/resources/fonts/inter-bold.ttf.bin";
import INTER_REGULAR from "~/resources/fonts/inter-regular.ttf.bin";

let parsed: Result<CardFonts, FontError> | undefined;

export function cardFonts(): Result<CardFonts, FontError> {
	parsed ??= parseAll();
	return parsed;
}

function parseAll(): Result<CardFonts, FontError> {
	let regular = parseFont(INTER_REGULAR);
	if (isFailure(regular)) return regular;
	let bold = parseFont(INTER_BOLD);
	if (isFailure(bold)) return bold;
	return success({ regular: regular.data, bold: bold.data });
}
```

A failure is a `FontError` whose `code` says why, such as `unsupported` for a CFF-based `.otf`.

## Decide what the card says

The card's text comes from the post, and the hash covers exactly that text plus a template
version you bump when the drawing changes:

```typescript {% title="app/services/social-cards/content.ts" %}
import type { CryptoError } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure, success } from "@sdxc/result";

import type { Post } from "~/app/models/post";

export interface CardContent {
	title: string;
	description: string;
	site: string;
}

export const CARD_SIZE = { width: 1200, height: 630 } as const;

const CARD_TEMPLATE = "1";

export function cardContent(post: Post): CardContent {
	return { title: post.title, description: post.excerpt, site: "example.com" };
}

export async function cardVersion(
	content: CardContent,
): Promise<Result<string, CryptoError>> {
	let input = [
		CARD_TEMPLATE,
		content.title,
		content.description,
		content.site,
	].join("\u0000");
	let digest = await sha256(input);
	if (isFailure(digest)) return digest;
	return success(Hex.encode(digest.data).slice(0, 16));
}

export function cardKey(version: string): string {
	return `cards/${version}.png`;
}
```

`Post` is your own model. Bump `CARD_TEMPLATE` when the drawing changes: every hash changes with
it, so every card is redrawn on its next request. 1200 by 630 is the size Open Graph consumers
display a large card at.

## Draw the card

`text` wraps at spaces to `maxWidth`, shrinks toward `minSize` until the text fits `maxLines`,
and ends the last line with `…` when it still does not, so a long title stays inside the card:

```typescript {% title="app/services/social-cards/draw.ts" %}
import type { Font } from "@sdxc/font";

import { Canvas, color, linearGradient } from "@sdxc/raster";

import type { CardContent } from "~/app/services/social-cards/content";

import { CARD_SIZE } from "~/app/services/social-cards/content";

export interface CardFonts {
	regular: Font;
	bold: Font;
}

const INK = color("#f5f5f7");
const MUTED = color("#a1a1aa");
const LEFT = 80;
const TEXT_WIDTH = 1040;

export async function drawCard(
	content: CardContent,
	fonts: CardFonts,
): Promise<Uint8Array> {
	let { width, height } = CARD_SIZE;
	let canvas = new Canvas(width, height);

	canvas.fillRect(
		0,
		0,
		width,
		height,
		linearGradient({
			from: [0, 0],
			to: [0, height],
			stops: [
				[0, color("#111827")],
				[1, color("#030712")],
			],
		}),
	);
	let title = canvas.text(content.title, {
		font: fonts.bold,
		size: 72,
		minSize: 48,
		maxLines: 3,
		maxWidth: TEXT_WIDTH,
		tracking: -2,
		lineHeight: 1.1,
		x: LEFT,
		y: 200,
		paint: INK,
	});

	canvas.text(content.description, {
		font: fonts.regular,
		size: 30,
		maxLines: 2,
		maxWidth: TEXT_WIDTH,
		lineHeight: 1.4,
		x: LEFT,
		y: 200 + title.height + 40,
		paint: MUTED,
	});

	canvas.text(content.site, {
		font: fonts.bold,
		size: 28,
		x: LEFT,
		y: 558,
		paint: INK,
	});

	return canvas.toPNG();
}
```

`y` is the baseline of the first line, and `text` answers with the `height` it drew, which is
where the description starts.

> [!NOTE]
> Drawing a card takes tens of milliseconds of CPU, which counts against the Worker's CPU limit
> on every request that draws. That is why each card is drawn once and stored.

## Store cards in R2

Declare a bucket for the cards in your Worker's configuration:

```jsonc {% title="wrangler.jsonc" %}
{
	"r2_buckets": [{ "binding": "SOCIAL_CARDS", "bucket_name": "social-cards" }],
}
```

and open it as a `FileStorage`, the interface `remix/file-storage` defines:

```typescript {% title="app/models/social-cards.ts" %}
import type { FileStorage } from "remix/file-storage";

import { R2FileStorage } from "@sdxc/file-storage-r2";
import { env } from "cloudflare:workers";

export function socialCards(): FileStorage {
	return new R2FileStorage(env.SOCIAL_CARDS);
}
```

A key's name is its content, so a bucket lifecycle rule that deletes objects after 90 days is
safe: a removed card is drawn again the next time someone asks for it.

## Serve the card at the page's address

Add the card next to the page in the route table. A pattern variable stops at a `.`, so
`:slug.png` matches `/blog/hello.png` and leaves `/blog/hello` to the page:

```typescript {% title="routes/web.ts" %}
import { get, route } from "remix/routes";

export default route({
	post: get("/blog/:slug"),
	postCard: get("/blog/:slug.png"),
});
```

The action reads the bucket, then draws. It imports the drawing code and the fonts only when it
is about to draw, so the requests R2 answers never load them:

```typescript {% title="app/http/controllers/post-card.ts" %}
import { notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import { waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Posts from "~/app/models/post";
import { socialCards } from "~/app/models/social-cards";
import {
	cardContent,
	cardKey,
	cardVersion,
} from "~/app/services/social-cards/content";
import routes from "~/routes/web";

const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "public, max-age=3600";

export default createAction(routes.postCard, async (ctx) => {
	let respond = (card: File, cacheControl: string) =>
		new Response(card.stream(), {
			headers: {
				"Content-Type": "image/png",
				"Content-Length": String(card.size),
				"Cache-Control": cacheControl,
			},
		});

	let storage = socialCards();
	let version = ctx.url.searchParams.get("v");
	if (version !== null && /^[0-9a-f]{16}$/.test(version)) {
		let stored = await storage.get(cardKey(version));
		if (stored) return respond(stored, IMMUTABLE);
	}

	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let post = await Posts.find(ctx.db, slug);
	if (post === null) return notFound("Not Found");

	let content = cardContent(post);
	let hash = await cardVersion(content);
	if (isFailure(hash)) {
		ctx.log.fail(hash.error, { slug });
		return new Response("The card could not be named", { status: 500 });
	}

	let key = cardKey(hash.data);
	let cacheControl = version === hash.data ? IMMUTABLE : REVALIDATE;
	let stored = await storage.get(key);
	if (stored) return respond(stored, cacheControl);

	let [{ cardFonts }, { drawCard }] = await Promise.all([
		import("~/app/initializers/card-fonts"),
		import("~/app/services/social-cards/draw"),
	]);
	let fonts = cardFonts();
	if (isFailure(fonts)) {
		ctx.log.fail(fonts.error, { slug, table: fonts.error.table ?? null });
		return new Response("The card's fonts could not be read", { status: 500 });
	}

	let bytes = await drawCard(content, fonts.data);
	let card = new File([bytes.slice()], `${hash.data}.png`, { type: "image/png" });
	waitUntil(storage.set(key, card));
	return respond(card, cacheControl);
});
```

A `v` that names a stored card is answered from R2 without reading the post. A request without
`v`, or with a stale one, renders from the post as it is now and is cached for an hour. The R2
write runs in `waitUntil`, after the response has gone out.

## Advertise the card

The page names its card in its head. Compute the same version the card route computes, and pass
the absolute URL with its size to the `Seo` component from
[SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots):

```typescript {% title="app/services/social-cards/meta.ts" %}
import type { Seo } from "@sdxc/seo";

import { isFailure } from "@sdxc/result";

import type { Post } from "~/app/models/post";

import { seo } from "~/app/initializers/seo";
import {
	CARD_SIZE,
	cardContent,
	cardVersion,
} from "~/app/services/social-cards/content";
import routes from "~/routes/web";

export async function postCardMeta(post: Post): Promise<Seo.OpenGraph> {
	let version = await cardVersion(cardContent(post));
	if (isFailure(version)) return { type: "article" };

	let path = routes.postCard.href({ slug: post.slug });
	return {
		type: "article",
		image: seo.absolute(`${path}?v=${version.data}`),
		imageAlt: post.title,
		imageWidth: CARD_SIZE.width,
		imageHeight: CARD_SIZE.height,
	};
}
```

In the post's action, `og: await postCardMeta(post)` goes into the `Seo.Props` it renders. The
width and height let a platform lay out the preview before it fetches the image, and the URL
changes with the text, so an edit needs no purge.

## Test the card

A test reads the fonts from disk, draws a card with a title too long for three lines, and
decodes the PNG to check its size; a second checks that the hash follows the text:

```typescript {% title="app/services/social-cards/draw.test.ts" %}
import { parseFont } from "@sdxc/font";
import { decode } from "@sdxc/png";
import { unwrap } from "@sdxc/result";
import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { cardVersion } from "~/app/services/social-cards/content";
import { drawCard } from "~/app/services/social-cards/draw";

const CONTENT = {
	title: "A title long enough to wrap, shrink and still end with an ellipsis ".repeat(
		3,
	),
	description: "The post's excerpt.",
	site: "example.com",
};

async function font(name: string) {
	let path = new URL(`../../../resources/fonts/${name}.ttf.bin`, import.meta.url);
	return unwrap(parseFont(await readFile(path)));
}

test("draws a 1200 by 630 card", async () => {
	let fonts = {
		regular: await font("inter-regular"),
		bold: await font("inter-bold"),
	};

	let image = unwrap(await decode(await drawCard(CONTENT, fonts)));

	expect([image.width, image.height]).toEqual([1200, 630]);
});

test("names a card by its text", async () => {
	let version = unwrap(await cardVersion(CONTENT));

	expect(version).toMatch(/^[0-9a-f]{16}$/);
	expect(unwrap(await cardVersion(CONTENT))).toBe(version);
	expect(unwrap(await cardVersion({ ...CONTENT, title: "Edited" }))).not.toBe(
		version,
	);
});
```

## Where to go next

- [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots) — the rest
  of the head tags and the `seo` instance used here.
- [Draw charts as PNG images](/docs/content-and-feeds/png-charts) — the same canvas for
  data, where SVG cannot go.
- [`@sdxc/raster`](/api/raster) — every drawing call and text option.
