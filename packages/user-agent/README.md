# @sdxc/user-agent

Read a `User-Agent` string into its browser, engine, operating system and device.

## Installation

```sh
npm add @sdxc/user-agent
```

The `./middleware` and `./helpers` entry points plug into the router from
[`remix`](https://www.npmjs.com/package/remix).

## Usage

### Parse a header

```typescript
import { parse } from "@sdxc/user-agent";

let ua = parse(request.headers.get("user-agent") ?? "");

ua.browser; // { name: "Safari", version: "17.4" }
ua.engine; // { name: "WebKit", version: "605.1.15" }
ua.os; // { name: "iOS", version: "17.4" }
ua.device; // { type: "mobile", vendor: "Apple", model: "iPhone" }
```

Every field is `string | null`: a part the string does not reveal reads as `null`, so a crawler
or an empty header comes back as the same shape with nothing in it.

### Tell bots apart

```typescript
import { isBot } from "@sdxc/user-agent";

isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"); // true
isBot(""); // true
```

### Parse once per request

```typescript
import { userAgent } from "@sdxc/user-agent/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [userAgent()] });

router.get("/download", (ctx) => {
	ctx.userAgent.os.name; // "macOS"
	ctx.userAgent.device.type; // "desktop"
	return new Response("ok");
});
```

### Ask a question of it

```typescript
import { parse } from "@sdxc/user-agent";
import { isTouch } from "@sdxc/user-agent/helpers";

isTouch(); // the current request, through asyncContext()
isTouch(ctx); // a request context
isTouch(parse(header)); // a user agent already parsed
```

## API

### `parse(userAgent: string): UserAgent`

Reads the browser, engine, operating system and device a string describes. Each part is read on
its own, so a half-recognized string answers for the parts it reveals; it never throws.

### `isBot(header: string): boolean`

Whether the header names automated software: search and AI crawlers, link-preview fetchers
(`facebookexternalhit`, `Slackbot`, `WhatsApp`), uptime monitors, headless browsers and HTTP
libraries such as `curl`. An empty or blank header counts as a bot, since every browser sends one.

### `userAgent(): Middleware`

From `@sdxc/user-agent/middleware`. Parses the request's `User-Agent` header and publishes it as
`ctx.userAgent`, typed on every request context once the module is imported.

### `CurrentUserAgent`

From `@sdxc/user-agent/middleware`. The context key the middleware writes, read as
`ctx.get(CurrentUserAgent)`. Its default is the all-`null` shape, so a context the middleware never
touched still answers.

### Predicates

From `@sdxc/user-agent/helpers`. Each takes an optional `UserAgentSource` and returns a boolean.
With no argument it reads the current request through `asyncContext()` from
`remix/middleware/async-context`; outside a request it reads the all-`null` shape and answers
`false`.

- `isApplePlatform()`: macOS, iOS or iPadOS.
- `isAndroid()`: Android, phones and tablets alike.
- `isMobile()`: a phone.
- `isTablet()`: a tablet.
- `isDesktop()`: a computer, including an iPad that requested the desktop site.
- `isTouch()`: a phone or a tablet.

### Types

#### `UserAgent`

`{ browser: Browser; engine: Engine; os: OperatingSystem; device: Device }`.

#### `Browser`

`{ name: BrowserName | null; version: string | null }`, the version spelled as the string spells
it (`"122.0.6261.89"`). A browser built on another's engine names itself, so Edge, Opera, Samsung
Internet and the iOS builds of Chrome, Firefox and Edge are reported as those browsers.

#### `Engine`

`{ name: EngineName | null; version: string | null }`. Every iOS browser renders through WebKit,
so Chrome on an iPhone reports `Chrome` as its browser and `WebKit` as its engine. Blink and WebKit
report the WebKit build number.

#### `OperatingSystem`

`{ name: OperatingSystemName | null; version: string | null }`, in the platform's own numbering.
Windows 11 sends the same token as Windows 10 and reads as `"10"`; Safari reports macOS as
`10.15.7` whatever the real release; an iPad reads as `"iPadOS"` from version 13 and `"iOS"`
before it.

#### `Device`

`{ type: DeviceType | null; vendor: DeviceVendor | null; model: string | null }`. The model is
`"iPhone"`, `"Pixel 8"` or `"SM-G991B"` where the string names one, and `null` where Chromium
sends its `K` placeholder. An iPad that requested the desktop site reads as a desktop Mac.

#### `UserAgentSource`

From `@sdxc/user-agent/helpers`. A `UserAgent` or a request context the middleware has populated.

#### `BrowserName`, `EngineName`, `OperatingSystemName`, `DeviceType`, `DeviceVendor`

String unions of every value each field can hold, so a `switch` over a name is exhaustive.
`DeviceType` is `"mobile"`, `"tablet"`, `"desktop"`, `"tv"` or `"console"`.

## Pattern: Naming A Device A Person Will Recognize

A session list or a login notification needs one short line naming where a request came from:
the model when the string gives one, otherwise the browser and the system together.

```typescript
import { parse } from "@sdxc/user-agent";

export function describeDevice(header: string): string {
	let { browser, os, device } = parse(header);

	if (device.model) return device.model;
	if (browser.name && os.name) return `${browser.name} on ${os.name}`;

	return browser.name ?? os.name ?? "Unknown device";
}

describeDevice(chromeOnAPixel); // "Pixel 8"
describeDevice(safariOnAMac); // "Safari on macOS"
```

## Pattern: Serving A Platform's Own Download

A download page picks the build that matches the visitor and lists the rest below it. A `null`
means the string gave no answer, and the page shows every build.

```typescript
import type { OperatingSystemName } from "@sdxc/user-agent";

import { parse } from "@sdxc/user-agent";

function buildFor(name: OperatingSystemName | null) {
	switch (name) {
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

let suggested = buildFor(parse(request.headers.get("user-agent") ?? "").os.name);
```

## Pattern: Counting Only Human Visits

Crawlers and preview fetchers parse as all-`null`, so `isBot` is the check that keeps them out of
analytics and session storage.

```typescript
import { isBot } from "@sdxc/user-agent";
import { userAgent } from "@sdxc/user-agent/middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		userAgent(),
		async (ctx, next) => {
			if (!isBot(ctx.request.headers.get("user-agent") ?? "")) {
				await analytics.track(ctx.url.pathname, ctx.userAgent.browser.name);
			}
			return next();
		},
	],
});
```

## Pattern: Adapting A View Deep In A Render

With `asyncContext()` before `userAgent()`, a helper or component anywhere in the request asks
without being handed the context.

```typescript
import { isApplePlatform, isTouch } from "@sdxc/user-agent/helpers";
import { userAgent } from "@sdxc/user-agent/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [asyncContext(), userAgent()] });

export function searchShortcut() {
	if (isTouch()) return null;
	return isApplePlatform() ? "⌘K" : "Ctrl K";
}
```

## Pattern: Gating On A Browser Version

Versions stay strings, so compare the major number you parse from them.

```typescript
import { parse } from "@sdxc/user-agent";

let { browser } = parse(request.headers.get("user-agent") ?? "");

let major = Number.parseInt(browser.version ?? "", 10);
let needsPolyfill = browser.name === "Safari" && major < 16;
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/user-agent": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
