/**
 * Which browser sent the request, read from the product tokens it appends. The
 * rules are ordered so a browser that borrows another's tokens is claimed by its
 * own rule first, which is what keeps Edge, Opera and Samsung out of Chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Browser, BrowserName } from "./types.js";

/** A browser and the token that proves it, capturing the version it carries. */
interface BrowserRule {
	name: BrowserName;
	pattern: RegExp;
}

/**
 * Read in order, first match winning. A browser built on Chromium keeps the
 * `Chrome` token and every WebKit-descended browser keeps `Safari`, so the
 * distinguishing token has to be tried before the inherited one.
 */
const BROWSERS: BrowserRule[] = [
	{ name: "Edge", pattern: /\b(?:Edge|EdgA|EdgiOS|Edg)\/([\d.]+)/ },
	{ name: "Opera", pattern: /\b(?:OPR|OPiOS|OPT)\/([\d.]+)/ },
	{ name: "Opera", pattern: /\bOpera\/[\d.]+.*\bVersion\/([\d.]+)/ },
	{ name: "Opera", pattern: /\bOpera[ /]([\d.]+)/ },
	{ name: "Vivaldi", pattern: /\bVivaldi\/([\d.]+)/ },
	{ name: "Yandex Browser", pattern: /\bYaBrowser\/([\d.]+)/ },
	{ name: "Samsung Internet", pattern: /\bSamsungBrowser\/([\d.]+)/ },
	{ name: "UC Browser", pattern: /\bUCBrowser\/([\d.]+)/ },
	{ name: "DuckDuckGo", pattern: /\b(?:DuckDuckGo|Ddg)\/([\d.]+)/ },
	{ name: "Silk", pattern: /\bSilk\/([\d.]+)/ },
	{ name: "Firefox", pattern: /\b(?:Firefox|FxiOS)\/([\d.]+)/ },
	{ name: "Chrome", pattern: /\bCriOS\/([\d.]+)/ },
	{ name: "Chromium", pattern: /\bChromium\/([\d.]+)/ },
	{ name: "Chrome", pattern: /\bChrome\/([\d.]+)/ },
	{ name: "Safari", pattern: /\bVersion\/([\d.]+).*\bSafari\// },
	{ name: "Safari", pattern: /\bSafari\/([\d.]+)/ },
	{ name: "Internet Explorer", pattern: /\bMSIE ([\d.]+)/ },
	{ name: "Internet Explorer", pattern: /\bTrident\/[\d.]+;.*\brv:([\d.]+)/ },
];

/**
 * Name the browser behind a user agent string and the version it reports.
 *
 * @param userAgent - The raw `User-Agent` header value.
 * @returns The browser, with `null` in both fields when no rule claims the string.
 */
export function detectBrowser(userAgent: string): Browser {
	for (let rule of BROWSERS) {
		let match = rule.pattern.exec(userAgent);
		if (match === null) continue;
		return { name: rule.name, version: match[1] ?? null };
	}

	return { name: null, version: null };
}
