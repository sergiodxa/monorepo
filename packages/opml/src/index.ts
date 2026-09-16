/**
 * Reads and writes OPML subscription lists, the document a feed reader hands someone
 * leaving and accepts from whoever arrives. Readers file feeds into folders, so the
 * document is a tree while the list a caller wants is flat, and reading flattens it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { createDocument } from "./lib/create-document.js";
import { readDocument } from "./lib/read-document.js";

/** Signals that text is not XML, or is XML whose root says it is not OPML. */
export class OPMLParseError extends Error {
	override name = "OPMLParseError";
}

/**
 * Groups the OPML types under a single import surface.
 */
export namespace OPML {
	/** One subscription an OPML document lists. */
	export interface Outline {
		title: string;
		feedUrl: string;
		siteUrl?: string;
		/**
		 * The folder it sits in: the nearest outline around it that names no feed, as it was
		 * read, and the outline it is written back inside of.
		 *
		 * Nearest rather than outermost, and rather than a joined path, because the nearest
		 * name is the one the person wrote over that feed while a joined one invents a name
		 * nobody typed. Depth is lost once, on the way in.
		 */
		folder?: string;
	}

	/** Options accepted when writing a subscription list. */
	export interface StringifyOptions {
		/** The document's own title, which a reader shows when importing it. */
		title?: string;
		/** When the document was written. */
		dateCreated?: Date;
	}
}

/**
 * Reads every subscription a document lists, in document order: an outline with
 * `xmlUrl` is a feed, one without it is the folder around others, and a feed listed
 * twice keeps its first place. A document listing no feeds succeeds empty.
 *
 * Each subscription carries the name of the nearest folder around it, so a tree read by
 * something that files flatly keeps one level of the filing that was in it.
 *
 * @param source - The raw OPML text
 * @returns The subscriptions, or why the text is not a subscription list
 */
export function parse(source: string): Result<OPML.Outline[], OPMLParseError> {
	let parsed = XML.parse(source);
	if (isFailure(parsed)) return failure(new OPMLParseError(parsed.error.message));
	return readDocument(parsed.data.root);
}

/**
 * Writes subscriptions as an OPML 2.0 document: one outline per folder holding the
 * subscriptions filed there, folders in the order their names read, and the rest at the
 * top level after them. Every value is escaped by the XML layer, so reading the result
 * back yields the outlines that went in, markup characters and all.
 *
 * @param outlines - The subscriptions to write, in the order they should appear
 * @param options - The document's own title and creation date
 * @returns The OPML document as text
 */
export function stringify(outlines: OPML.Outline[], options: OPML.StringifyOptions = {}): string {
	return new XML(createDocument(outlines, options)).toString();
}
