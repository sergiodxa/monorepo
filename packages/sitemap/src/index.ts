/**
 * Collects and serializes sitemap entries as sitemap protocol XML.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { XML } from "@pkg/xml";

import { createURLChildren } from "./lib/create-url-children";

/**
 * Groups sitemap types under the package namespace.
 */
export namespace Sitemap {
	/**
	 * Limits `<changefreq>` values to the sitemap protocol enum.
	 */
	export type Frequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

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
 * Collects sitemap entries and serializes them as sitemap XML.
 */
export class Sitemap {
	entries = new Set<Sitemap.Entry>();

	/**
	 * Adds one URL entry with optional sitemap metadata.
	 *
	 * @param loc - Absolute URL to expose in the sitemap
	 * @param options - Optional crawler metadata for the URL
	 */
	append(loc: globalThis.URL, options: Sitemap.AppendOptions = {}) {
		this.entries.add({ loc, ...options });
	}

	/**
	 * Returns how many entries are currently queued for serialization.
	 */
	get size() {
		return this.entries.size;
	}

	/**
	 * Serializes the current entries into sitemap XML using `@pkg/xml`.
	 */
	toString() {
		let xml = new XML({
			declaration: { version: "1.0", encoding: "UTF-8" },
			root: {
				name: "urlset",
				attributes: { xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" },
				children: [...this.entries].map((url) => ({
					name: "url",
					children: createURLChildren(url),
				})),
			},
		});

		return xml.toString();
	}
}
