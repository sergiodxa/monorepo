/**
 * Writes `ActivityPub` documents as compacted JSON-LD under one fixed `@context`, in the
 * shape Mastodon emits, so every server that reads AS2 as plain JSON finds each member
 * under the name it expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JsonObject } from "./compact.js";
import type { ActivityPub } from "./types.js";

import { isObject } from "./compact.js";
import {
	AS2_CONTEXT,
	DATA_INTEGRITY_CONTEXT,
	MULTIKEY_CONTEXT,
	SECURITY_CONTEXT,
} from "./constants.js";

/**
 * The extension terms this package writes, defined the way Mastodon defines them, so a
 * JSON-LD processor on the other side expands each to the IRI its own writer uses.
 */
export const EXTENSION_CONTEXT = {
	manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
	sensitive: "as:sensitive",
	Hashtag: "as:Hashtag",
	alsoKnownAs: { "@id": "as:alsoKnownAs", "@type": "@id" },
	movedTo: { "@id": "as:movedTo", "@type": "@id" },
	toot: "http://joinmastodon.org/ns#",
	featured: { "@id": "toot:featured", "@type": "@id" },
	discoverable: "toot:discoverable",
	indexable: "toot:indexable",
	Emoji: "toot:Emoji",
	blurhash: "toot:blurhash",
	focalPoint: { "@container": "@list", "@id": "toot:focalPoint" },
	schema: "http://schema.org#",
	PropertyValue: "schema:PropertyValue",
	value: "schema:value",
	misskey: "https://misskey-hub.net/ns#",
	_misskey_quote: "misskey:_misskey_quote",
	quote: { "@id": "https://w3id.org/fep/044f#quote", "@type": "@id" },
	quoteUri: "http://fedibird.com/ns#quoteUri",
} as const;

/** Members never written: ActivityPub §6 strips blind recipients before delivery. */
const STRIPPED_MEMBERS = new Set(["bto", "bcc"]);

/**
 * Whether a written value carries nothing, which `stringify` omits rather than writing
 * `null`, `[]` or `{}`.
 *
 * @param value - A value already written.
 */
function isEmpty(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (Array.isArray(value)) return value.length === 0;
	return isObject(value) && Object.keys(value).length === 0;
}

/**
 * A value as JSON: dates as ISO 8601, arrays and embedded objects written member by
 * member with empty ones dropped.
 *
 * @param value - Any member of a document.
 */
function writeValue(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(writeValue).filter((entry) => !isEmpty(entry));
	if (isObject(value)) return writeMembers(value);
	return value;
}

/**
 * An object's members as JSON, `id` and `type` first. `quote` is also written as
 * `_misskey_quote` and `quoteUri`, which Misskey and older Fedibird-derived servers read.
 *
 * @param document - The object, as the API shapes it.
 */
function writeMembers(document: JsonObject): JsonObject {
	let output: JsonObject = {};
	if (document.id !== undefined) output.id = document.id;
	if (document.type !== undefined) output.type = document.type;
	for (let [member, value] of Object.entries(document)) {
		if (member === "id" || member === "type" || STRIPPED_MEMBERS.has(member)) continue;
		let written = writeValue(value);
		if (isEmpty(written)) continue;
		output[member] = written;
		if (member === "quote") {
			output._misskey_quote = written;
			output.quoteUri = written;
		}
	}
	return output;
}

/**
 * Whether a member of a document holds at least one entry.
 *
 * @param document - The document.
 * @param member - The member name.
 */
function hasEntries(document: JsonObject, member: string): boolean {
	let value = document[member];
	return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null;
}

/**
 * The `@context` a document is written with: AS2, the security vocabulary, the
 * data-integrity and Multikey contexts only when the document uses them, then the
 * extension terms.
 *
 * @param document - The document being written.
 */
function contextFor(document: JsonObject): unknown[] {
	let context: unknown[] = [AS2_CONTEXT, SECURITY_CONTEXT];
	if (hasEntries(document, "proof")) context.push(DATA_INTEGRITY_CONTEXT);
	if (hasEntries(document, "assertionMethod")) context.push(MULTIKEY_CONTEXT);
	context.push(EXTENSION_CONTEXT);
	return context;
}

/**
 * Writes a document as JSON text with its `@context`, ready to serve or deliver. It
 * omits `null`, empty arrays and empty maps, never writes `bto` or `bcc`, and writes
 * dates as ISO 8601; embedded objects carry no `@context` of their own.
 *
 * @param document - Any document, parsed or authored.
 * @example
 * stringify({ id: NOTE_ID, type: "Note", attributedTo: [ACTOR_ID], to: [PUBLIC], content: html });
 */
export function stringify(document: ActivityPub.Draft<ActivityPub.Document>): string {
	let members = document as unknown as JsonObject;
	return JSON.stringify({ "@context": contextFor(members), ...writeMembers(members) });
}
