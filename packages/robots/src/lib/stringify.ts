/**
 * The robots.txt writer: one field per line, LF line ends, a blank line between sections. What it
 * writes parses back to the document it was given, so a file a site publishes reads the same way
 * in a crawler built on this package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Robots } from "../index.js";

/** Records a parser attaches to the open group, which must be written before any group opens. */
const GROUP_SCOPED = new Set(["crawl-delay", "content-signal"]);

/**
 * Writes a document: groups in order, then sitemaps, then other records. A `crawl-delay` or
 * `content-signal` record, which only exists outside a group when it preceded them all, is
 * written first so it stays outside on the way back in.
 *
 * @param document - The document to write.
 * @returns The file's text, ending in a line end; an empty document writes `""`.
 * @example stringify({ groups: [{ userAgents: ["*"], rules: [] }], sitemaps: [], records: [] })
 */
export function stringify(document: Robots.Document): string {
	let leading = document.records.filter((record) => GROUP_SCOPED.has(record.name));
	let trailing = document.records.filter((record) => !GROUP_SCOPED.has(record.name));

	let sections = [
		leading.map(writeRecord).join("\n"),
		...document.groups.map(writeGroup),
		document.sitemaps.map((sitemap) => `Sitemap: ${sitemap}`).join("\n"),
		trailing.map(writeRecord).join("\n"),
	].filter((section) => section !== "");

	return sections.length === 0 ? "" : `${sections.join("\n\n")}\n`;
}

/** One group: its user-agent lines, its rules, then its delay and signals. */
function writeGroup(group: Robots.Group): string {
	let lines = group.userAgents.map((agent) => `User-agent: ${agent}`);
	for (let rule of group.rules) lines.push(`${rule.allow ? "Allow" : "Disallow"}: ${rule.pattern}`);
	if (group.crawlDelay !== undefined) lines.push(`Crawl-delay: ${group.crawlDelay}`);

	let signals = Object.entries(group.contentSignals ?? {}).filter(
		(entry): entry is [string, boolean] => entry[1] !== undefined,
	);
	if (signals.length > 0) {
		let value = signals.map(([key, setting]) => `${key}=${setting ? "yes" : "no"}`).join(", ");
		lines.push(`Content-Signal: ${value}`);
	}

	return lines.join("\n");
}

/** One other record, its name capitalized per hyphenated segment as robots.txt files spell them. */
function writeRecord(record: Robots.Record): string {
	let name = record.name.replace(/(^|-)([a-z])/g, (_match, dash: string, letter: string) => {
		return `${dash}${letter.toUpperCase()}`;
	});
	return `${name}: ${record.value}`;
}
