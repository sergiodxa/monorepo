/**
 * The wire variations of compacted ActivityStreams, each read into one shape: single
 * values or arrays, IRIs or embedded objects, plain or language-mapped text, and every
 * spelling of the public collection. JSON-LD is never expanded, so no context is fetched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Issue, Schema } from "remix/data-schema";

import { createIssue, createSchema, fail } from "remix/data-schema";

import type { ActivityPub } from "./types.js";

import { PUBLIC } from "./constants.js";

/** The path and options data-schema hands a validator, read to place nested issues. */
export type Context = Parameters<Parameters<typeof createSchema>[0]>[1];

/** A decoded JSON object, read member by member. */
export type JsonObject = Record<string, unknown>;

/** The compact spellings senders use for the public collection, besides the full IRI. */
const PUBLIC_ALIASES = new Set(["as:Public", "Public", PUBLIC]);

/** The attachment types that carry a file; Mastodon sends `Document`, others the specific type. */
const MEDIA_TYPES = new Set<ActivityPub.Media["type"]>(["Document", "Image", "Video", "Audio"]);

/**
 * Whether a decoded value is a plain JSON object.
 *
 * @param value - Any decoded JSON value.
 */
export function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Runs a schema on a member, so its issues point at that member.
 *
 * @param schema - The member's schema.
 * @param value - The member's value.
 * @param context - The enclosing value's context.
 * @param key - The member name or array index.
 * @template Output - What the schema produces.
 */
export function runAt<Output>(
	schema: Schema<unknown, Output>,
	value: unknown,
	context: Context,
	key: string | number,
): { value: Output; issues?: undefined } | { issues: readonly Issue[] } {
	let result = schema["~run"](value, { path: [...context.path, key], options: context.options });
	if (result.issues !== undefined) return { issues: result.issues };
	return { value: result.value };
}

/**
 * The public collection's IRI for any spelling of it; every other IRI unchanged.
 *
 * @param iri - An addressing entry.
 */
export function normalizePublic(iri: string): string {
	return PUBLIC_ALIASES.has(iri) ? PUBLIC : iri;
}

/**
 * The values of a member that may be a single value or an array, as an array.
 *
 * @param value - The member's value; `undefined` and `null` read as empty.
 */
function many(value: unknown): unknown[] {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

/**
 * The IRI an entry names: itself when a string, its `id` when an embedded object, or its
 * `href` when a `Link`.
 *
 * @param value - An IRI, an embedded object, or a Link.
 */
function iriOf(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (!isObject(value)) return null;
	if (typeof value.id === "string") return value.id;
	if (typeof value.href === "string") return value.href;
	return null;
}

/**
 * An absolute IRI, which a document's `id` must be: every ownership check compares its
 * origin, and a relative one has none.
 *
 * @param label - The member, for the message.
 */
export function absoluteIri(label: string): Schema<unknown, string> {
	return createSchema<unknown, string>((value, context) => {
		if (typeof value !== "string") return fail(`"${label}" must be a string IRI.`, context.path);
		if (!URL.canParse(value)) return fail(`"${label}" must be an absolute IRI.`, context.path);
		return { value };
	});
}

/**
 * An absolute IRI that may be absent, `null` then.
 *
 * @param label - The member, for the message.
 */
export function optionalAbsoluteIri(label: string): Schema<unknown, string | null> {
	let required = absoluteIri(label);
	return createSchema<unknown, string | null>((value, context) => {
		if (value === undefined || value === null) return { value: null };
		return required["~run"](value, context);
	});
}

/**
 * A `type` sent as a string or an array, read as one name: the first a caller knows,
 * else the first listed. An `as:` prefix is dropped, since it names the same term.
 *
 * @param known - Type names to prefer when several are listed.
 */
export function documentType(known: ReadonlySet<string>): Schema<unknown, string> {
	return createSchema<unknown, string>((value, context) => {
		let names = many(value)
			.filter((entry): entry is string => typeof entry === "string")
			.map((name) => (name.startsWith("as:") ? name.slice(3) : name));
		let first = names.find((name) => known.has(name)) ?? names[0];
		if (first === undefined) return fail('"type" must name the document\'s type.', context.path);
		return { value: first };
	});
}

/**
 * A list of IRIs sent as one entry or an array, each an IRI or an embedded object, read
 * as the IRIs alone. With `addressing`, every spelling of the public collection reads
 * as `PUBLIC`.
 *
 * @param options - Whether the list addresses an audience.
 */
export function iris(options: { addressing?: boolean } = {}): Schema<unknown, string[]> {
	return createSchema<unknown, string[]>((value, context) => {
		let issues: Issue[] = [];
		let result: string[] = [];
		let entries = many(value);
		for (let [index, entry] of entries.entries()) {
			let iri = iriOf(entry);
			if (iri === null) {
				let at = Array.isArray(value) ? [...context.path, index] : context.path;
				issues.push(createIssue("An entry must be an IRI or an object with an id.", at));
				continue;
			}
			result.push(options.addressing ? normalizePublic(iri) : iri);
		}
		if (issues.length > 0) return { issues };
		return { value: result };
	});
}

/**
 * One reference read as its IRI: a string, an embedded object's `id`, a Link's `href`, or
 * the first of an array. Absent reads as `null`; with `required`, absent fails.
 *
 * @param options - Whether the member must be present, and its name for the message.
 */
export function iri(options: { required: true; label: string }): Schema<unknown, string>;
export function iri(options?: { required?: false; label?: string }): Schema<unknown, string | null>;
export function iri(
	options: { required?: boolean; label?: string } = {},
): Schema<unknown, string | null> {
	return createSchema<unknown, string | null>((value, context) => {
		let entries = many(value);
		if (entries.length === 0) {
			if (!options.required) return { value: null };
			return fail(`"${options.label ?? "member"}" is required.`, context.path);
		}
		let first = iriOf(entries[0]);
		if (first === null) {
			return fail("The reference must be an IRI or an object with an id.", context.path);
		}
		return { value: first };
	});
}

/** Text that may be absent: a string, or `null` when absent. */
export function text(): Schema<unknown, string | null> {
	return createSchema<unknown, string | null>((value, context) => {
		if (value === undefined || value === null) return { value: null };
		if (typeof value !== "string") return fail("The value must be a string.", context.path);
		return { value };
	});
}

/** A language map (`contentMap`, `nameMap`, `summaryMap`), empty when absent. */
export function languageMap(): Schema<unknown, Record<string, string>> {
	return createSchema<unknown, Record<string, string>>((value, context) => {
		if (value === undefined || value === null) return { value: {} };
		if (!isObject(value)) return fail("A language map must be an object.", context.path);
		let issues: Issue[] = [];
		let result: Record<string, string> = {};
		for (let [language, entry] of Object.entries(value)) {
			if (typeof entry === "string") result[language] = entry;
			else
				issues.push(
					createIssue("A language map value must be a string.", [...context.path, language]),
				);
		}
		if (issues.length > 0) return { issues };
		return { value: result };
	});
}

/**
 * The plain value of a text member, falling back to the first entry of its language map
 * when a sender sent only the map.
 *
 * @param plain - The plain value.
 * @param map - The language map.
 */
export function withMapFallback(plain: string | null, map: Record<string, string>): string | null {
	if (plain !== null) return plain;
	return Object.values(map)[0] ?? null;
}

/**
 * The links a `url` member offers, each with its media type when the sender gave one.
 *
 * @param value - A string, a `Link`, or an array of either.
 */
function linksOf(value: unknown): Array<{ href: string; mediaType: string | null }> {
	let links: Array<{ href: string; mediaType: string | null }> = [];
	for (let entry of many(value)) {
		if (typeof entry === "string") links.push({ href: entry, mediaType: null });
		else if (isObject(entry) && typeof entry.href === "string") {
			let mediaType = typeof entry.mediaType === "string" ? entry.mediaType : null;
			links.push({ href: entry.href, mediaType });
		}
	}
	return links;
}

/**
 * A `url` sent as a string, a `Link` or an array of them, read as the page a person
 * opens: the first `text/html` link, else the first link. A member that names no link
 * at all reads as `null`.
 */
export function htmlUrl(): Schema<unknown, string | null> {
	return createSchema<unknown, string | null>((value, context) => {
		if (value === undefined || value === null) return { value: null };
		if (typeof value !== "string" && typeof value !== "object") {
			return fail('"url" must be a string, a Link or an array of them.', context.path);
		}
		let links = linksOf(value);
		let html = links.find((link) => link.mediaType?.split(";")[0]?.trim() === "text/html");
		return { value: (html ?? links[0])?.href ?? null };
	});
}

/** An ISO 8601 date, `null` when absent. */
export function date(): Schema<unknown, Date | null> {
	return createSchema<unknown, Date | null>((value, context) => {
		if (value === undefined || value === null) return { value: null };
		if (typeof value !== "string") return fail("A date must be an ISO 8601 string.", context.path);
		let parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return fail("The date is not valid.", context.path);
		return { value: parsed };
	});
}

/** A boolean flag, `false` when absent. */
export function flag(): Schema<unknown, boolean> {
	return createSchema<unknown, boolean>((value, context) => {
		if (value === undefined || value === null) return { value: false };
		if (typeof value !== "boolean") return fail("The flag must be a boolean.", context.path);
		return { value };
	});
}

/** A count such as `totalItems`, `null` when absent. */
export function count(): Schema<unknown, number | null> {
	return createSchema<unknown, number | null>((value, context) => {
		if (value === undefined || value === null) return { value: null };
		if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
			return fail("A count must be a non-negative integer.", context.path);
		}
		return { value };
	});
}

/**
 * A string member of an embedded object, or `null`.
 *
 * @param body - The embedded object.
 * @param member - The member name.
 */
function stringOf(body: JsonObject, member: string): string | null {
	let value = body[member];
	return typeof value === "string" ? value : null;
}

/**
 * A positive integer member of an embedded object, or `null`.
 *
 * @param body - The embedded object.
 * @param member - The member name.
 */
function dimensionOf(body: JsonObject, member: string): number | null {
	let value = body[member];
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * A date member of an embedded object, or `null` when absent or invalid.
 *
 * @param body - The embedded object.
 * @param member - The member name.
 */
function dateOf(body: JsonObject, member: string): Date | null {
	let value = body[member];
	if (typeof value !== "string") return null;
	let parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The type names an embedded value lists, `as:` prefixes dropped.
 *
 * @param body - The embedded object.
 */
function typesOf(body: JsonObject): string[] {
	return many(body.type)
		.filter((entry): entry is string => typeof entry === "string")
		.map((name) => (name.startsWith("as:") ? name.slice(3) : name));
}

/**
 * An image sent as a string URL or an `Image` object (or an array of them), read as an
 * `Image`. A value that names no URL reads as `null`.
 *
 * @param value - The member's value.
 */
export function readImage(value: unknown): ActivityPub.Image | null {
	for (let entry of many(value)) {
		if (typeof entry === "string") return { type: "Image", url: entry, mediaType: null };
		if (!isObject(entry)) continue;
		let link = linksOf(entry.url)[0];
		if (link === undefined) continue;
		let mediaType = stringOf(entry, "mediaType") ?? link.mediaType;
		return { type: "Image", url: link.href, mediaType };
	}
	return null;
}

/** An `icon` or `image`, `null` when absent or naming no URL. */
export function image(): Schema<unknown, ActivityPub.Image | null> {
	return createSchema<unknown, ActivityPub.Image | null>((value) => ({ value: readImage(value) }));
}

/**
 * One `tag` entry, or `null` for a type this package does not model or an entry that
 * lacks what its type requires.
 *
 * @param entry - The decoded entry.
 */
function readTag(entry: unknown): ActivityPub.Tag | null {
	if (!isObject(entry)) return null;
	let types = typesOf(entry);
	if (types.includes("Hashtag")) {
		let name = stringOf(entry, "name");
		if (name === null) return null;
		return { type: "Hashtag", name, href: stringOf(entry, "href") };
	}
	if (types.includes("Mention")) {
		let href = stringOf(entry, "href");
		if (href === null) return null;
		return { type: "Mention", href, name: stringOf(entry, "name") };
	}
	if (types.includes("Emoji")) {
		let name = stringOf(entry, "name");
		let icon = readImage(entry.icon);
		if (name === null || icon === null) return null;
		return {
			type: "Emoji",
			id: stringOf(entry, "id"),
			name,
			icon,
			updated: dateOf(entry, "updated"),
		};
	}
	return null;
}

/**
 * `tag` entries this package models: hashtags, mentions and custom emoji. Entries of
 * other types, and entries missing what their type requires, are dropped, since a tag
 * decorates an object and never decides whether it can be read.
 */
export function tags(): Schema<unknown, ActivityPub.Tag[]> {
	return createSchema<unknown, ActivityPub.Tag[]>((value) => ({
		value: many(value)
			.map(readTag)
			.filter((tag) => tag !== null),
	}));
}

/**
 * A `focalPoint` as two finite coordinates, or `null`.
 *
 * @param value - The decoded member.
 */
function focalPointOf(value: unknown): [number, number] | null {
	if (!Array.isArray(value) || value.length !== 2) return null;
	let [x, y] = value;
	if (typeof x !== "number" || typeof y !== "number") return null;
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return [x, y];
}

/**
 * One `attachment` entry, or `null` for a type this package does not model or an entry
 * that lacks what its type requires.
 *
 * @param entry - The decoded entry.
 */
function readAttachment(entry: unknown): ActivityPub.Attachment | null {
	if (!isObject(entry)) return null;
	let types = typesOf(entry);
	if (types.includes("PropertyValue")) {
		let name = stringOf(entry, "name");
		let value = stringOf(entry, "value");
		if (name === null || value === null) return null;
		return { type: "PropertyValue", name, value };
	}
	let type = types.find((name): name is ActivityPub.Media["type"] =>
		MEDIA_TYPES.has(name as ActivityPub.Media["type"]),
	);
	if (type === undefined) return null;
	let links = linksOf(entry.url);
	let link = links[0];
	if (link === undefined) return null;
	return {
		type,
		url: link.href,
		mediaType: stringOf(entry, "mediaType") ?? link.mediaType,
		name: stringOf(entry, "name"),
		blurhash: stringOf(entry, "blurhash"),
		width: dimensionOf(entry, "width"),
		height: dimensionOf(entry, "height"),
		focalPoint: focalPointOf(entry.focalPoint),
	};
}

/**
 * `attachment` entries this package models: media files and profile fields. Other
 * entries are dropped, for the same reason as tags.
 */
export function attachments(): Schema<unknown, ActivityPub.Attachment[]> {
	return createSchema<unknown, ActivityPub.Attachment[]>((value) => ({
		value: many(value)
			.map(readAttachment)
			.filter((attachment) => attachment !== null),
	}));
}

/**
 * FEP-8b32 proofs, sent as one object or a set. An entry that is not a complete
 * `DataIntegrityProof` is dropped, so verification treats the document as unproven.
 */
export function proofs(): Schema<unknown, ActivityPub.Proof[]> {
	return createSchema<unknown, ActivityPub.Proof[]>((value) => {
		let result: ActivityPub.Proof[] = [];
		for (let entry of many(value)) {
			if (!isObject(entry) || !typesOf(entry).includes("DataIntegrityProof")) continue;
			let cryptosuite = stringOf(entry, "cryptosuite");
			let verificationMethod = iriOf(entry.verificationMethod);
			let proofPurpose = stringOf(entry, "proofPurpose");
			let proofValue = stringOf(entry, "proofValue");
			if (!cryptosuite || !verificationMethod || !proofPurpose || !proofValue) continue;
			result.push({
				type: "DataIntegrityProof",
				cryptosuite,
				verificationMethod,
				proofPurpose,
				proofValue,
				created: dateOf(entry, "created"),
			});
		}
		return { value: result };
	});
}

/** FEP-521a `Multikey` entries of `assertionMethod`; other verification methods are dropped. */
export function multikeys(): Schema<unknown, ActivityPub.Multikey[]> {
	return createSchema<unknown, ActivityPub.Multikey[]>((value) => {
		let result: ActivityPub.Multikey[] = [];
		for (let entry of many(value)) {
			if (!isObject(entry) || !typesOf(entry).includes("Multikey")) continue;
			let id = stringOf(entry, "id");
			let controller = stringOf(entry, "controller");
			let publicKeyMultibase = stringOf(entry, "publicKeyMultibase");
			if (!id || !controller || !publicKeyMultibase) continue;
			result.push({ id, type: "Multikey", controller, publicKeyMultibase });
		}
		return { value: result };
	});
}

/**
 * An actor's `publicKey`, sent as one object or an array whose first complete entry is
 * read. A key present but missing `id`, `owner` or `publicKeyPem` fails, since no
 * signature from the actor could verify against it.
 */
export function publicKey(): Schema<unknown, ActivityPub.PublicKey | null> {
	return createSchema<unknown, ActivityPub.PublicKey | null>((value, context) => {
		let entries = many(value);
		if (entries.length === 0) return { value: null };
		for (let entry of entries) {
			if (!isObject(entry)) continue;
			let id = stringOf(entry, "id");
			let owner = iriOf(entry.owner);
			let publicKeyPem = stringOf(entry, "publicKeyPem");
			if (id && owner && publicKeyPem) return { value: { id, owner, publicKeyPem } };
		}
		return fail('"publicKey" must have an id, an owner and a publicKeyPem.', context.path);
	});
}

/** An actor's `endpoints`, whose `sharedInbox` is `null` when absent. */
export function endpoints(): Schema<unknown, ActivityPub.Endpoints> {
	return createSchema<unknown, ActivityPub.Endpoints>((value, context) => {
		if (value === undefined || value === null) return { value: { sharedInbox: null } };
		if (!isObject(value)) return fail('"endpoints" must be an object.', context.path);
		return { value: { sharedInbox: iriOf(value.sharedInbox) } };
	});
}
