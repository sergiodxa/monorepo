/**
 * The link-target rule: where links point. Shorteners hide the destination, raw IP addresses skip
 * the domain a blocklist would catch, punycode hosts can imitate a brand, and a few top-level
 * domains carry a disproportionate share of abuse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

import { extractLinks } from "../lib/text.js";

/** Hosts of widely used URL shorteners. */
export const URL_SHORTENERS: readonly string[] = [
	"bit.ly",
	"bitly.com",
	"buff.ly",
	"cutt.ly",
	"goo.gl",
	"is.gd",
	"ow.ly",
	"rb.gy",
	"rebrand.ly",
	"s.id",
	"shorturl.at",
	"t.co",
	"t.ly",
	"tiny.cc",
	"tinyurl.com",
	"v.gd",
];

/** Top-level domains that abuse reports rank far above their share of registrations. */
export const ABUSED_TLDS: readonly string[] = [
	"bond",
	"cfd",
	"click",
	"cyou",
	"icu",
	"lol",
	"monster",
	"quest",
	"rest",
	"sbs",
	"top",
	"xyz",
	"zip",
];

/**
 * Scores every link in the content and the author's URL by its host: a shortener, an IPv4 or
 * IPv6 literal, a punycode label, or an abused top-level domain. The total is capped at
 * `maxScore`, so a long list of shortened links cannot outweigh every other rule.
 *
 * @example linkTargets({ shorteners: [...URL_SHORTENERS, "go.example"] })
 */
export function linkTargets(options: linkTargets.Options = {}): SpamCheck {
	let shorteners = new Set(options.shorteners ?? URL_SHORTENERS);
	let abusedTlds = new Set(options.abusedTlds ?? ABUSED_TLDS);
	let shortenerScore = options.shortenerScore ?? 3;
	let ipScore = options.ipScore ?? 5;
	let punycodeScore = options.punycodeScore ?? 2;
	let tldScore = options.tldScore ?? 1;
	let maxScore = options.maxScore ?? 12;

	return {
		name: "link-targets",
		stage: "local",
		check(submission): Signal[] {
			let authorUrl = submission.author?.url ?? "";
			let urls = extractLinks(`${submission.content} ${authorUrl}`);
			let signals: Signal[] = [];
			let total = 0;
			let add = (check: string, score: number, host: string) => {
				let capped = Math.min(score, maxScore - total);
				if (capped <= 0) return;
				total += capped;
				signals.push({ check: `link-targets.${check}`, score: capped, detail: host });
			};

			for (let url of urls) {
				let host = url.hostname.toLowerCase();
				if (shorteners.has(host)) add("shortener", shortenerScore, host);
				else if (isIpLiteral(host)) add("ip-address", ipScore, host);
				else if (host.split(".").some((label) => label.startsWith("xn--"))) {
					add("punycode", punycodeScore, host);
				} else if (abusedTlds.has(host.slice(host.lastIndexOf(".") + 1))) {
					add("abused-tld", tldScore, host);
				}
			}
			return signals;
		},
	};
}

/** Whether a URL's `hostname` is an IP address rather than a name. */
function isIpLiteral(host: string): boolean {
	return host.startsWith("[") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

/** The options {@link linkTargets} takes. */
export namespace linkTargets {
	/** Lists and weights for the link-target rule. */
	export interface Options {
		/** Replaces {@link URL_SHORTENERS}. */
		shorteners?: readonly string[];
		/** Replaces {@link ABUSED_TLDS}. */
		abusedTlds?: readonly string[];
		/** @default 3 */
		shortenerScore?: number;
		/** @default 5 */
		ipScore?: number;
		/** @default 2 */
		punycodeScore?: number;
		/** @default 1 */
		tldScore?: number;
		/** @default 12 */
		maxScore?: number;
	}
}
