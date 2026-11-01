/**
 * Checks a sitemap's source against the protocol's limits: its size, its row count, each
 * `<loc>`, `<lastmod>`, `<changefreq>` and `<priority>`, and that every URL sits on one host.
 * Reading forgives what this module reports, so a publisher sees what a crawler silently drops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import type { Sitemap } from "../index.js";

import { childElements, FREQUENCIES, kindOf, localName, textOf, toURL } from "./parse-document.js";

/** The protocol's cap on an uncompressed sitemap: 50 MiB. */
const MAX_BYTES = 52_428_800;

/** The protocol's cap on the rows of one sitemap or sitemap index. */
const MAX_ROWS = 50_000;

/** The protocol's cap on a `<loc>`'s length, in characters. */
const MAX_LOC_LENGTH = 2048;

/** W3C Datetime at any of its precisions, from a year alone to fractional seconds. */
const W3C_DATETIME = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

/**
 * Every protocol problem in `source`, in document order; an empty list means it conforms.
 * Source that is not XML, or whose root is not a sitemap, is the one `document` problem.
 *
 * @param source - The sitemap's text, uncompressed
 * @param location - Where the sitemap is served, whose host every URL must share
 */
export function validateDocument(source: string, location?: globalThis.URL): Sitemap.Problem[] {
	let problems: Sitemap.Problem[] = [];

	let bytes = new TextEncoder().encode(source).byteLength;
	if (bytes > MAX_BYTES) {
		problems.push({
			rule: "size",
			message: `The sitemap is ${bytes} bytes, over the protocol's ${MAX_BYTES}.`,
		});
	}

	let xml = XML.parse(source);
	if (isFailure(xml)) {
		problems.push({ rule: "document", message: xml.error.message });
		return problems;
	}

	let kind = kindOf(localName(xml.data.root.name));
	if (!kind) {
		let message = `Expected a <urlset> or <sitemapindex> root, received <${xml.data.root.name}>.`;
		problems.push({ rule: "document", message });
		return problems;
	}

	let rowName = kind === "index" ? "sitemap" : "url";
	let rows = childElements(xml.data.root).filter((child) => localName(child.name) === rowName);
	if (rows.length > MAX_ROWS) {
		problems.push({
			rule: "count",
			message: `The sitemap holds ${rows.length} <${rowName}> rows, over the protocol's ${MAX_ROWS}.`,
		});
	}

	let host = location?.host;
	let hostSource = location ? "the sitemap is served from" : "the first URL is on";

	for (let [index, element] of rows.entries()) {
		let row = index + 1;
		problems.push(...rowProblems(element, row, kind));

		let loc = toURL(textOf(element, "loc"));
		if (!loc) continue;
		if (host === undefined) {
			host = loc.host;
			continue;
		}
		if (loc.host !== host) {
			problems.push({
				rule: "host",
				row,
				message: `Row ${row}: ${loc.href} is on ${loc.host}, but ${hostSource} ${host}.`,
			});
		}
	}

	return problems;
}

/**
 * The problems of one row's own fields; an index row carries only `<loc>` and `<lastmod>`,
 * so its other fields go unchecked.
 */
function rowProblems(element: XML.Element, row: number, kind: Sitemap.Kind) {
	let problems: Sitemap.Problem[] = [];
	let at = `Row ${row}:`;

	let loc = textOf(element, "loc");
	let url = toURL(loc);
	if (loc === undefined) {
		problems.push({ rule: "loc", row, message: `${at} <loc> is missing.` });
	} else if (!url || !/^https?:$/.test(url.protocol)) {
		problems.push({ rule: "loc", row, message: `${at} <loc> "${loc}" is not an absolute URL.` });
	} else if (loc.length > MAX_LOC_LENGTH) {
		problems.push({
			rule: "loc",
			row,
			message: `${at} <loc> is ${loc.length} characters, over the protocol's ${MAX_LOC_LENGTH}.`,
		});
	}

	let lastmod = textOf(element, "lastmod");
	if (lastmod !== undefined && !isW3CDatetime(lastmod)) {
		problems.push({
			rule: "lastmod",
			row,
			message: `${at} <lastmod> "${lastmod}" is not a W3C Datetime.`,
		});
	}

	if (kind === "index") return problems;

	let changefreq = textOf(element, "changefreq");
	if (changefreq !== undefined && !FREQUENCIES.some((frequency) => frequency === changefreq)) {
		problems.push({
			rule: "changefreq",
			row,
			message: `${at} <changefreq> "${changefreq}" is not one of ${FREQUENCIES.join(", ")}.`,
		});
	}

	let priority = textOf(element, "priority");
	if (priority !== undefined && !isPriority(priority)) {
		problems.push({
			rule: "priority",
			row,
			message: `${at} <priority> "${priority}" is not a number from 0.0 to 1.0.`,
		});
	}

	return problems;
}

/** A W3C Datetime that also names a real instant, so `2026-13-45` fails. */
function isW3CDatetime(value: string): boolean {
	return W3C_DATETIME.test(value) && !Number.isNaN(new Date(value).getTime());
}

/** A decimal from 0.0 to 1.0, written as digits so `0x1` and `1e0` fail. */
function isPriority(value: string): boolean {
	if (!/^\d+(\.\d+)?$|^\.\d+$/.test(value)) return false;
	let priority = Number(value);
	return priority >= 0 && priority <= 1;
}
