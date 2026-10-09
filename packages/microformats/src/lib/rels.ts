/**
 * Collects the `rel` values of every `a`, `area` and `link` on a page into `rels` (each
 * rel value to its URLs) and `relUrls` (each URL to its rel values and link attributes),
 * which is how `rel="me"`, `rel="author"` and `rel="webmention"` are read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DOMDocument } from "@sdxc/html/document";

import type { MF2 } from "../index.js";

import { resolveUrl } from "./url.js";

/** Link attributes copied into a URL's entry, the first link to carry one winning. */
const LINK_ATTRIBUTES = ["hreflang", "media", "title", "type"] as const;

/**
 * Reads every `rel` in document order. A URL listed under several links keeps the first
 * text and attributes seen, and its `rels` accumulate, unique and sorted. Keys come from
 * the page, so a URL or rel such as `__proto__` lands as an own property like any other.
 */
export function collectRels(
	document: DOMDocument,
	base: string,
): Pick<MF2.Document, "rels" | "relUrls"> {
	let rels = new Map<string, string[]>();
	let relUrls = new Map<string, MF2.RelUrl>();

	for (let link of Array.from(document.querySelectorAll("a[rel], area[rel], link[rel]"))) {
		if (link.closest("template") !== null) continue;
		let values = [...new Set((link.getAttribute("rel") ?? "").split(/[ \t\n\f\r]+/u))].filter(
			Boolean,
		);
		if (values.length === 0) continue;
		let url = resolveUrl(link.getAttribute("href") ?? "", base);

		for (let value of values) {
			let urls = rels.get(value) ?? [];
			if (!urls.includes(url)) urls.push(url);
			rels.set(value, urls);
		}

		let entry = relUrls.get(url) ?? { rels: [] };
		relUrls.set(url, entry);
		for (let name of LINK_ATTRIBUTES) {
			let attribute = link.getAttribute(name);
			if (attribute !== null && entry[name] === undefined) entry[name] = attribute;
		}
		let text = link.textContent ?? "";
		if (entry.text === undefined && text !== "") entry.text = text;
		entry.rels = [...new Set([...entry.rels, ...values])].sort();
	}

	return { rels: Object.fromEntries(rels), relUrls: Object.fromEntries(relUrls) };
}
