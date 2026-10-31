<hero>
<split>
<split-copy>

# Six habits, kept for {% $packageCount %} packages

A collection is worth taking as a set only if the next package behaves like the last one. These
{% $packageCount %} were written one at a time, over a couple of years, and what makes them a
collection is not a shared build or a shared release — it is six habits that recur in every one of
them.

<actions cta-href="#failure-is-a-value" cta-label="Read the six habits" alt-href="/docs/conventions/result-everywhere" alt-label="Read the conventions" />

</split-copy>
<split-media>

<feature-grid columns="2">
<feature title="1. Failure is a value">
Nothing throws past you; every failure is a `Result`.
</feature>

<feature title="2. The platform is the baseline">
The runtime first, a dependency only when it falls short.
</feature>

<feature title="3. Implement the spec">
Where a standard exists, the package follows it.
</feature>

<feature title="4. One contract, adapters">
The vendor sits behind a driver you can swap, or fake.
</feature>

<feature title="5. Own the core">
Write what is load-bearing, depend only at the rim.
</feature>

<feature title="6. Framework-free core">
The Remix binding is an export you opt into.
</feature>
</feature-grid>

</split-media>
</split>
</hero>

<stats>
<stat label="packages that share the habits">{% $packageCount %}</stat>
<stat label="need nothing from outside the set">{% $standaloneCount %}</stat>
<stat label="depend on no framework">{% $frameworkFreeCount %}</stat>
<stat label="add an optional Remix binding">{% $remixCount %}</stat>
</stats>

<section-block id="failure-is-a-value">
<split>
<split-copy>

## 1. Failure is a value

Every fallible entry point answers with a `Result`. Parsing a document, reading a cache, verifying
a signature, sending a message — none of them throw past you, and each failure carries where it
happened, which for a parser means the line and column in the source you handed it.

The cost is real and it is paid at every call site: you check before you use. What it buys is that
the type signature stops lying. A function that says it returns a document returns a document, and
the ones that might not say so in the type rather than in a paragraph of prose nobody reads.

<actions cta-href="/docs/conventions/result-everywhere" cta-label="Result everywhere" alt-href="/api/result" alt-label="@sdxc/result" size="sm" />

</split-copy>
<split-media>

```typescript {% title="app/posts/parse.ts" %}
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

let parsed = Markdown.parse(source);
if (isFailure(parsed)) {
	let at = parsed.error.position?.start;
	ctx.log.fail(parsed.error, {
		line: at?.line,
		column: at?.column,
	});
	return renderError(parsed.error.message);
}

let { document } = parsed.data;
```

</split-media>
</split>
</section-block>

<section-block id="the-platform" tone="tinted">
<split>
<split-copy>

## 2. The platform is the baseline

`Request`, `Response`, Web Crypto, `Intl`, `<dialog>`, the Popover API, Invoker Commands. The
starting assumption is that the runtime already has the answer, and a dependency is what you reach
for once it demonstrably does not.

- Dates are formatted through `Intl` and nothing else
- The crypto primitives are Web Crypto with a smaller surface over them
- Caching is the HTTP specification's own semantics, not an invented policy object

Each of those had a well-known library available. Each of them would have shipped a second
implementation of something the runtime already does, and a second thing to keep current.

<actions cta-href="/docs/conventions/platform-first" cta-label="Platform first" size="sm" />

</split-copy>
<split-media>

```typescript {% title="app/posts/byline.ts" %}
import { formatDate, formatRelative } from "@sdxc/dates";

let publishedAt = new Date("2026-07-29T10:00:00Z");
let now = new Date("2026-08-01T10:00:00Z");
let locale = "en-US";
let timeZone = "America/New_York";

formatDate(publishedAt, { locale, timeZone });
// "Jul 29, 2026"

formatRelative(publishedAt, { locale, now });
// "3 days ago"
```

</split-media>
</split>
</section-block>

<section-block id="implement-the-spec">
<split>
<split-copy>

## 3. Implement the spec, don't invent one

Where a standard exists, follow it. The knowledge transfers, the data interoperates, and the
argument about what the right shape is has already been had by people with more context than a
single author has.

- Webhooks are Standard Webhooks
- Feature flags are OpenFeature
- Feeds are Atom and JSON Feed as published
- Sitemaps are the sitemaps protocol

</split-copy>
<split-media>

```typescript {% title="app/webhooks/invoices.ts" %}
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

let delivery = await Webhooks.verify(request, {
	secret: env.WEBHOOK_SECRET,
	schema: InvoiceEvent,
});
if (isFailure(delivery)) {
	return new Response(null, { status: 401 });
}

let { payload } = delivery.data;
```

> [!NOTE]
> A spec's field names are the spec's. They live in the serialized document and nowhere else: the
> package's own surface is camelCase, like everything you already write, and the translation happens
> where the bytes are read and written.

</split-media>
</split>
</section-block>

<section-block id="one-contract" tone="tinted">
<split>
<split-copy>

## 4. One contract, adapters at the edge

The shape recurs so often it is the easiest habit to spot: a vendor-neutral core, and the vendor
behind a driver you can swap, or fake.

- Mail has transports, and rate limiting has stores
- Billing has providers, and jobs have queue adapters
- Caching has a memory adapter and a Workers KV one

The point is not portability between vendors, which almost nobody actually exercises. It is that a
test runs the real code against an in-process adapter, so the thing under test is the thing you
deploy.

</split-copy>
<split-media>

<code-tabs>
<code-tab label="Contract" selected>

```typescript {% title="app/posts/published.ts" %}
import type { Cache } from "@sdxc/cache";

import { isFailure } from "@sdxc/result";

type Load = () => Promise<Post[]>;

export async function publishedPosts(cache: Cache, load: Load) {
	let posts = await cache.fetch("posts:published", load, {
		ttl: "5 minutes",
	});
	return isFailure(posts) ? [] : posts.data;
}
```

</code-tab>

<code-tab label="Workers KV">

```typescript {% title="app/initializers/cache.ts" %}
import { WorkerKVCache } from "@sdxc/cache/worker-kv";

let cache = new WorkerKVCache(env.CACHE, {
	waitUntil: ctx.waitUntil.bind(ctx),
});

await publishedPosts(cache, () => Post.published(db));
```

</code-tab>

<code-tab label="In a test">

```typescript {% title="app/posts/published.test.ts" %}
import { MemoryCache } from "@sdxc/cache/memory";

test("loads the posts once", async () => {
	let cache = new MemoryCache();
	let load = vi.fn(async () => [post]);

	await publishedPosts(cache, load);
	await publishedPosts(cache, load);

	expect(load).toHaveBeenCalledOnce();
});
```

</code-tab>
</code-tabs>

</split-media>
</split>
</section-block>

<section-block id="own-the-core">
<split>
<split-copy>

## 5. Own the core, depend at the rim

When a dependency would own something load-bearing — the parser your content pipeline is built on,
the code that decides what a signature means — write it instead. {% $standaloneCount %} of the
{% $packageCount %} pull in nothing from outside the collection.

- XML parsing and serialization, and syntax highlighting
- Frontmatter, YAML and markdown, the last of which parsed this page

The rim is where dependencies belong, and there are some: a JOSE implementation, a DOM, an
internationalization runtime. The test is whether replacing it later would be an afternoon or a
rewrite.

</split-copy>
<split-media>

```typescript {% title="app/docs/frontmatter.ts" %}
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";

let result = parse(`
title: API Keys
order: 3
tags: [remix, workers]
`);
if (isFailure(result)) return result;

result.data;
// { title: "API Keys", order: 3, tags: ["remix", "workers"] }
```

</split-media>
</split>
</section-block>

<section-block id="framework-free" tone="tinted">
<split>
<split-copy>

## 6. Framework-free core, Remix where it helps

Most of these packages are about the web platform, not a framework. {% $frameworkFreeCount %} of
the {% $packageCount %} depend on no framework at all and run anywhere `fetch` does: Cloudflare
Workers, where most of them are used, and Bun, Deno and Node as well.

The other {% $remixCount %} bind something to Remix — the middleware, the routing bindings, the
context integration — because Remix is what the apps built on them use.

The habit is about where that binding sits: the logic goes in a core that needs no framework, and
the binding is an export you opt into. The authentication core is independent of Remix and gets
its Remix surface as a subpath, and services reach a request through Remix's own request context
rather than a container of this collection's invention.

</split-copy>
<split-media>

<code-tabs>
<code-tab label="Any runtime" selected>

```typescript {% title="handler.ts" %}
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";

export async function handle(request: Request) {
	let parsed = Markdown.parse(await request.text());
	if (isFailure(parsed)) {
		return new Response(parsed.error.message, {
			status: 422,
		});
	}

	return new Response(toHTML(parsed.data.document), {
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}
```

</code-tab>

<code-tab label="With Remix">

```tsx {% title="app/controllers/post.tsx" %}
import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";

let parsed = Markdown.parse(post.body);
if (isFailure(parsed)) return renderError(parsed.error);

let body = toRemix(parsed.data.document, { components });
return ctx.render(<article>{body}</article>);
```

</code-tab>
</code-tabs>

</split-media>
</split>
</section-block>

<section-block id="reversals" eyebrow="Reversals" title="What was tried and undone" align="center">

The habits above are what survived. Some things did not. A service container was adopted here, and
eight workspaces took it up. It was removed three months later, once someone counted what it was
actually carrying: one service, almost everywhere, that the framework's own request context
already carries — with one mechanism instead of two.

That reversal is recorded rather than quietly dropped, and it is the more useful half of the
record. A set of habits is only evidence if it is not a highlight reel, so the decisions that were
taken back are written down beside the ones that held.

</section-block>

<current-sponsors />

<section-block id="decisions" title="Read the reasoning, then decide." tone="grid" align="center">

Each habit was argued out in a decision the repository still carries, in the open. A habit you can
read the reasoning for is one you can decide you disagree with.

<actions cta-href="/docs/conventions/result-everywhere" cta-label="Read the conventions" alt-href="https://github.com/sergiodxa/monorepo" alt-label="Read the source" />
</section-block>
