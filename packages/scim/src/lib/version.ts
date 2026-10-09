/**
 * Resource versions as RFC 7644 §3.14 uses them: a weak entity tag computed from the
 * resource's content, and the `If-Match`/`If-None-Match` check SCIM clients expect, which
 * compares tags weakly because the RFC's own examples send weak tags on `If-Match`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isWireObject } from "./attributes.js";

/**
 * JSON text with object keys sorted at every depth, so equal resources serialize equally
 * whatever order their members were written in.
 *
 * @param value - Any JSON value
 * @returns The canonical text
 */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (isWireObject(value)) {
		let entries = Object.keys(value)
			.filter((key) => value[key] !== undefined)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
		return `{${entries.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/**
 * A weak entity tag over the resource's content, for `meta.version` and the `ETag` header.
 * The top-level `meta` is left out, so stamping the version or `lastModified` into the
 * resource leaves its version unchanged.
 *
 * @param resource - The wire resource
 * @returns A tag such as `W/"q1b…"`
 */
export async function version(resource: object): Promise<string> {
	let content: Record<string, unknown> = { ...resource };
	for (let key of Object.keys(content)) if (key.toLowerCase() === "meta") delete content[key];
	let bytes = new TextEncoder().encode(stableStringify(content));
	let digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
	let base64 = btoa(String.fromCharCode(...digest));
	let opaque = base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
	return `W/"${opaque}"`;
}

/** A tag read from a conditional header, and the index scanning resumes from after it. */
interface ScannedTag {
	opaque: string;
	next: number;
}

/**
 * Whether a character is whitespace as `\s` defines it, so tags are delimited the same way
 * across all Unicode space separators.
 */
function isSpace(char: string | undefined): boolean {
	return char !== undefined && /\s/.test(char);
}

/**
 * The entity tags of an `If-Match` or `If-None-Match` header, reduced to their opaque part:
 * the weakness prefix and quotes are dropped, and a bare tag some clients send is accepted.
 * Text that forms no tag is skipped, and the scan stays linear in the header's length.
 *
 * @param header - The header value
 * @returns The opaque tags, with `*` kept as is
 */
function parseTags(header: string): string[] {
	let length = header.length;
	let spaceEnd = new Int32Array(length + 1).fill(length);
	let bareEnd = new Int32Array(length + 1).fill(length);
	for (let index = length - 1; index >= 0; index--) {
		let char = header[index];
		let space = isSpace(char);
		spaceEnd[index] = space ? (spaceEnd[index + 1] ?? length) : index;
		bareEnd[index] = space || char === "," ? index : (bareEnd[index + 1] ?? length);
	}

	/**
	 * Where scanning resumes once a tag ends at `position`: past optional whitespace and the
	 * comma, or at the end of the header, or `-1` when anything else follows the tag.
	 */
	let separatorAfter = (position: number): number => {
		let end = spaceEnd[position] ?? length;
		if (end === length) return end;
		return header[end] === "," ? end + 1 : -1;
	};

	/** A quoted tag, weak (`W/"…"`, any case) or strong, starting at `start`. */
	let quotedAt = (start: number): ScannedTag | null => {
		let open = header.slice(start, start + 2).toLowerCase() === "w/" ? start + 2 : start;
		if (header[open] !== '"') return null;
		let close = header.indexOf('"', open + 1);
		if (close === -1) return null;
		let next = separatorAfter(close + 1);
		return next === -1 ? null : { opaque: header.slice(open + 1, close), next };
	};

	/** A bare tag: the run of characters up to whitespace or a comma, starting at `start`. */
	let bareAt = (start: number): ScannedTag | null => {
		let end = bareEnd[start] ?? length;
		if (end === start) return null;
		let next = separatorAfter(end);
		return next === -1 ? null : { opaque: header.slice(start, end), next };
	};

	let tags: string[] = [];
	let index = 0;
	while (index < length) {
		let start = spaceEnd[index] ?? length;
		let tag = quotedAt(start) ?? bareAt(start);
		if (tag === null) {
			index = start + 1;
			continue;
		}
		tags.push(tag.opaque);
		index = tag.next;
	}
	return tags;
}

/**
 * The opaque part of the current version.
 *
 * @param tag - The version, weak, strong or bare
 * @returns Its opaque part
 */
function opaqueOf(tag: string): string {
	return parseTags(tag)[0] ?? tag;
}

/**
 * Whether a request's conditional headers let it proceed against the current version,
 * comparing tags weakly. A failed `If-Match` answers `412`; a failed `If-None-Match` answers
 * `304` on a read and `412` on a write. Without either header the request proceeds.
 *
 * @param request - The incoming request
 * @param current - The resource's current version
 * @returns Whether the preconditions hold
 * @example if (!matchesVersion(request, await version(resource))) return errorResponse(new ScimError(412, "The resource changed."))
 */
export function matchesVersion(request: Request, current: string): boolean {
	let opaque = opaqueOf(current);

	let ifMatch = request.headers.get("If-Match");
	if (ifMatch !== null) {
		let tags = parseTags(ifMatch);
		if (!tags.includes("*") && !tags.includes(opaque)) return false;
	}

	let ifNoneMatch = request.headers.get("If-None-Match");
	if (ifNoneMatch !== null) {
		let tags = parseTags(ifNoneMatch);
		if (tags.includes("*") || tags.includes(opaque)) return false;
	}

	return true;
}
