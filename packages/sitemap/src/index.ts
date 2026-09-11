/**
 * Reads and writes the sitemap protocol: collect URLs and serialize a document, or
 * retrieve and parse a published one. A sitemap is the cheapest inventory of a site
 * there is, so getting at it costs a parse rather than a parser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { XMLParseError } from "@sdxc/xml";

import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { createEntryElement } from "./lib/create-entry-element.js";
import { parseDocument } from "./lib/parse-document.js";

/** The namespace both sitemap documents declare on their root element. */
const NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";

/** Signals that a document is not a sitemap, naming the root element that arrived. */
export class SitemapParseError extends Error {
	override name = "SitemapParseError";
}

/** Signals that a sitemap could not be retrieved, naming what came back instead. */
export class SitemapFetchError extends Error {
	override name = "SitemapFetchError";
}

/**
 * Groups sitemap types under the package namespace.
 */
export namespace Sitemap {
	/**
	 * Limits `<changefreq>` values to the sitemap protocol enum.
	 */
	export type Frequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

	/**
	 * Tells the protocol's two documents apart: `urlset` lists pages and `index` lists
	 * other sitemaps, which is what says how to read the entries an instance holds.
	 */
	export type Kind = "urlset" | "index";

	/**
	 * Stores one sitemap entry and its optional crawler metadata.
	 */
	export interface Entry {
		loc: globalThis.URL;
		updatedAt?: Date;
		frequency?: Frequency;
		priority?: number;
	}

	/**
	 * Collects optional sitemap metadata accepted when appending a URL.
	 */
	export interface AppendOptions {
		updatedAt?: Date;
		frequency?: Frequency;
		/** Priority value between 0.0 and 1.0, default is 0.5 */
		priority?: number;
	}
}

/**
 * Collects sitemap entries and serializes them as sitemap XML, and reads the same
 * document back from a parsed tree or a published URL.
 */
export class Sitemap {
	#kind: Sitemap.Kind = "urlset";
	#entries = new Set<Sitemap.Entry>();

	/**
	 * Reads a parsed document as a sitemap. The root element decides: a `<urlset>` or
	 * `<sitemapindex>` sets `kind`, and any other root is the failure, which is how an
	 * error page served under a `200` in a sitemap's place reports itself.
	 *
	 * @param xml - The parsed XML document to read
	 * @returns The sitemap, or why the document is not one
	 */
	static parse(xml: XML): Result<Sitemap, SitemapParseError> {
		let document = parseDocument(xml);
		if (isFailure(document)) return document;

		let sitemap = new Sitemap();
		sitemap.#kind = document.data.kind;
		for (let entry of document.data.entries) sitemap.#entries.add(entry);

		return success(sitemap);
	}

	/**
	 * Retrieves one sitemap and parses it, reading the body whenever the response is
	 * `ok` because sitemaps are served under several content types and the root element
	 * is the check that answers whether one arrived. An index is retrieved as itself,
	 * so a caller that wants its children fetches them at its own pace.
	 *
	 * @param input - What `fetch` accepts: a URL, a string, or a `Request`
	 * @param init - Request options passed through to `fetch`
	 * @returns The sitemap, or why it could not be read
	 */
	static async fetch(
		input: globalThis.URL | RequestInfo,
		init?: RequestInit,
	): Promise<Result<Sitemap, SitemapFetchError | SitemapParseError | XMLParseError>> {
		let response: Response;
		try {
			response = await fetch(input, init);
		} catch (error) {
			let cause = error instanceof Error ? error.message : String(error);
			return failure(new SitemapFetchError(`Failed to fetch the sitemap: ${cause}`));
		}

		if (!response.ok) {
			void response.body?.cancel().catch(() => undefined);
			return failure(new SitemapFetchError(`Failed to fetch the sitemap: ${response.status}`));
		}

		let xml = XML.parse(await response.text());
		if (isFailure(xml)) return xml;

		return Sitemap.parse(xml.data);
	}

	/**
	 * Tells which document this instance carries, which is `urlset` for one built by
	 * appending and whatever was parsed for one that came from a document.
	 */
	get kind(): Sitemap.Kind {
		return this.#kind;
	}

	/**
	 * Exposes the entries as the live set, so a caller iterates the rows of a parsed
	 * document and a caller that built one reads back what it appended.
	 */
	get entries(): Set<Sitemap.Entry> {
		return this.#entries;
	}

	/**
	 * Returns how many entries are currently queued for serialization.
	 */
	get size(): number {
		return this.#entries.size;
	}

	/**
	 * Adds one URL entry with optional sitemap metadata.
	 *
	 * @param loc - Absolute URL to expose in the sitemap
	 * @param options - Optional crawler metadata for the URL
	 */
	append(loc: globalThis.URL, options: Sitemap.AppendOptions = {}) {
		this.#entries.add({ loc, ...options });
	}

	/**
	 * Serializes the current entries as the document type this instance carries, so a
	 * parsed index that is filtered and written back out stays a `<sitemapindex>`.
	 */
	toString() {
		let xml = new XML({
			declaration: { version: "1.0", encoding: "UTF-8" },
			root: {
				name: this.#kind === "index" ? "sitemapindex" : "urlset",
				attributes: { xmlns: NAMESPACE },
				children: [...this.#entries].map((entry) => createEntryElement(entry, this.#kind)),
			},
		});

		return xml.toString();
	}
}
