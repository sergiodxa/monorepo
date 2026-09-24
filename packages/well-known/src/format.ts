/**
 * The description every well-known document shares: its registered name, media type,
 * URL placement and CORS rule beside its reader and writer, which is what lets one
 * response helper and one middleware serve any of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import type { WellKnownParseError } from "./parse-error.js";

/**
 * RFC 8414 and RFC 9728 insert the suffix between host and path; OpenID Connect
 * Discovery appends it to the identifier.
 */
export type WellKnownPlacement = "insert" | "append";

/**
 * A registered well-known document: how to name, serve, read and write it.
 *
 * @template Document - The typed document the reader produces and the writer takes.
 */
export interface WellKnownFormat<Document> {
	/** The IANA-registered suffix, as it appears after `/.well-known/`. */
	readonly name: string;
	/** The `Content-Type` every answer carries. */
	readonly mediaType: string;
	/** Where the suffix goes relative to an identifier carrying a path. */
	readonly placement: WellKnownPlacement;
	/** Whether every answer carries `Access-Control-Allow-Origin: *`. */
	readonly cors: boolean;
	/** The document as the text served under the name. */
	stringify(document: Document): string;
	/** Reads served text back, reporting every place it breaks the specification. */
	parse(text: string): Result<Document, WellKnownParseError>;
}
