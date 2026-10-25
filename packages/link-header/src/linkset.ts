/**
 * RFC 9264 link sets: the `application/linkset` text form, which is the `Link` header
 * grammar with newlines allowed, and the `application/linkset+json` form. Both read into
 * one flat list of links, so a header converts to either document and back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { stringify as pointer } from "@sdxc/json-pointer";
import { failure, success } from "@sdxc/result";

import { quote, splitOutsideBracketsAndQuotes, unquote } from "./syntax.js";

import { parse as parseHeader } from "./index.js";

/** The media type of the text form, whose content is a `Link` header value. */
export const MEDIA_TYPE = "application/linkset";

/** The media type of the JSON form. */
export const JSON_MEDIA_TYPE = "application/linkset+json";

/** One value of an RFC 8187 attribute such as `title*`, decoded to text. */
export interface InternationalizedValue {
	value: string;
	/** The RFC 5646 language tag, absent when the attribute named none. */
	language?: string;
}

/**
 * One link of the RFC 8288 model: context, relation type, target and target attributes.
 * A `Link` header line naming several relation types reads as one link per type.
 */
export interface LinksetLink {
	/** The link context; absent means the resource that delivered the set. */
	anchor?: string;
	/** A registered relation type in lowercase, or an extension relation type's URI. */
	rel: string;
	/** The link target; `""` names the resource that delivered the set. */
	href: string;
	hreflang?: string[];
	media?: string;
	title?: string;
	type?: string;
	/**
	 * RFC 8187 attributes by name without the trailing `*`: `title` holds `title*`. Use it
	 * for any title outside ASCII, which the text form and the `Link` header cannot carry.
	 */
	internationalized?: Record<string, InternationalizedValue[]>;
	/** Every other attribute, each repeatable since its cardinality is unknown. */
	extensions?: Record<string, string[]>;
}

/** How a text-form set or a `Link` header is read. */
export interface ParseOptions {
	/**
	 * The URI of the resource that delivered the links: it fills a missing `anchor` and
	 * resolves relative references, so the links keep their meaning outside the exchange.
	 */
	context?: string | URL;
}

/** Why an `application/linkset+json` document could not be read; every issue is listed. */
export class LinksetParseError extends Error {
	override name = "LinksetParseError";
	readonly issues: LinksetParseError.Issue[];

	/** @param issues - Every problem found, at least one. */
	constructor(issues: LinksetParseError.Issue[]) {
		let first = issues[0]?.message ?? "The link set is invalid.";
		let more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : "";
		super(`${first}${more}`);
		this.issues = issues;
	}
}

export namespace LinksetParseError {
	/** One place a document breaks RFC 9264. */
	export interface Issue {
		/** A JSON Pointer into the document, `""` for the whole of it. */
		at: string;
		message: string;
	}
}

/** The target attributes RFC 8288 §3.4.1 defines, which occur at most once per link. */
const SINGLE_ATTRIBUTES = ["media", "title", "type"] as const;

/** Bytes RFC 8187's `attr-char` leaves unescaped. */
const ATTR_CHAR = /^[A-Za-z0-9!#$&+\-.^_`|~]$/;

/**
 * Decodes an RFC 8187 `ext-value` (`UTF-8'de'n%C3%A4chstes`), or `null` for a malformed
 * value or a charset other than the two the RFC requires, UTF-8 and ISO-8859-1.
 *
 * @param text - The parameter value, quotes already removed.
 */
function decodeExtValue(text: string): InternationalizedValue | null {
	let match = /^([^']*)'([^']*)'(.*)$/s.exec(text);
	if (match === null) return null;
	let [, charset = "", language = "", encoded = ""] = match;

	let value: string;
	if (charset.toLowerCase() === "utf-8") {
		try {
			value = decodeURIComponent(encoded);
		} catch {
			return null;
		}
	} else if (charset.toLowerCase() === "iso-8859-1") {
		value = encoded.replaceAll(/%([0-9a-f]{2})/gi, (_, hex: string) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		);
	} else {
		return null;
	}

	return language === "" ? { value } : { value, language };
}

/**
 * Encodes a value as an RFC 8187 `ext-value` in UTF-8, escaping every byte outside
 * `attr-char`, so a title in any script travels in an ASCII-only header.
 *
 * @param value - The decoded value and its language.
 */
function encodeExtValue(value: InternationalizedValue): string {
	let encoded = "";
	for (let byte of new TextEncoder().encode(value.value)) {
		let character = String.fromCharCode(byte);
		encoded += ATTR_CHAR.test(character)
			? character
			: `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
	}
	return `UTF-8'${value.language ?? ""}'${encoded}`;
}

/**
 * A relation type as compared: registered names are case-insensitive, so they lowercase;
 * an extension type is a URI and keeps its case.
 *
 * @param rel - One relation type as written.
 */
function normalizeRel(rel: string): string {
	return rel.includes(":") ? rel : rel.toLowerCase();
}

/**
 * Resolves a URI reference against the context when one is given, keeping the reference
 * as written when it cannot be resolved.
 *
 * @param reference - The anchor or target as written.
 * @param context - The delivering resource's URI.
 */
function resolve(reference: string, context: string | undefined): string {
	if (context === undefined) return reference;
	return URL.parse(reference, context)?.href ?? reference;
}

/**
 * The `name=value` pairs after a link-value's `<target>`, names lowercased and values
 * unquoted; a parameter without `=` reads as an empty value.
 *
 * @param raw - The whole link-value text.
 */
function readParameters(raw: string): Array<[string, string]> {
	let parameters: Array<[string, string]> = [];
	for (let parameter of splitOutsideBracketsAndQuotes(raw.slice(raw.indexOf(">") + 1), ";")) {
		let text = parameter.trim();
		if (text.length === 0) continue;
		let separator = text.indexOf("=");
		let name = (separator === -1 ? text : text.slice(0, separator)).trim().toLowerCase();
		let value = separator === -1 ? "" : unquote(text.slice(separator + 1).trim());
		parameters.push([name, value]);
	}
	return parameters;
}

/**
 * The attributes of one link-value. `rel`, `anchor`, the RFC 8288 single attributes and
 * `title*` honour their first occurrence; `hreflang` and extensions keep every one.
 *
 * @param parameters - The link-value's parameters in source order.
 */
function readAttributes(parameters: Array<[string, string]>): Omit<LinksetLink, "rel" | "href"> & {
	rels: string[];
} {
	let link: Omit<LinksetLink, "rel" | "href"> & { rels: string[] } = { rels: [] };
	let seen = new Set<string>();

	for (let [name, value] of parameters) {
		let first = !seen.has(name);
		seen.add(name);

		if (name === "rel") {
			if (first) link.rels = value.split(/\s+/).filter((rel) => rel.length > 0);
		} else if (name === "anchor") {
			if (first) link.anchor = value;
		} else if (name === "rev") {
			continue;
		} else if (name === "hreflang") {
			link.hreflang = [...(link.hreflang ?? []), value];
		} else if ((SINGLE_ATTRIBUTES as readonly string[]).includes(name)) {
			if (first) link[name as (typeof SINGLE_ATTRIBUTES)[number]] = value;
		} else if (name.endsWith("*")) {
			let decoded = decodeExtValue(value);
			let key = name.slice(0, -1);
			if (decoded === null || (key === "title" && !first)) continue;
			link.internationalized ??= {};
			link.internationalized[key] = [...(link.internationalized[key] ?? []), decoded];
		} else {
			link.extensions ??= {};
			link.extensions[name] = [...(link.extensions[name] ?? []), value];
		}
	}

	return link;
}

/**
 * Reads an `application/linkset` document or a `Link` header value into links, one per
 * relation type. Malformed link-values are dropped, so the call never fails.
 *
 * @param text - The document or header value; `null` reads as no links.
 * @param options - The delivering resource, to make every link self-contained.
 * @returns The links in source order.
 * @example parse(response.headers.get("Link"), { context: response.url })
 */
export function parse(text: string | null, options: ParseOptions = {}): LinksetLink[] {
	let context = options.context === undefined ? undefined : String(options.context);
	let links: LinksetLink[] = [];

	for (let entry of parseHeader(text)) {
		let { rels, ...attributes } = readAttributes(readParameters(entry.raw));
		let anchor = attributes.anchor ?? context;
		for (let rel of rels) {
			let link: LinksetLink = { ...attributes, rel: normalizeRel(rel), href: entry.target };
			link.href = resolve(link.href, context);
			if (anchor === undefined) delete link.anchor;
			else link.anchor = resolve(anchor, context);
			links.push(link);
		}
	}

	return links;
}

/**
 * One link as a link-value. Attribute values are quoted, RFC 8187 values are encoded,
 * and `title*` carries only its first value since the attribute occurs once.
 *
 * @param link - The link to write.
 */
function writeLinkValue(link: LinksetLink): string {
	let parts = [`<${link.href}>`, `rel=${quote(link.rel)}`];
	if (link.anchor !== undefined) parts.push(`anchor=${quote(link.anchor)}`);
	for (let language of link.hreflang ?? []) parts.push(`hreflang=${quote(language)}`);
	for (let name of SINGLE_ATTRIBUTES) {
		let value = link[name];
		if (value !== undefined) parts.push(`${name}=${quote(value)}`);
	}
	for (let [name, values] of Object.entries(link.internationalized ?? {})) {
		let written = name === "title" ? values.slice(0, 1) : values;
		for (let value of written) parts.push(`${name}*=${encodeExtValue(value)}`);
	}
	for (let [name, values] of Object.entries(link.extensions ?? {})) {
		for (let value of values) parts.push(`${name}=${quote(value)}`);
	}
	return parts.join("; ");
}

/**
 * Writes links as an `application/linkset` document, one link-value per line so a person
 * can read it. A document with no links is the empty string.
 *
 * @param links - The links to write.
 * @example stringify([{ anchor: "https://example.org/", rel: "author", href: "https://example.org/me" }])
 */
export function stringify(links: readonly LinksetLink[]): string {
	return links.map(writeLinkValue).join(",\n");
}

/**
 * Writes links as one `Link` header value, which RFC 9110 keeps on a single line.
 *
 * @param links - The links to write.
 * @returns The header value, or `null` when there is nothing to write.
 * @example headers.set("Link", toHeader(links) ?? "")
 */
export function toHeader(links: readonly LinksetLink[]): string | null {
	if (links.length === 0) return null;
	return links.map(writeLinkValue).join(", ");
}

/**
 * A link's target object: `href`, then each attribute in the JSON shape RFC 9264 §4.2.4
 * gives it, with `hreflang` and every extension as arrays.
 *
 * @param link - The link to write.
 */
function writeTargetObject(link: LinksetLink): Record<string, unknown> {
	let target: Record<string, unknown> = { href: link.href };
	for (let name of SINGLE_ATTRIBUTES) {
		if (link[name] !== undefined) target[name] = link[name];
	}
	if (link.hreflang !== undefined) target.hreflang = link.hreflang;
	for (let [name, values] of Object.entries(link.internationalized ?? {})) {
		target[`${name}*`] = values.map((value) =>
			value.language === undefined
				? { value: value.value }
				: { value: value.value, language: value.language },
		);
	}
	for (let [name, values] of Object.entries(link.extensions ?? {})) target[name] = values;
	return target;
}

/**
 * Writes links as an `application/linkset+json` document: one link context object per
 * anchor and one member per relation type, both in order of first appearance.
 *
 * @param links - The links to write.
 * @example stringifyJson(parse(response.headers.get("Link"), { context: response.url }))
 */
export function stringifyJson(links: readonly LinksetLink[]): string {
	let contexts = new Map<string | undefined, Record<string, unknown>>();

	for (let link of links) {
		let context = contexts.get(link.anchor);
		if (context === undefined) {
			context = link.anchor === undefined ? {} : { anchor: link.anchor };
			contexts.set(link.anchor, context);
		}
		let targets = (context[link.rel] ??= []) as unknown[];
		targets.push(writeTargetObject(link));
	}

	return JSON.stringify({ linkset: [...contexts.values()] });
}

/**
 * Whether a decoded value is a plain JSON object.
 *
 * @param value - Any decoded JSON value.
 */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads an internationalized attribute's array of `{ value, language }` objects,
 * reporting each entry that is not one.
 *
 * @param value - The member's value.
 * @param at - The member's path, for issues.
 * @param issues - Where problems are collected.
 */
function readInternationalized(
	value: unknown,
	at: Array<string | number>,
	issues: LinksetParseError.Issue[],
): InternationalizedValue[] {
	if (!Array.isArray(value)) {
		issues.push({ at: pointer(at), message: "An internationalized attribute must be an array." });
		return [];
	}
	let values: InternationalizedValue[] = [];
	for (let [index, entry] of value.entries()) {
		let language = isObject(entry) ? entry.language : undefined;
		if (
			!isObject(entry) ||
			typeof entry.value !== "string" ||
			(language !== undefined && typeof language !== "string")
		) {
			issues.push({
				at: pointer([...at, index]),
				message: "An internationalized value must be an object with a string value and language.",
			});
			continue;
		}
		values.push(language === undefined ? { value: entry.value } : { value: entry.value, language });
	}
	return values;
}

/**
 * Reads one link target object into a link. An extension attribute given as a bare string,
 * as the RFC's own Figure 10 writes `datetime`, reads as one value; any other shape is an
 * extension of another kind, which RFC 9264 §4.2.5 lets a reader ignore.
 *
 * @param value - The target object.
 * @param base - The link's context and relation type.
 * @param at - The object's path, for issues.
 * @param issues - Where problems are collected.
 */
function readTargetObject(
	value: unknown,
	base: Pick<LinksetLink, "anchor" | "rel">,
	at: Array<string | number>,
	issues: LinksetParseError.Issue[],
): LinksetLink | null {
	if (!isObject(value)) {
		issues.push({ at: pointer(at), message: "A link target must be an object." });
		return null;
	}
	if (typeof value.href !== "string") {
		issues.push({
			at: pointer([...at, "href"]),
			message: "A link target must have a string href.",
		});
		return null;
	}

	let link: LinksetLink = { ...base, href: value.href };
	for (let [name, member] of Object.entries(value)) {
		if (name === "href") continue;
		if (name === "hreflang") {
			if (Array.isArray(member) && member.every((tag) => typeof tag === "string")) {
				link.hreflang = member;
			} else {
				issues.push({
					at: pointer([...at, name]),
					message: "hreflang must be an array of strings.",
				});
			}
		} else if ((SINGLE_ATTRIBUTES as readonly string[]).includes(name)) {
			if (typeof member === "string") link[name as (typeof SINGLE_ATTRIBUTES)[number]] = member;
			else issues.push({ at: pointer([...at, name]), message: `${name} must be a string.` });
		} else if (name.endsWith("*")) {
			link.internationalized ??= {};
			link.internationalized[name.slice(0, -1)] = readInternationalized(
				member,
				[...at, name],
				issues,
			);
		} else if (typeof member === "string") {
			link.extensions ??= {};
			link.extensions[name] = [member];
		} else if (Array.isArray(member) && member.every((entry) => typeof entry === "string")) {
			link.extensions ??= {};
			link.extensions[name] = member;
		}
	}
	return link;
}

/**
 * Reads every link of one link context object: each member besides `anchor` is a relation
 * type whose value is an array of target objects, even when it holds one.
 *
 * @param value - The context object.
 * @param at - The object's path, for issues.
 * @param issues - Where problems are collected.
 */
function readContextObject(
	value: unknown,
	at: Array<string | number>,
	issues: LinksetParseError.Issue[],
): LinksetLink[] {
	if (!isObject(value)) {
		issues.push({ at: pointer(at), message: "A link context must be an object." });
		return [];
	}
	let anchor = value.anchor;
	if (anchor !== undefined && typeof anchor !== "string") {
		issues.push({ at: pointer([...at, "anchor"]), message: "anchor must be a string." });
		return [];
	}

	let links: LinksetLink[] = [];
	for (let [rel, targets] of Object.entries(value)) {
		if (rel === "anchor") continue;
		if (!Array.isArray(targets)) {
			issues.push({
				at: pointer([...at, rel]),
				message: `The "${rel}" links must be an array of link target objects.`,
			});
			continue;
		}
		let base = anchor === undefined ? { rel } : { anchor, rel };
		for (let [index, target] of targets.entries()) {
			let link = readTargetObject(target, base, [...at, rel, index], issues);
			if (link !== null) links.push(link);
		}
	}
	return links;
}

/**
 * Reads an `application/linkset+json` document into links, in document order. Members
 * besides `linkset` at the top level, such as a JSON-LD `@context`, are ignored.
 *
 * @param text - The served JSON.
 * @returns The links, or every place the document breaks RFC 9264.
 * @example let links = parseJson(await response.text());
 */
export function parseJson(text: string): Result<LinksetLink[], LinksetParseError> {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return failure(new LinksetParseError([{ at: "", message: "The document is not valid JSON." }]));
	}
	if (!isObject(json)) {
		return failure(new LinksetParseError([{ at: "", message: "The document must be an object." }]));
	}
	if (!Array.isArray(json.linkset)) {
		return failure(
			new LinksetParseError([
				{ at: "/linkset", message: "The document must have a linkset array." },
			]),
		);
	}

	let issues: LinksetParseError.Issue[] = [];
	let links = json.linkset.flatMap((context, index) =>
		readContextObject(context, ["linkset", index], issues),
	);
	if (issues.length > 0) return failure(new LinksetParseError(issues));
	return success(links);
}
