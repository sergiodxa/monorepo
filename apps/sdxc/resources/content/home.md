<hero>
<split>
<split-copy>

# sdxc

Take one, or take the set. There are {% $packageCount %} of them, written for Remix on
Cloudflare Workers: `Request` and `Response` in, typed values out.

<actions cta-href="/docs" cta-label="Read the docs" alt-href="/api" alt-label="Browse the API" />

<install-command command="npm add @sdxc/result" />

</split-copy>
<split-media>

```typescript {% title="app/routes/frontmatter.ts" %}
import { Markdown } from "@sdxc/markdown";
import { badRequest, ok } from "@sdxc/response";
import { isFailure } from "@sdxc/result";

export async function handler(request: Request) {
	let result = Markdown.parse(await request.text(), {
		frontmatter: Frontmatter,
	});

	if (isFailure(result)) {
		let line = result.error.position?.start.line;
		return badRequest({ line });
	}

	return ok(result.data.frontmatter);
}
```

</split-media>
</split>
</hero>

<stats>
<stat label="packages under one scope">{% $packageCount %}</stat>
<stat label="RFCs the packages follow">{% $rfcCount %}</stat>
<stat label="components in @sdxc/ui">{% $componentCount %}</stat>
<stat label="styling utilities in @sdxc/u">{% $utilityCount %}</stat>
<stat label="apps running on them">{% $applicationCount %}</stat>
</stats>

<section-block id="thesis" title="Everything between the Request and the Response." align="center">

Validation, auth, caching, jobs, feeds and the UI on top: {% $packageCount %} packages that
already agree on how to fail, so the tenth one you install reads like the first.

</section-block>

<section-block id="the-set" tone="tinted">
<split>
<split-copy>

## Packages that agree with each other

Every package answers the same way, so the second one you pick up already reads like the
first. The handler above composes three of them and never throws.

- `Request` and `Response` in and out, never a framework's own objects
- Every fallible entry point answers with a `Result`
- Standard Schema at every boundary that reads untrusted input
- Subpath exports, so what you skip stays out of the bundle

<actions cta-href="/docs/conventions/result-everywhere" cta-label="Read the conventions" size="sm" />

</split-copy>
<split-media>

<code-tabs>
<code-tab label="Forms" selected>

```typescript {% title="app/controllers/board.ts" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

export default createAction(routes.board.create, async (ctx) => {
	let form = await validate(ctx.formData, PostingSchema);
	if (isFailure(form)) return renderBoard(ctx, form.error);

	let posting = await Job.publish(ctx.db, form.data);
	await cache.delete(LISTING_KEY);
	await ctx.jobs.enqueue(jobs.confirm, { id: posting.id });

	ctx.log.set({ posting: { id: posting.id } });
	return redirect(routes.board.index.href(), { status: 303 });
});
```

</code-tab>

<code-tab label="Cache">

```typescript {% title="app/mcp/cache.ts" %}
import type { ToolMiddleware } from "@sdxc/mcp";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isSuccess } from "@sdxc/result";

export function cacheToolResults(): ToolMiddleware {
	return async (ctx, next) => {
		let key = await keyFor(ctx.tool.name, ctx.input);
		if (key === null) return next();

		let cache = new WorkerKVCache(env.CACHE, { waitUntil });
		let hit = await cache.read<CallToolResult>(key);
		if (isSuccess(hit) && hit.data !== null) return hit.data;

		let result = await next();
		if (!result.isError) {
			await cache.write(key, result, { ttl: "5 minutes" });
		}
		return result;
	};
}
```

</code-tab>

<code-tab label="Jobs">

```typescript {% title="app/jobs/send-confirmation.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

export default createJobHandler(jobs.confirm, async (ctx) => {
	let posting = await Job.find(ctx.database, ctx.input.id);
	if (!posting) return ctx.log.note("posting.missing");

	let sent = await mailer.send(new PublishedEmail(posting));
	if (isFailure(sent)) return ctx.log.fail(sent.error);

	ctx.log.set({ confirmation: { posting: posting.id } });
});
```

</code-tab>

<code-tab label="Auth">

```tsx {% title="app/controllers/auth.tsx" %}
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { Location } from "@sdxc/location";
import { isFailure, wrap } from "@sdxc/result";
import { createAction } from "remix/router";

export default createAction(routes.auth.callback, async (ctx) => {
	let party = relyingParty(ctx.url);
	let grant = await wrap(() => party.callback(contextOf(ctx)));
	if (isFailure(grant)) {
		return ctx.render(<LoginView error={grant.error} />);
	}

	let user = await User.fromProfile(ctx.db, grant.data.profile);
	ctx.log.set({ user: { id: user.id } }).note("auth.signed_in");

	let returnTo = Location.safe(grant.data.returnTo, {
		fallback: routes.dashboard.href(),
	});
	return redirect(returnTo, { status: 303 });
});
```

</code-tab>

<code-tab label="Webhooks">

```typescript {% title="app/webhooks/invoices.ts" %}
import { ok, unauthorized } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

let InvoiceEvent = s.object({
	type: s.string(),
	amount: s.number(),
});

export default createAction(routes.webhook, async (ctx) => {
	let delivery = await Webhooks.verify(ctx.request, {
		secret: env.WEBHOOK_SECRET,
		schema: InvoiceEvent,
	});
	if (isFailure(delivery)) {
		return unauthorized({ error: "invalid_signature" });
	}

	let { payload } = delivery.data;
	await ctx.jobs.enqueue(jobs.recordInvoice, payload);
	return ok({ received: true });
});
```

</code-tab>

<code-tab label="Feeds">

```typescript {% title="app/controllers/rss.ts" %}
import { xml } from "@sdxc/http/response";
import { RSS } from "@sdxc/rss";
import { links } from "@sdxc/websub/publisher";
import { createAction } from "remix/router";

export default createAction(routes.rss, async (ctx) => {
	let self = new URL("/rss.xml", ctx.url).href;
	let rss = new RSS({
		title: "Articles",
		description: "Everything published here.",
		link: new URL("/articles", ctx.url).href,
		atomLink: [
			{ rel: "self", href: self },
			{ rel: "hub", href: HUB },
		],
	});

	for (let article of await Article.published(ctx.db)) {
		rss.addItem({
			guid: article.id,
			title: article.title,
			description: article.excerpt,
			link: article.url,
			pubDate: article.publishedAt.toUTCString(),
		});
	}

	let headers = { link: links({ hubs: [HUB], self }) };
	return xml(rss.toString(), { headers });
});
```

</code-tab>

<code-tab label="Rate limits">

```typescript {% title="app/services/rate-limit.ts" %}
import type { Adapter } from "@sdxc/rate-limit";

import { toSeconds } from "@sdxc/duration";
import { tooManyRequests } from "@sdxc/http/response/json";
import { currentLog } from "@sdxc/logger";
import { applyRateLimitHeaders } from "@sdxc/rate-limit";
import { isFailure } from "@sdxc/result";

export async function spend(adapter: Adapter, key: string) {
	let result = await adapter.consume(key);
	if (isFailure(result)) {
		currentLog()?.warn("rate_limit.unavailable", { key });
		return null;
	}
	if (result.data.allowed) return null;

	let response = applyRateLimitHeaders(
		tooManyRequests({ error: "rate_limited" }),
		result.data,
		adapter.window,
	);
	let retryAfter = String(toSeconds(adapter.window));
	response.headers.set("Retry-After", retryAfter);
	return response;
}
```

</code-tab>
</code-tabs>

</split-media>
</split>
</section-block>

<section-block id="properties" eyebrow="Principles" title="What holds the set together">

<feature-grid columns="2">
<feature title="Web standards first" icon="globe" href="/docs/getting-started/what-these-are" link-label="What these are">
`Request`, `Response`, Web Crypto, `Intl` and Standard Schema — the platform, not a shim over it.
</feature>

<feature title="Errors are values" icon="shield" href="/docs/conventions/result-everywhere" link-label="Result everywhere">
Every fallible entry point answers with a **`Result`**, so nothing throws past you and the
failure carries where it happened.
</feature>

<feature title="Nothing you didn't ask for" icon="package" href="/docs/conventions/subpath-exports" link-label="Subpath exports">
Subpath exports keep what you skip out of your bundle, and {% $standaloneCount %} packages pull
in nothing from outside the collection at all.
</feature>

<feature title="Built for Remix, not bound to it" icon="zap" href="/docs/getting-started/your-first-handler" link-label="Your first handler">
{% $remixCount %} target Remix directly, because that is what they are written for. The other
{% $frameworkFreeCount %} depend on no framework and run anywhere `fetch` does.
</feature>
</feature-grid>
</section-block>

<section-block id="packages" eyebrow="Packages" title="The packages, by the problem they solve" tone="tinted">

<package-groups source="registry" />
</section-block>

<section-block id="detour">
<split>
<split-copy>

## Three worth the detour

Each of these does something you cannot get by reaching for another package: specs you can
run, components that work before any JavaScript loads, and a markdown parser this very page
is rendered through.

- `@sdxc/spec` runs specifications under permissions you grant by name
- `@sdxc/ui` builds on `<dialog>`, the Popover API and Invoker Commands
- `@sdxc/markdown` gives you a typed tree to walk, transform and write back

<actions cta-href="/api/ui" cta-label="Browse the components" size="sm" />

</split-copy>
<split-media>

<code-tabs>
<code-tab label="@sdxc/spec" selected>

```text {% title="spec/greeting.spec" %}
use fs
use cli

test "the script prints its greeting" {
	given {
		write "index.js" "console.log(\"hello from the workspace\")"
	}
	when {
		let result = run "node" "index.js"
	}
	then {
		expect result.exit_code 0
		expect result.stdout "hello from the workspace\n"
	}
}
```

</code-tab>

<code-tab label="@sdxc/ui">

```tsx {% title="invite-teammate.tsx" %}
import { Button, Dialog, TextField } from "@sdxc/ui";

<Button commandfor="invite" command="show-modal">
	Invite a teammate
</Button>

<Dialog id="invite" aria-labelledby="invite-title">
	<form method="post" action="/team/invites">
		<Dialog.Header>
			<Dialog.Title id="invite-title">
				Invite a teammate
			</Dialog.Title>
			<Dialog.Description>
				They get an email with a link to join.
			</Dialog.Description>
		</Dialog.Header>

		<TextField
			label="Email"
			type="email"
			name="email"
			required
		/>

		<Dialog.Footer>
			<Button
				type="button"
				commandfor="invite"
				command="close"
				variant="outline"
			>
				Cancel
			</Button>
			<Button type="submit">Send invite</Button>
		</Dialog.Footer>
	</form>
</Dialog>;
```

</code-tab>

<code-tab label="@sdxc/markdown">

```typescript {% title="app/posts/render.ts" %}
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

let Frontmatter = s.object({
	title: s.string(),
	publishedAt: coerce.date(),
});

let parsed = Markdown.parse(source, { frontmatter: Frontmatter });
if (isFailure(parsed)) return parsed;

let walked = Markdown.walk(parsed.data.document, {
	...highlight,
	link(node) {
		if (!node.href.startsWith("/")) return;
		return { ...node, href: new URL(node.href, origin).href };
	},
});
if (isFailure(walked)) return walked;

return { ...parsed.data.frontmatter, html: toHTML(walked.data) };
```

</code-tab>
</code-tabs>

</split-media>
</split>
</section-block>

<section-block id="install" tone="tinted">
<split>
<split-copy>

## Versions are dates

A release published on the 21st of September 2026 is `2026.9.21`. There is at most one a day,
and a later date means a later release and nothing more: it promises no compatibility with the
one before it.

So pin exactly, and move when you are ready to read what changed.

<actions cta-href="/docs/releases/versioning" cta-label="How versioning works" size="sm" />

</split-copy>
<split-media>

```json {% title="package.json" %}
{
	"dependencies": {
		"@sdxc/result": "2026.9.21"
	}
}
```

<note kind="caution">
A range such as `^2026.9.21` reads as "any release this year", which is not what you want from a
scheme where the number carries no compatibility meaning.
</note>

</split-media>
</split>
</section-block>

<section-block id="start" title="Take one, or take the set." tone="grid" align="center">

Start with the guides, or go straight to the package you came for.

<actions cta-href="/docs/getting-started/install-and-pin" cta-label="Install your first package" alt-href="https://github.com/sergiodxa/monorepo" alt-label="Read the source" />
</section-block>
