/**
 * Reads untrusted JSON into the `ActivityPub` vocabulary through `remix/data-schema`,
 * one schema per document kind, so every inbound activity, actor, object and collection
 * is validated and normalized before anything reads a member of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { Issue, Schema } from "remix/data-schema";

import { failure, success } from "@sdxc/result";
import { createSchema, fail, object, parseSafe } from "remix/data-schema";
import { lazy } from "remix/data-schema/lazy";

import { ActivityPubParseError } from "../errors.js";

import type { Context } from "./compact.js";
import type { ActivityPub } from "./types.js";

import {
	absoluteIri,
	attachments,
	optionalAbsoluteIri,
	count,
	date,
	documentType,
	endpoints,
	flag,
	htmlUrl,
	image,
	iri,
	iris,
	isObject,
	languageMap,
	multikeys,
	proofs,
	publicKey,
	runAt,
	tags,
	text,
	withMapFallback,
} from "./compact.js";
import { ACTIVITY_TYPES, ACTOR_TYPES } from "./constants.js";

/** Actor types, for telling an embedded actor from any other embedded object. */
const ACTOR_TYPE_SET = new Set<string>(ACTOR_TYPES);

/** The collection types, each read by its own schema. */
const COLLECTION_TYPES = new Set([
	"Collection",
	"CollectionPage",
	"OrderedCollection",
	"OrderedCollectionPage",
]);

/**
 * Types preferred when a sender lists several, so `["Note", "x:Custom"]` reads as `Note`
 * whatever order the sender chose.
 */
const KNOWN_TYPES = new Set<string>([
	...ACTIVITY_TYPES,
	...ACTOR_TYPES,
	...COLLECTION_TYPES,
	"Article",
	"Audio",
	"Document",
	"Event",
	"Image",
	"Note",
	"Page",
	"Place",
	"Profile",
	"Relationship",
	"Tombstone",
	"Video",
]);

/** The members every object shares, under their wire names. */
const OBJECT_SHAPE = {
	id: absoluteIri("id"),
	type: documentType(KNOWN_TYPES),
	attributedTo: iris(),
	to: iris({ addressing: true }),
	cc: iris({ addressing: true }),
	bto: iris({ addressing: true }),
	bcc: iris({ addressing: true }),
	name: text(),
	nameMap: languageMap(),
	summary: text(),
	summaryMap: languageMap(),
	content: text(),
	contentMap: languageMap(),
	url: htmlUrl(),
	inReplyTo: iri(),
	quote: iri(),
	quoteUrl: iri(),
	quoteUri: iri(),
	_misskey_quote: iri(),
	published: date(),
	updated: date(),
	sensitive: flag(),
	tag: tags(),
	attachment: attachments(),
	proof: proofs(),
};

/** What `OBJECT_SHAPE` validates to, before its wire names are folded. */
type ObjectWire = {
	[K in keyof typeof OBJECT_SHAPE]: (typeof OBJECT_SHAPE)[K] extends Schema<unknown, infer O>
		? O
		: never;
};

/**
 * Folds the wire variations into the API shape: plain text from a language map when
 * only the map was sent, and one `quote` from whichever of its four names arrived.
 *
 * @param wire - The validated members.
 */
function toObject(wire: ObjectWire): ActivityPub.Object {
	return {
		id: wire.id,
		type: wire.type,
		attributedTo: wire.attributedTo,
		to: wire.to,
		cc: wire.cc,
		bto: wire.bto,
		bcc: wire.bcc,
		name: withMapFallback(wire.name, wire.nameMap),
		nameMap: wire.nameMap,
		summary: withMapFallback(wire.summary, wire.summaryMap),
		summaryMap: wire.summaryMap,
		content: withMapFallback(wire.content, wire.contentMap),
		contentMap: wire.contentMap,
		url: wire.url,
		inReplyTo: wire.inReplyTo,
		quote: wire.quote ?? wire.quoteUrl ?? wire.quoteUri ?? wire._misskey_quote,
		published: wire.published,
		updated: wire.updated,
		sensitive: wire.sensitive,
		tag: wire.tag,
		attachment: wire.attachment,
		proof: wire.proof,
	};
}

/** Any object, its type kept whatever it is. */
const OBJECT_SCHEMA: Schema<unknown, ActivityPub.Object> = object(OBJECT_SHAPE).transform(toObject);

/**
 * An embedded entry (an activity's `object`, a collection item) read as what it is: an
 * IRI, an activity when it names an `actor`, an actor when its type is one, else an object.
 */
const ITEM_SCHEMA: Schema<unknown, ActivityPub.Item> = createSchema<unknown, ActivityPub.Item>(
	(value, context) => {
		if (typeof value === "string") return { value };
		if (!isObject(value)) {
			return fail("An entry must be an IRI or an embedded object.", context.path);
		}
		return schemaFor(value)["~run"](value, context);
	},
);

/** An activity's `object`: the first entry when an array was sent, `null` when absent. */
const ACTIVITY_OBJECT_SCHEMA: Schema<unknown, ActivityPub.Item | null> = createSchema<
	unknown,
	ActivityPub.Item | null
>((value, context) => {
	if (value === undefined || value === null) return { value: null };
	if (!Array.isArray(value)) return ITEM_SCHEMA["~run"](value, context);
	if (value.length === 0) return { value: null };
	return runAt(ITEM_SCHEMA, value[0], context, 0);
});

/** An activity. Its type may be any name, so an app can acknowledge one it does not handle. */
const ACTIVITY_SCHEMA: Schema<unknown, ActivityPub.Activity> = object({
	...OBJECT_SHAPE,
	actor: iri({ required: true, label: "actor" }),
	object: lazy(() => ACTIVITY_OBJECT_SCHEMA),
	target: iri(),
	_misskey_reaction: text(),
}).transform(({ actor, object, target, _misskey_reaction, ...wire }): ActivityPub.Activity => {
	let base = toObject(wire);
	return { ...base, content: base.content ?? _misskey_reaction, actor, object, target };
});

/** An actor, whose `inbox` and `preferredUsername` Mastodon requires to follow it. */
const ACTOR_SCHEMA: Schema<unknown, ActivityPub.Actor> = object({
	...OBJECT_SHAPE,
	type: documentType(KNOWN_TYPES).refine(
		(type) => ACTOR_TYPE_SET.has(type),
		`"type" must be one of ${ACTOR_TYPES.join(", ")}.`,
	),
	preferredUsername: createSchema<unknown, string>((value, context) =>
		typeof value === "string" && value !== ""
			? { value }
			: fail('"preferredUsername" is required.', context.path),
	),
	inbox: absoluteIri("inbox"),
	outbox: iri(),
	followers: iri(),
	following: iri(),
	featured: iri(),
	endpoints: endpoints(),
	publicKey: publicKey(),
	assertionMethod: multikeys(),
	alsoKnownAs: iris(),
	movedTo: iri(),
	manuallyApprovesFollowers: flag(),
	discoverable: flag(),
	indexable: flag(),
	icon: image(),
	image: image(),
}).transform(
	({
		type,
		preferredUsername,
		inbox,
		outbox,
		followers,
		following,
		featured,
		endpoints,
		publicKey,
		assertionMethod,
		alsoKnownAs,
		movedTo,
		manuallyApprovesFollowers,
		discoverable,
		indexable,
		icon,
		image,
		...wire
	}): ActivityPub.Actor => ({
		...toObject({ ...wire, type }),
		type: type as ActivityPub.ActorType,
		preferredUsername,
		inbox,
		outbox,
		followers,
		following,
		featured,
		endpoints,
		publicKey,
		assertionMethod,
		alsoKnownAs,
		movedTo,
		manuallyApprovesFollowers,
		discoverable,
		indexable,
		icon,
		image,
	}),
);

/**
 * The schema an embedded object is read with. An actor type without an `inbox` reads
 * as a plain object, since some servers embed a partial actor in an activity.
 *
 * @param value - The embedded object.
 */
function schemaFor(value: Record<string, unknown>): Schema<unknown, ActivityPub.Item> {
	if (value.actor !== undefined) return ACTIVITY_SCHEMA;
	let types = Array.isArray(value.type) ? value.type : [value.type];
	if (types.some((type) => ACTOR_TYPE_SET.has(String(type))) && value.inbox !== undefined) {
		return ACTOR_SCHEMA;
	}
	return OBJECT_SCHEMA;
}

/** Collection entries, sent as one entry or an array; each must read. */
const ITEMS_SCHEMA: Schema<unknown, ActivityPub.Item[]> = createSchema<unknown, ActivityPub.Item[]>(
	(value, context) => {
		if (value === undefined || value === null) return { value: [] };
		if (!Array.isArray(value)) {
			let single = ITEM_SCHEMA["~run"](value, context);
			return single.issues ? single : { value: [single.value] };
		}
		let items: ActivityPub.Item[] = [];
		let issues: Issue[] = [];
		for (let [index, entry] of value.entries()) {
			let result = runAt(ITEM_SCHEMA, entry, context, index);
			if (result.issues) issues.push(...result.issues);
			else items.push(result.value);
		}
		return issues.length > 0 ? { issues } : { value: items };
	},
);

/** The members a page of either kind has besides its items. */
const PAGE_SHAPE = {
	id: optionalAbsoluteIri("id"),
	partOf: iri(),
	next: iri(),
	prev: iri(),
	totalItems: count(),
};

/** A collection's `first`: an IRI, or the first page embedded, as Mastodon does for replies. */
const FIRST_PAGE_SCHEMA: Schema<
	unknown,
	ActivityPub.Ref<ActivityPub.CollectionPage | ActivityPub.OrderedCollectionPage> | null
> = createSchema<
	unknown,
	ActivityPub.Ref<ActivityPub.CollectionPage | ActivityPub.OrderedCollectionPage> | null
>((value, context) => {
	if (value === undefined || value === null) return { value: null };
	if (typeof value === "string") return { value };
	return PAGE_SCHEMA["~run"](value, context);
});

/** Either page shape, chosen by `type`. */
const PAGE_SCHEMA: Schema<unknown, ActivityPub.CollectionPage | ActivityPub.OrderedCollectionPage> =
	createSchema<unknown, ActivityPub.CollectionPage | ActivityPub.OrderedCollectionPage>(
		(value, context) => {
			if (!isObject(value)) return fail("A page must be an object.", context.path);
			let type = Array.isArray(value.type) ? value.type : [value.type];
			if (type.includes("OrderedCollectionPage")) {
				return ORDERED_PAGE_SCHEMA["~run"](value, context);
			}
			if (type.includes("CollectionPage")) return UNORDERED_PAGE_SCHEMA["~run"](value, context);
			return fail('"type" must be CollectionPage or OrderedCollectionPage.', [
				...context.path,
				"type",
			]);
		},
	);

/** An unordered page. */
const UNORDERED_PAGE_SCHEMA: Schema<unknown, ActivityPub.CollectionPage> = object({
	...PAGE_SHAPE,
	items: ITEMS_SCHEMA,
}).transform((page) => ({ ...page, type: "CollectionPage" as const }));

/** An ordered page. */
const ORDERED_PAGE_SCHEMA: Schema<unknown, ActivityPub.OrderedCollectionPage> = object({
	...PAGE_SHAPE,
	orderedItems: ITEMS_SCHEMA,
}).transform((page) => ({ ...page, type: "OrderedCollectionPage" as const }));

/** The members a collection of either kind has besides its items. */
const COLLECTION_SHAPE = {
	id: absoluteIri("id"),
	totalItems: count(),
	first: FIRST_PAGE_SCHEMA,
	last: iri(),
};

/** An unordered collection. */
const UNORDERED_COLLECTION_SCHEMA: Schema<unknown, ActivityPub.Collection> = object({
	...COLLECTION_SHAPE,
	items: ITEMS_SCHEMA,
}).transform((collection) => ({ ...collection, type: "Collection" as const }));

/** An ordered collection. */
const ORDERED_COLLECTION_SCHEMA: Schema<unknown, ActivityPub.OrderedCollection> = object({
	...COLLECTION_SHAPE,
	orderedItems: ITEMS_SCHEMA,
}).transform((collection) => ({ ...collection, type: "OrderedCollection" as const }));

/** Any of the four collection shapes, chosen by `type`. */
const COLLECTION_SCHEMA: Schema<unknown, ActivityPub.AnyCollection> = createSchema<
	unknown,
	ActivityPub.AnyCollection
>((value, context) => {
	if (!isObject(value)) return fail("A collection must be an object.", context.path);
	let types = Array.isArray(value.type) ? value.type : [value.type];
	if (types.includes("OrderedCollection")) {
		return ORDERED_COLLECTION_SCHEMA["~run"](value, context);
	}
	if (types.includes("Collection")) return UNORDERED_COLLECTION_SCHEMA["~run"](value, context);
	if (types.includes("OrderedCollectionPage") || types.includes("CollectionPage")) {
		return PAGE_SCHEMA["~run"](value, context);
	}
	return fail('"type" must be a collection or collection page type.', [...context.path, "type"]);
});

/**
 * A JSON Pointer (RFC 6901) from a data-schema issue path, escaping `~` and `/` so a
 * member name holding either still points at itself.
 *
 * @param path - The issue's path, outermost first.
 */
function pointerOf(path: Context["path"] | undefined): string {
	return (path ?? [])
		.map((segment) => (typeof segment === "object" ? segment.key : segment))
		.map((segment) => `/${String(segment).replace(/~/g, "~0").replace(/\//g, "~1")}`)
		.join("");
}

/**
 * Validates a decoded document, answering every issue with a pointer into it.
 *
 * @param schema - The document kind's schema.
 * @param kind - The document kind, for the error.
 * @param json - The decoded JSON.
 * @template Output - What the schema produces.
 */
function read<Output>(
	schema: Schema<unknown, Output>,
	kind: ActivityPubParseError.Kind,
	json: unknown,
): Result<Output, ActivityPubParseError> {
	if (!isObject(json)) {
		return failure(
			new ActivityPubParseError(kind, [{ at: "", message: "The document is not a JSON object." }]),
		);
	}
	let result = parseSafe(schema, json);
	if (result.success) return success(result.value);
	return failure(
		new ActivityPubParseError(
			kind,
			result.issues.map((issue) => ({ at: pointerOf(issue.path), message: issue.message })),
		),
	);
}

/**
 * Reads an activity from decoded JSON. It must have an absolute `id`, a `type` and an
 * `actor`; any type name is accepted, so a handler acknowledges one it does not model.
 *
 * @param json - The decoded body, as `JSON.parse` returns it.
 * @example
 * let activity = parseActivity(await request.json());
 * if (isFailure(activity)) return new Response(activity.error.message, { status: 400 });
 */
export function parseActivity(json: unknown): Result<ActivityPub.Activity, ActivityPubParseError> {
	return read(ACTIVITY_SCHEMA, "activity", json);
}

/**
 * Reads an actor from decoded JSON. It must be an actor type with an absolute `id`, a
 * `preferredUsername` and an `inbox`, since Mastodon cannot follow one without them.
 *
 * @param json - The decoded actor document.
 */
export function parseActor(json: unknown): Result<ActivityPub.Actor, ActivityPubParseError> {
	return read(ACTOR_SCHEMA, "actor", json);
}

/**
 * Reads any object from decoded JSON, keeping its `type` whatever it is; a deleted one
 * reads with `type: "Tombstone"`.
 *
 * @param json - The decoded object document.
 */
export function parseObject(json: unknown): Result<ActivityPub.Object, ActivityPubParseError> {
	return read(OBJECT_SCHEMA, "object", json);
}

/**
 * Reads a collection or a collection page from decoded JSON, with its `first` page
 * embedded or as an IRI, and every embedded item read as what it is.
 *
 * @param json - The decoded collection document.
 */
export function parseCollection(
	json: unknown,
): Result<ActivityPub.AnyCollection, ActivityPubParseError> {
	return read(COLLECTION_SCHEMA, "collection", json);
}
