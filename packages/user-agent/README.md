# @sdxc/user-agent

Read a `User-Agent` string into its browser, engine, operating system and device.

## Installation

```bash
npm add @sdxc/user-agent
```

## Usage

### Read A Request's User Agent

```typescript
import { parse } from "@sdxc/user-agent";

let ua = parse(request.headers.get("user-agent") ?? "");

ua.browser; // { name: "Safari", version: "17.4" }
ua.engine; // { name: "WebKit", version: "605.1.15" }
ua.os; // { name: "iOS", version: "17.4" }
ua.device; // { type: "mobile", vendor: "Apple", model: "iPhone" }
```

Every field is `string | null`, so a crawler, a script or an empty header reads as a
shape with the same keys and nothing in them.

### Read It Once Per Request

```typescript
import { userAgent } from "@sdxc/user-agent/middleware";

let router = createRouter({ middleware: [userAgent()] });

router.get("/download", (ctx) => {
	ctx.userAgent.os.name; // "macOS"
	ctx.userAgent.device.type; // "desktop"
});
```

The middleware reads the header once and publishes the result as `ctx.userAgent`, typed in
every project that installs it. A surface reached before it runs — a router without it, a
job, a script — reads the same shape with nothing in it, so a handler asks the same
questions wherever it sits.

### Ask A Question Of It

```typescript
import { isApplePlatform, isTouch } from "@sdxc/user-agent/helpers";

router.get("/", (ctx) => {
	isTouch(); // the current request
	isTouch(ctx); // a request context
	isTouch(parse(header)); // a user agent already read
});
```

The no-argument form is the one to reach for: it reads the current request through the
`asyncContext()` middleware, so a component deep inside a render asks without being handed
anything. A call stack outside a request — a script, a job, a router that installs neither
middleware — reads the unknown agent, and every predicate answers `false`.

### Branch On The Form Factor

```typescript
let { device } = parse(userAgent);

let isHandheld = device.type === "mobile" || device.type === "tablet";
```

`type` is one of `"mobile"`, `"tablet"`, `"desktop"`, `"tv"` and `"console"`, and `null`
when the string carries no evidence of a form factor.

### Compare A Browser Version

```typescript
let { browser } = parse(userAgent);

let major = Number.parseInt(browser.version ?? "", 10);
let supportsPasskeys = browser.name === "Safari" && major >= 16;
```

Browser versions are reported as the string spells them — `"17.4"`, `"122.0.6261.89"` —
because a browser numbers its releases however it likes.

### Switch Over A Name

```typescript
import type { OperatingSystemName } from "@sdxc/user-agent";

function iconFor(name: OperatingSystemName | null) {
	switch (name) {
		case "iOS":
		case "iPadOS":
		case "macOS":
			return "apple";
		case "Android":
			return "android";
		default:
			return "generic";
	}
}
```

Each name is a union of the values the rules can produce, so an editor lists them and a
`switch` over them is exhaustive.

## API

### `parse(userAgent: string): UserAgent`

Reads a user agent string into the browser, engine, operating system and device it
describes. It answers for the parts it recognizes and leaves the rest `null`, so it never
throws and never rejects a string.

### `isBot(header: string): boolean`

Whether the header names automated software: a search crawler, a link-preview fetcher such
as `facebookexternalhit`, `Slackbot` or `WhatsApp`, an uptime monitor, a headless browser or
an HTTP library such as `curl`. An empty header counts as a bot, since every browser sends
one. A crawler parses as all-`null`, so this is the question `parse` leaves open.

```typescript
import { isBot } from "@sdxc/user-agent";

if (!isBot(request.headers.get("user-agent") ?? "")) session.set("visited", true);
```

### `userAgent(): Middleware`

From `@sdxc/user-agent/middleware`. Reads the request's `User-Agent` header and exposes it
as `ctx.userAgent`. The module augments the router's request context, so installing the
middleware is all it takes for `ctx.userAgent` to be typed.

### `CurrentUserAgent`

The context key the middleware writes to, for a caller that reads by key rather than
through the property: `ctx.get(CurrentUserAgent)`. Its default is a parsed shape with every
field `null`, which is what a context the middleware never touched answers with.

### Predicates

From `@sdxc/user-agent/helpers`. Each takes one optional argument — a `UserAgent`, a
request context, or nothing for the current request — and returns a boolean.

- `isApplePlatform()` — macOS, iOS or iPadOS.
- `isAndroid()` — Android, phones and tablets alike.
- `isMobile()` — a phone.
- `isTablet()` — a tablet.
- `isDesktop()` — a computer. An iPad asked for the desktop site sends the string a Mac
  sends, and answers here as a desktop.
- `isTouch()` — a phone or a tablet, which is what decides between a pointer-sized and a
  finger-sized target.

### Types

#### `UserAgent`

```typescript
interface UserAgent {
	browser: Browser;
	engine: Engine;
	os: OperatingSystem;
	device: Device;
}
```

#### `Browser`

`{ name: BrowserName | null; version: string | null }`. A browser built on another's
engine reports itself, so Edge, Opera, Vivaldi, Samsung Internet, Yandex Browser, UC
Browser, DuckDuckGo and Silk are named rather than folded into Chrome, and the iOS
spellings of Chrome, Firefox and Edge are named as those browsers.

#### `Engine`

`{ name: EngineName | null; version: string | null }` — `"Blink"`, `"WebKit"`, `"Gecko"`,
`"EdgeHTML"`, `"Presto"` or `"Trident"`. Apple's platform requires every browser to render
through WebKit, so a Chrome on an iPhone reports `Chrome` as its browser and `WebKit` as
its engine. Blink and WebKit report the WebKit build number, which is the only version
those strings carry.

#### `OperatingSystem`

`{ name: OperatingSystemName | null; version: string | null }`, in the platform's own
numbering. Windows is named by its marketing version, and Windows 11 reports the same
`NT 10.0` its predecessor does, so it reads as `"10"`. Safari freezes the macOS version it
reports at `10_15_7`, while a Chromium browser on the same machine reports the real
release. A tablet reads as `"iPadOS"` from version 13, which is where Apple split that
system off, and as `"iOS"` before it.

#### `Device`

`{ type: DeviceType | null; vendor: DeviceVendor | null; model: string | null }`. Apple
hardware names its model in the platform token. An Android build discloses its model in
the platform section, and recent Chromium versions send the placeholder `K` there instead,
which reads as no model. An iPad asked for the desktop site sends the string a Mac sends,
which reads as a desktop Mac.

#### `BrowserName`, `EngineName`, `OperatingSystemName`, `DeviceType`, `DeviceVendor`

String unions of the values each field can hold. Anything outside the union is reported as
`null`, so a name that comes back is one of these.

## Pattern: Naming A Device A Person Will Recognize

A credential list, a session list and a login notification all need one short line naming
where a request came from. The model is the most recognizable thing a string offers, then
the browser and the system together:

```typescript
import { parse } from "@sdxc/user-agent";

export function describe(userAgent: string): string {
	let { browser, os, device } = parse(userAgent);

	if (device.model) return device.model;
	if (browser.name && os.name) return `${browser.name} on ${os.name}`;

	return browser.name ?? os.name ?? "Unknown device";
}

describe(chromeOnAPixel); // "Pixel 8"
describe(safariOnAMac); // "Safari on macOS"
```

## Pattern: Serving A Platform's Own Download

A download page picks the build that matches the visitor, and offers the rest below it:

```typescript
import { parse } from "@sdxc/user-agent";

export function suggestedBuild(userAgent: string) {
	let { os, device } = parse(userAgent);

	if (os.name === "iOS" || os.name === "iPadOS") return "app-store";
	if (os.name === "Android") return "play-store";
	if (device.type === "desktop" && os.name === "macOS") return "macos-dmg";
	if (device.type === "desktop" && os.name === "Windows") return "windows-exe";

	return null;
}
```

A `null` means the string gave no answer, which is the case to fall back on rather than
guess through.

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
