---
title: Read the visitor's browser and device
description: Parse the User-Agent header once per request, pick a download for the visitor's system, ask platform questions from any view, name devices in a session list and keep bots out of your counts.
section:
    title: Building Remix apps
    order: 4
order: 16
lastUpdated: 2026-10-30
outcomes:
    - "How to parse the `User-Agent` header once per request and read it as `ctx.userAgent`"
    - "How to ask platform questions such as `isTouch()` from any view without passing the context"
    - "How to name a device in a session list and keep crawlers out of your counts"
---

A download page that offers the Mac build to a Mac, a hint that prints `⌘K` or `Ctrl K`, a
session list that says "Pixel 8" instead of a 150-character string, a page-view counter that
skips crawlers: each needs the same few answers from the `User-Agent` header. This guide reads
them with [`@sdxc/user-agent`](/api/user-agent): `parse` turns the header into a browser,
engine, operating system and device, the middleware does it once per request, and the helpers
answer yes-or-no questions from anywhere in the render.

```bash
npm add @sdxc/user-agent remix
```

## Parse it once per request

Add `asyncContext()` and `userAgent()` to the router's global chain. `userAgent()` parses the
header and publishes the result as `ctx.userAgent`; `asyncContext()` lets the helpers find the
current request on their own later.

```tsx {% title="app/initializers/router.tsx" %}
import { userAgent } from "@sdxc/user-agent/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";

export function createWebRouter() {
	let router = createRouter({
		middleware: [
			asyncContext(),
			userAgent(),
			// …then cop(), formData() and a renderer
		],
		defaultHandler,
	});
	// router.map(…) for each route
	return router;
}
```

Importing the middleware module types `ctx.userAgent` on every request context. It always has
the same shape: every field is a string or `null`, and a part the header does not reveal reads
as `null`. An empty header and a crawler come back as all-`null`, so code reading a field
decides what `null` means rather than guarding against a missing object.

## Offer the visitor's own download

A download page leads with the build for the visitor's system and lists every build below it.
`os.name` is a union of every system the parser knows, so a `switch` over it is checked by the
compiler, and `default` covers the `null` case where the page leads with nothing.

```tsx {% title="app/http/controllers/download.tsx" %}
import type { OperatingSystemName } from "@sdxc/user-agent";

import { createAction } from "remix/router";

import { DownloadPage } from "~/resources/views/download";
import routes from "~/routes/web";

type Build = "app-store" | "play-store" | "macos-dmg" | "windows-exe";

function buildFor(os: OperatingSystemName | null): Build | null {
	switch (os) {
		case "iOS":
		case "iPadOS":
			return "app-store";
		case "Android":
			return "play-store";
		case "macOS":
			return "macos-dmg";
		case "Windows":
			return "windows-exe";
		default:
			return null;
	}
}

export default createAction(routes.download, (ctx) => {
	let suggested = buildFor(ctx.userAgent.os.name);
	return ctx.render(<DownloadPage suggested={suggested} />);
});
```

> [!NOTE]
> An iPad that asks for the desktop site sends a Mac's header, so it reads as `macOS` and a
> desktop. Keep every build one click away for that reason.

## Ask from any view

`@sdxc/user-agent/helpers` answers the questions a view asks most: `isApplePlatform()`,
`isAndroid()`, `isMobile()`, `isTablet()`, `isDesktop()` and `isTouch()`. Called with no
argument, each reads the current request through `asyncContext()`, so a component deep in the
page asks without the context being passed down to it:

```tsx {% title="resources/components/search-hint.tsx" %}
import type { Handle } from "remix/component";

import { isApplePlatform, isTouch } from "@sdxc/user-agent/helpers";

export function SearchHint(_handle: Handle) {
	return () => {
		if (isTouch()) return null;
		return <kbd>{isApplePlatform() ? "⌘K" : "Ctrl K"}</kbd>;
	};
}
```

Outside a request, in a test or a job, a helper reads the all-`null` shape and answers `false`.
The same helpers take a request context (`isTouch(ctx)`) or a parsed value
(`isTouch(parse(header))`) when you have one at hand.

> [!TIP]
> An island hydrated in the browser has no request to read. Ask on the server and pass the
> answer as a prop, so the first paint and the hydrated island agree.

## Name the device in a session list

A list of signed-in sessions, or the email that says "a new sign-in from…", needs one short
line a person recognizes. Use the device model when the header names one, otherwise the browser
and the system together:

```typescript {% title="app/services/sessions/describe-device.ts" %}
import type { UserAgent } from "@sdxc/user-agent";

export function describeDevice({ browser, os, device }: UserAgent): string {
	if (device.model) return device.model;
	if (browser.name && os.name) return `${browser.name} on ${os.name}`;
	return browser.name ?? os.name ?? "Unknown device";
}
```

Call it when the session is created and store the line beside it, along with `ctx.userAgent.raw`
if you want the original header for support. A phone running Chrome reads as `"Pixel 8"`, a Mac
running Safari as `"Safari on macOS"`.

Versions stay in the spelling the header uses, and some are frozen by the browser itself:
Windows 11 reports `"10"`, and Safari reports every macOS release as `10.15.7`. Show a version
only where an approximate one is useful.

## Keep bots out of your counts

Crawlers, link-preview fetchers, uptime monitors and HTTP libraries parse as all-`null`, which
looks like an unknown browser. `isBot` names them, so a page-view counter or a session store
skips them:

```typescript {% title="app/http/middleware/count-views.ts" %}
import type { Middleware } from "remix/router";

import { isBot } from "@sdxc/user-agent";

import { PageViews } from "~/app/models/page-views";

export default function countViews(): Middleware {
	return async (ctx, next) => {
		if (!isBot(ctx.userAgent.raw)) {
			await PageViews.record(ctx.db, {
				path: ctx.url.pathname,
				browser: ctx.userAgent.browser.name,
				device: ctx.userAgent.device.type,
			});
		}
		return next();
	};
}
```

An empty header counts as a bot, since every browser sends one.

> [!WARNING]
> The header is whatever the caller chose to send. Use it to decide what a visitor sees first,
> and put anything that must stop abuse behind
> [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms).

## Test with the header a browser sends

The router parses whatever `User-Agent` the request carries, so one request per platform drives
each branch:

```typescript {% title="app/http/controllers/download.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const PIXEL =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

async function downloadPage(userAgent: string) {
	let url = new URL(routes.download.href(), "https://example.com");
	let response = await createWebRouter().fetch(
		new Request(url, { headers: { "User-Agent": userAgent } }),
	);
	return response.text();
}

test("leads with the visitor's own build", async () => {
	expect(await downloadPage(MAC)).toContain("macos-dmg");
	expect(await downloadPage(PIXEL)).toContain("play-store");
});
```

`toContain` checks whatever `DownloadPage` prints for the suggested build; match it to your
view's markup.

## Where to go next

- [Keyboard shortcuts](/docs/building-remix-apps/keyboard-shortcuts) — printing every key hint
  in the reader's own key caps.
- [Wire the router: middleware, context and services](/docs/building-remix-apps/wire-the-router)
  — where `asyncContext()` and `userAgent()` sit in the global chain.
- [`@sdxc/user-agent`](/api/user-agent) — every name, type and helper the package exports.
