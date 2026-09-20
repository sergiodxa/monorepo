/**
 * The one call the package exists for: a user agent string in, everything it
 * gives up out. Each part is read independently, so a string the rules only
 * half recognize still answers for the parts they do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UserAgent } from "./types.js";

import { detectBrowser } from "./browser.js";
import { detectDevice } from "./device.js";
import { detectEngine } from "./engine.js";
import { detectOperatingSystem } from "./os.js";

/**
 * Read a user agent string into the browser, engine, operating system and
 * device it describes. Every field is optional, so anything the rules do not
 * recognize — a crawler, a script, an empty header — reads as `null`.
 *
 * @param userAgent - The raw `User-Agent` header value.
 * @returns What the string describes, each part read on its own.
 *
 * @example
 * parse(request.headers.get("user-agent") ?? "").device.type === "mobile";
 */
export function parse(userAgent: string): UserAgent {
	return {
		browser: detectBrowser(userAgent),
		engine: detectEngine(userAgent),
		os: detectOperatingSystem(userAgent),
		device: detectDevice(userAgent),
	};
}
