/**
 * Which engine rendered the page, which is a different question from which
 * browser asked: a Chromium browser announces itself by its own name while
 * every browser on iOS renders through WebKit whatever name it carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Engine, EngineName } from "./types.js";

/**
 * An engine, the token that proves it, and where its version is written when
 * that is somewhere other than the proving token's own capture group.
 */
interface EngineRule {
	name: EngineName;
	pattern: RegExp;
	version?: RegExp;
}

/** The build number every WebKit-descended engine reports, Blink included. */
const WEBKIT_VERSION = /\bAppleWebKit\/([\d.]+)/;

/**
 * Read in order, first match winning. The Chromium tokens are tested before
 * `AppleWebKit` because a Blink user agent carries both, while the browsers
 * Apple's platform requires to use WebKit carry only the second.
 */
const ENGINES: EngineRule[] = [
	{ name: "Trident", pattern: /\bTrident\/([\d.]+)/ },
	{ name: "EdgeHTML", pattern: /\bEdge\/([\d.]+)/ },
	{ name: "Presto", pattern: /\bPresto\/([\d.]+)/ },
	{ name: "Gecko", pattern: /\brv:([\d.]+).*\bGecko\// },
	{
		name: "Blink",
		pattern: /\b(?:Chrome|Chromium|Edg|OPR|SamsungBrowser|YaBrowser|Vivaldi)\/[\d.]+/,
		version: WEBKIT_VERSION,
	},
	{ name: "WebKit", pattern: WEBKIT_VERSION },
];

/**
 * Name the engine behind a user agent string and the version it reports.
 *
 * @param userAgent - The raw `User-Agent` header value.
 * @returns The engine, with `null` in both fields when no rule claims the string.
 */
export function detectEngine(userAgent: string): Engine {
	for (let rule of ENGINES) {
		if (!rule.pattern.test(userAgent)) continue;
		let match = (rule.version ?? rule.pattern).exec(userAgent);
		return { name: rule.name, version: match?.[1] ?? null };
	}

	return { name: null, version: null };
}
