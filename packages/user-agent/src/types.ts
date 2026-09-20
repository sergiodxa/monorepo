/**
 * The shapes a read user agent comes back as: the browser, its engine, the
 * operating system and the device, each with the closed set of names this
 * package can recognize.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The browsers with a rule of their own; anything else reads as `null`. */
export type BrowserName =
	| "Chrome"
	| "Chromium"
	| "DuckDuckGo"
	| "Edge"
	| "Firefox"
	| "Internet Explorer"
	| "Opera"
	| "Safari"
	| "Samsung Internet"
	| "Silk"
	| "UC Browser"
	| "Vivaldi"
	| "Yandex Browser";

/** The rendering engines with a rule of their own; anything else reads as `null`. */
export type EngineName = "Blink" | "EdgeHTML" | "Gecko" | "Presto" | "Trident" | "WebKit";

/** The operating systems with a rule of their own; anything else reads as `null`. */
export type OperatingSystemName =
	| "Android"
	| "Chrome OS"
	| "Linux"
	| "Windows"
	| "Windows Phone"
	| "iOS"
	| "iPadOS"
	| "macOS";

/** What the user agent is running on, as far as the string gives it away. */
export type DeviceType = "console" | "desktop" | "mobile" | "tablet" | "tv";

/** The manufacturers a model name identifies; anything else reads as `null`. */
export type DeviceVendor =
	| "Amazon"
	| "Apple"
	| "Google"
	| "HTC"
	| "Huawei"
	| "LG"
	| "Microsoft"
	| "Motorola"
	| "Nintendo"
	| "Nokia"
	| "OnePlus"
	| "Samsung"
	| "Sony"
	| "Xiaomi";

/**
 * The browser and the version it reports, both `null` when no rule claims the
 * string. A browser built on another's engine reports itself, so an in-app
 * Chrome on iOS is `Chrome` even though WebKit renders it.
 */
export interface Browser {
	name: BrowserName | null;
	/** The dot-separated version as the string spells it, e.g. `"120.0.6099.109"`. */
	version: string | null;
}

/**
 * The engine doing the rendering and the version beside it. The version is the
 * engine's own where the string carries one and the WebKit build number on the
 * Blink and WebKit families, which report no other.
 */
export interface Engine {
	name: EngineName | null;
	version: string | null;
}

/**
 * The operating system and its version, in the platform's own numbering —
 * `"17.4"` for iOS, `"10"` for Windows, `"14.6"` for Android.
 */
export interface OperatingSystem {
	name: OperatingSystemName | null;
	version: string | null;
}

/**
 * The hardware, to the precision the string allows: a type wherever there is
 * evidence for one, and the vendor and model where the string names them.
 */
export interface Device {
	type: DeviceType | null;
	vendor: DeviceVendor | null;
	/** The marketing or model name, e.g. `"iPhone"`, `"Pixel 8"`, `"SM-G991B"`. */
	model: string | null;
}

/** Everything one user agent string gives up, each part read independently. */
export interface UserAgent {
	browser: Browser;
	engine: Engine;
	os: OperatingSystem;
	device: Device;
}
