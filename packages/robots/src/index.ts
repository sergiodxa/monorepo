/**
 * Reads, writes and evaluates robots.txt per RFC 9309. Parsing never fails, because the RFC
 * defines no invalid file; evaluation picks the agent's groups by product token and applies the
 * longest matching rule. Fetching lives in `./fetch` and per-page directives in `./directives`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { crawlDelay, isAllowed, productToken, robotsUrl } from "./lib/evaluate.js";
export { parse } from "./lib/parse.js";
export { stringify } from "./lib/stringify.js";

/** Types for robots.txt documents. */
export namespace Robots {
	/** One `Allow` or `Disallow` line. */
	export interface Rule {
		allow: boolean;
		/** As written, e.g. `/private/*.pdf$`; an empty pattern matches nothing. */
		pattern: string;
	}

	/**
	 * Content Signals for a group: `yes` reads as `true` and `no` as `false`. The three keys the
	 * Content Signals Policy defines are named; any other key written is kept.
	 */
	export interface ContentSignals {
		search?: boolean;
		"ai-input"?: boolean;
		"ai-train"?: boolean;
		[key: string]: boolean | undefined;
	}

	/** One or more user-agent lines and the rules that follow them. */
	export interface Group {
		/** The user-agent values as written, `*` for the wildcard group; matched by product token. */
		userAgents: string[];
		rules: Rule[];
		/** Non-standard, in seconds; the last value in the group wins. */
		crawlDelay?: number;
		contentSignals?: ContentSignals;
	}

	/**
	 * A record that is neither a group line nor a sitemap, kept so stringify round-trips it. A
	 * `crawl-delay` or `content-signal` line lands here only when it precedes every group.
	 */
	export interface Record {
		/** Lower-cased field name. */
		name: string;
		value: string;
	}

	/** A parsed robots.txt, groups in file order; groups naming one agent merge at evaluation. */
	export interface Document {
		groups: Group[];
		sitemaps: string[];
		records: Record[];
	}

	/** How much of a file is read. */
	export interface ParseOptions {
		/** Bytes of UTF-8 parsed; whole lines within it are read and the rest ignored. @default 512_000 */
		maxBytes?: number;
	}
}
