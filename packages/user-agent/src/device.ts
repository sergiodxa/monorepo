/**
 * What the request came from: a type wherever the string carries evidence of
 * one, plus the vendor and model where it names them. Phones and tablets say so
 * explicitly, while a desktop is only ever implied by the system it runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Device, DeviceVendor } from "./types.js";

/** A vendor and the model names that identify it, tried in order. */
interface VendorRule {
	vendor: DeviceVendor;
	pattern: RegExp;
}

/**
 * Model prefixes that name their maker. A phone whose model matches none of
 * them keeps its model and reports no vendor, since the string never says one.
 */
const VENDORS: VendorRule[] = [
	{ vendor: "Samsung", pattern: /^(?:SM-|GT-|SCH-|SGH-|SPH-|SHV-|SHW-|Galaxy)/i },
	{ vendor: "Google", pattern: /^(?:Pixel|Nexus)/i },
	{ vendor: "Xiaomi", pattern: /^(?:Redmi|POCO|Mi[ -])/i },
	{ vendor: "Huawei", pattern: /^(?:HUAWEI|HW-|Honor)/i },
	{ vendor: "OnePlus", pattern: /^(?:ONEPLUS|OnePlus)/i },
	{ vendor: "Motorola", pattern: /^(?:moto|XT\d)/i },
	{ vendor: "LG", pattern: /^(?:LG-|LM-|LG)/i },
	{ vendor: "Sony", pattern: /^(?:Sony|Xperia)/i },
	{ vendor: "Nokia", pattern: /^Nokia/i },
	{ vendor: "HTC", pattern: /^HTC/i },
	{ vendor: "Amazon", pattern: /^(?:KF|Kindle)/i },
];

/**
 * Segments that stand where a model would. `K` is what Chromium sends in place
 * of the model it no longer discloses, `wv` marks an in-app web view, and `U`
 * is a security marker left over from older Android builds.
 */
const PLACEHOLDER_SEGMENTS = new Set(["K", "wv", "U", "Mobile", "Tablet"]);

/** A language tag, which some Android builds list where the model otherwise sits. */
const LOCALE_SEGMENT = /^[a-z]{2}(?:[-_][a-z]{2})?$/i;

/** The Gecko revision, which is what a Firefox build carries instead of a model. */
const REVISION_SEGMENT = /^rv:/;

/** Televisions, which report a platform or a set-top product rather than a model. */
const TELEVISION =
	/\b(?:SMART-TV|SmartTV|Smart TV|Tizen|Web0S|WebOS|HbbTV|NetCast|Roku|AppleTV|GoogleTV|Android TV|BRAVIA|AFT[\w]+)\b/;

/** Apple hardware, which names its model in the platform token itself. */
function readApple(userAgent: string): Device | null {
	if (userAgent.includes("iPad")) return { type: "tablet", vendor: "Apple", model: "iPad" };
	if (userAgent.includes("iPod")) return { type: "mobile", vendor: "Apple", model: "iPod touch" };
	if (userAgent.includes("iPhone")) return { type: "mobile", vendor: "Apple", model: "iPhone" };
	if (userAgent.includes("Macintosh")) return { type: "desktop", vendor: "Apple", model: "Mac" };
	return null;
}

/** Consoles, whose product name and generation are the model. */
function readConsole(userAgent: string): Device | null {
	let playstation = /\bPlayStation (\w+)/.exec(userAgent);
	if (playstation !== null) {
		return { type: "console", vendor: "Sony", model: `PlayStation ${playstation[1] ?? ""}`.trim() };
	}

	if (userAgent.includes("Xbox")) {
		let model = userAgent.includes("Xbox One") ? "Xbox One" : "Xbox";
		return { type: "console", vendor: "Microsoft", model };
	}

	let nintendo = /\bNintendo (\w+)/.exec(userAgent);
	if (nintendo !== null) {
		return { type: "console", vendor: "Nintendo", model: `Nintendo ${nintendo[1] ?? ""}`.trim() };
	}

	return null;
}

/**
 * Televisions, read before Android because a television built on it reports the
 * same system a phone does.
 */
function readTelevision(userAgent: string): Device | null {
	if (!TELEVISION.test(userAgent)) return null;
	if (/\bAFT[\w]+\b/.test(userAgent)) return { type: "tv", vendor: "Amazon", model: null };
	if (userAgent.includes("AppleTV")) return { type: "tv", vendor: "Apple", model: "Apple TV" };
	return { type: "tv", vendor: null, model: null };
}

/** The model an Android build discloses, skipping the segments that stand in for one. */
function readAndroidModel(userAgent: string): string | null {
	let match = /\bAndroid[^;)]*;([^)]*)\)/.exec(userAgent);
	if (match?.[1] === undefined) return null;

	for (let segment of match[1].split(";")) {
		let model = segment.replace(/\s*Build\/.*$/, "").trim();
		if (model === "" || PLACEHOLDER_SEGMENTS.has(model)) continue;
		if (LOCALE_SEGMENT.test(model) || REVISION_SEGMENT.test(model)) continue;
		return model;
	}

	return null;
}

/** The maker a model name identifies, `null` when no prefix claims it. */
function readVendor(model: string | null): DeviceVendor | null {
	if (model === null) return null;
	for (let rule of VENDORS) {
		if (rule.pattern.test(model)) return rule.vendor;
	}
	return null;
}

/**
 * Android hardware, where the `Mobile` token is what separates a phone from a
 * tablet: a tablet build omits it, so its absence is the tablet's only mark.
 */
function readAndroid(userAgent: string): Device | null {
	if (!userAgent.includes("Android")) return null;

	let model = readAndroidModel(userAgent);

	return {
		type: userAgent.includes("Mobile") ? "mobile" : "tablet",
		vendor: readVendor(model),
		model,
	};
}

/** Amazon tablets, which announce the Silk browser or the Kindle product line. */
function readAmazonTablet(userAgent: string): Device | null {
	if (!/\b(?:Kindle|Silk)\b/.test(userAgent)) return null;
	return { type: "tablet", vendor: "Amazon", model: null };
}

/** Windows phones, whose platform token is the only evidence of the form factor. */
function readWindowsPhone(userAgent: string): Device | null {
	if (!userAgent.includes("Windows Phone")) return null;
	return { type: "mobile", vendor: null, model: null };
}

/** The desktop systems, which report the machine only as the platform it runs. */
function readDesktop(userAgent: string): Device | null {
	if (!/\b(?:Windows NT|Windows|CrOS|X11|Linux)\b/.test(userAgent)) return null;
	return { type: "desktop", vendor: null, model: null };
}

/**
 * Read what a user agent string was sent from.
 *
 * @param userAgent - The raw `User-Agent` header value.
 * @returns The device, with `null` in every field when the string names no platform.
 */
export function detectDevice(userAgent: string): Device {
	return (
		readApple(userAgent) ??
		readConsole(userAgent) ??
		readTelevision(userAgent) ??
		readWindowsPhone(userAgent) ??
		readAndroid(userAgent) ??
		readAmazonTablet(userAgent) ??
		readDesktop(userAgent) ?? { type: null, vendor: null, model: null }
	);
}
