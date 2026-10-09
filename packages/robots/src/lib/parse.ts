/**
 * The robots.txt reader. Every line is tried and whatever is not a record is skipped, as RFC 9309
 * §2.3.1.5 asks, so any text parses: a file of HTML is a document with no groups. A `Sitemap` or
 * unknown record between two user-agent lines keeps them in one group; group members end it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Robots } from "../index.js";

import { truncateAtLine } from "./truncate.js";

/** RFC 9309 §2.5 has a crawler parse at least 500 KiB. */
export const DEFAULT_MAX_BYTES = 512_000;

/** Every line end RFC 9309 accepts: CRLF, CR and LF. */
const LINE_END = /\r\n|\r|\n/;

/** A non-negative decimal number, as a `Crawl-delay` value is written. */
const DELAY = /^\d+(?:\.\d+)?$/;

/**
 * Reads any text as robots.txt: a leading byte order mark is dropped, only the whole lines
 * within `maxBytes` are read, and lines that are not records are skipped.
 *
 * @param source - The file's text.
 * @param options - The parsing limit.
 * @returns The groups, sitemaps and other records the file declares.
 * @example let document = parse(await response.text());
 */
export function parse(source: string, options: Robots.ParseOptions = {}): Robots.Document {
	let text = limit(source.startsWith("﻿") ? source.slice(1) : source, options.maxBytes);
	let document: Robots.Document = { groups: [], sitemaps: [], records: [] };
	let group: Robots.Group | null = null;
	let collectingAgents = false;

	for (let line of text.split(LINE_END)) {
		let content = trimSpace(line.split("#", 1)[0] ?? "");
		let separator = content.indexOf(":");
		if (separator === -1) continue;

		let name = trimSpace(content.slice(0, separator)).toLowerCase();
		let value = trimSpace(content.slice(separator + 1));

		if (name === "user-agent") {
			if (group === null || !collectingAgents) {
				group = { userAgents: [], rules: [] };
				document.groups.push(group);
			}
			group.userAgents.push(value);
			collectingAgents = true;
			continue;
		}

		if (name === "allow" || name === "disallow") {
			if (group === null) continue;
			group.rules.push({ allow: name === "allow", pattern: value });
			collectingAgents = false;
			continue;
		}

		if (name === "sitemap") {
			if (value !== "") document.sitemaps.push(value);
			continue;
		}

		if (group !== null && name === "crawl-delay") {
			if (DELAY.test(value)) group.crawlDelay = Number(value);
			collectingAgents = false;
			continue;
		}

		if (group !== null && name === "content-signal") {
			group.contentSignals = { ...group.contentSignals, ...readContentSignals(value) };
			collectingAgents = false;
			continue;
		}

		document.records.push({ name, value });
	}

	return document;
}

/**
 * Trims the spaces and tabs RFC 9309 allows, so a byte order mark inside a line stays in it. One
 * scan from each end keeps the cost linear however much whitespace a line carries.
 */
function trimSpace(text: string): string {
	let start = 0;
	let end = text.length;
	while (start < end && isSpace(text[start])) start++;
	while (end > start && isSpace(text[end - 1])) end--;
	return text.slice(start, end);
}

/** Whether a character is a space or a tab, the only whitespace RFC 9309's grammar allows. */
function isSpace(char: string | undefined): boolean {
	return char === " " || char === "\t";
}

/**
 * Reads a `Content-Signal` value such as `search=yes, ai-train=no`; keys are lower-cased and a
 * value other than `yes` or `no` is skipped.
 *
 * @param value - The record's value.
 */
export function readContentSignals(value: string): Robots.ContentSignals {
	let signals: Robots.ContentSignals = {};

	for (let entry of value.split(",")) {
		let [key = "", setting = ""] = entry.split("=").map((part) => part.trim().toLowerCase());
		if (key === "") continue;
		if (setting === "yes") signals[key] = true;
		if (setting === "no") signals[key] = false;
	}

	return signals;
}

/**
 * The text within the parsing limit, cut at the last line end inside it. Text short enough that
 * its UTF-8 cannot pass the limit is returned without being encoded.
 */
function limit(text: string, maxBytes = DEFAULT_MAX_BYTES): string {
	if (text.length * 3 <= maxBytes) return text;

	let bytes = new TextEncoder().encode(text);
	if (bytes.byteLength <= maxBytes) return text;

	return new TextDecoder().decode(truncateAtLine(bytes, maxBytes));
}
