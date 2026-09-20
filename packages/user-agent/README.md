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
