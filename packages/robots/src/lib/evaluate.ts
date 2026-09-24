/**
 * Evaluates a parsed robots.txt for one agent. The agent's groups are chosen by product token,
 * every group naming it merges into one, the wildcard group applies only when none does, and the
 * longest matching rule decides with `Allow` winning a tie.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Robots } from "../index.js";

import { compilePattern, matches, pathToMatch } from "./match.js";

/** The leading run of characters RFC 9309 allows in a product token. */
const PRODUCT_TOKEN = /^[A-Za-z_-]+/;

/** The path RFC 9309 always allows, so a crawler can always read the rules. */
const ROBOTS_PATH = "/robots.txt";

/**
 * The token a user-agent line is compared against, lower-cased: the leading letters,
 * underscores and hyphens, so `SergioReader/1.0 (+https://…)` gives `sergioreader`. `*` stays
 * `*`, and a string with no such run gives `""`, which only the wildcard group applies to.
 *
 * @param userAgent - A crawler's identification string, or a user-agent line's value.
 */
export function productToken(userAgent: string): string {
	let trimmed = userAgent.trim();
	if (trimmed.startsWith("*")) return "*";
	return (PRODUCT_TOKEN.exec(trimmed)?.[0] ?? "").toLowerCase();
}

/**
 * Whether an agent may fetch a URL. `/robots.txt` is always allowed, a path no rule matches is
 * allowed, and text that is neither a URL nor a path is refused.
 *
 * @param robots - The parsed file.
 * @param userAgent - The crawler's identification string; only its product token is compared.
 * @param url - An absolute URL, or a path starting with `/`.
 * @example if (!isAllowed(document, "SergioReader/1.0", url)) return refuse();
 */
export function isAllowed(robots: Robots.Document, userAgent: string, url: string | URL): boolean {
	let path = pathToMatch(url);
	if (path === null) return false;
	if (path === ROBOTS_PATH) return true;

	let decision: { allow: boolean; length: number } | null = null;

	for (let group of applicableGroups(robots, userAgent)) {
		for (let rule of group.rules) {
			if (rule.pattern === "") continue;

			let pattern = compilePattern(rule.pattern);
			if (!matches(pattern, path)) continue;

			let length = pattern.body.length + (pattern.anchored ? 1 : 0);
			if (decision === null || length > decision.length) decision = { allow: rule.allow, length };
			else if (length === decision.length && rule.allow) decision.allow = true;
		}
	}

	return decision === null || decision.allow;
}

/**
 * The `Crawl-delay` that applies to an agent, in seconds: the last one set across the agent's
 * groups, or across the wildcard groups when none names it.
 *
 * @param robots - The parsed file.
 * @param userAgent - The crawler's identification string.
 */
export function crawlDelay(robots: Robots.Document, userAgent: string): number | undefined {
	let delay: number | undefined;
	for (let group of applicableGroups(robots, userAgent)) delay = group.crawlDelay ?? delay;
	return delay;
}

/**
 * The origin's robots.txt URL for any URL on it, or `null` for text that is not a URL or a URL
 * with no origin (such as `data:`).
 *
 * @param url - Any URL on the origin.
 * @example robotsUrl("https://example.com/post/1") // "https://example.com/robots.txt"
 */
export function robotsUrl(url: string | URL): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}

	if (parsed.origin === "null") return null;
	return new URL(ROBOTS_PATH, parsed.origin).toString();
}

/** The groups naming the agent's product token, or the wildcard groups when none does. */
function applicableGroups(robots: Robots.Document, userAgent: string): Robots.Group[] {
	let token = productToken(userAgent);
	let named =
		token === "" || token === "*"
			? []
			: robots.groups.filter((group) =>
					group.userAgents.some((agent) => productToken(agent) === token),
				);

	if (named.length > 0) return named;
	return robots.groups.filter((group) =>
		group.userAgents.some((agent) => productToken(agent) === "*"),
	);
}
