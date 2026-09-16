/**
 * Reads the one machine-readable "no" the web has. A `robots.txt` is grouped by the
 * agent it addresses, and this answers whether a named agent may retrieve a path,
 * by the longest rule that matches it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One `Allow` or `Disallow` line, kept with the length that decides ties. */
interface Rule {
	allow: boolean;
	pattern: string;
}

/**
 * The address a document's `robots.txt` lives at, which is the origin's root
 * whatever path the document itself sits under.
 *
 * @param url - Any URL on the origin.
 */
export function robotsUrl(url: URL): string {
	return new URL("/robots.txt", url.origin).toString();
}

/**
 * The product token a `User-agent` line is matched against, which is the name up to
 * the first slash or space of a full agent string.
 *
 * @param userAgent - The agent string the request sends.
 */
export function productToken(userAgent: string): string {
	return (userAgent.split(/[/\s]/u).at(0) ?? userAgent).toLowerCase();
}

/**
 * Whether an agent may retrieve a path.
 *
 * A document nobody could parse permits everything, which is what an origin serving
 * an error page in place of a `robots.txt` amounts to. The groups addressing the
 * agent by name replace the wildcard group entirely, and among the rules that apply
 * the longest pattern decides — an `Allow` winning a tie, so a narrower permission
 * carves a hole in a broader refusal.
 *
 * @param source - The document as the origin served it, or `null` when there is none.
 * @param path - The path and query being retrieved.
 * @param userAgent - The agent string the request sends.
 */
export function isAllowed(source: string | null, path: string, userAgent: string): boolean {
	if (source === null) return true;

	let token = productToken(userAgent);
	let named: Rule[] = [];
	let wildcard: Rule[] = [];

	let agents: string[] = [];
	let collecting: Rule[][] = [];
	let openedRules = false;

	for (let line of source.split(/\r?\n/u)) {
		let content = line.split("#").at(0) ?? "";
		let separator = content.indexOf(":");
		if (separator === -1) continue;

		let field = content.slice(0, separator).trim().toLowerCase();
		let value = content.slice(separator + 1).trim();

		if (field === "user-agent") {
			if (openedRules) {
				agents = [];
				collecting = [];
				openedRules = false;
			}

			agents.push(value.toLowerCase());
			collecting = agents.map((agent) => (agent === "*" ? wildcard : agent === token ? named : []));
			continue;
		}

		if (field !== "allow" && field !== "disallow") continue;
		if (collecting.length === 0) continue;

		openedRules = true;
		if (value.length === 0 && field === "disallow") continue;

		for (let bucket of collecting) bucket.push({ allow: field === "allow", pattern: value });
	}

	let rules = named.length > 0 ? named : wildcard;

	let decision: Rule | null = null;
	for (let rule of rules) {
		if (!matches(rule.pattern, path)) continue;
		if (decision === null) {
			decision = rule;
			continue;
		}
		if (rule.pattern.length > decision.pattern.length) decision = rule;
		else if (rule.pattern.length === decision.pattern.length && rule.allow) decision = rule;
	}

	return decision === null || decision.allow;
}

/**
 * Whether a path is covered by a rule's pattern, honouring the two wildcards the
 * format grew: `*` for any run of characters and `$` for the end of the path.
 */
function matches(pattern: string, path: string): boolean {
	if (pattern.length === 0) return false;

	let anchored = pattern.endsWith("$");
	let body = anchored ? pattern.slice(0, -1) : pattern;

	let expression = body
		.split("*")
		.map((part) => part.replaceAll(/[.+?^${}()|[\]\\]/gu, "\\$&"))
		.join(".*");

	return new RegExp(`^${expression}${anchored ? "$" : ""}`, "u").test(path);
}
