/**
 * Decodes a Micropub POST into one typed operation. Form and multipart bodies are first
 * reshaped into the JSON shape (`h` into `type`, `name[]` into arrays), so both encodings
 * pass the same schemas and yield the same operation for the same post.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Schema } from "remix/data-schema";

import { ITEM_SCHEMA } from "@sdxc/microformats";
import { failure, isFailure, success } from "@sdxc/result";
import {
	any,
	array,
	defaulted,
	enum_,
	object,
	optional,
	parseSafe,
	record,
	string,
	union,
} from "remix/data-schema";

import type { Micropub } from "../index.js";

import { readBody } from "./body.js";
import { MicropubRequestError } from "./errors.js";
import { headerToken, requestToken } from "./token.js";

const DEFAULT_MAX_JSON_BYTES = 1_048_576;

/** The commands with a typed meaning; every other `mp-*` name lands in `Commands.other`. */
const KNOWN_COMMANDS = new Set(["mp-slug", "mp-syndicate-to", "post-status"]);

/** An absolute URL, which is how a post is identified to update, delete or read back. */
export const URL_SCHEMA: Schema<unknown, string> = string().refine(
	(value) => URL.canParse(value),
	"Expected an absolute URL",
);

/** A map of property names to value arrays, the shape `replace`, `add` and `properties` share. */
const VALUE_MAP_SCHEMA: Schema<unknown, Record<string, unknown[]>> = record(string(), array(any()));

/**
 * The outline of a create before its values are checked. A missing `type` is `h-entry`,
 * as the specification defaults it, and every type is an `h-*` name.
 */
const CREATE_SCHEMA = object({
	type: defaulted(
		array(string().refine((type) => /^h-.+/.test(type), "Expected an h-* type")).refine(
			(types) => types.length > 0,
			"Expected at least one type",
		),
		["h-entry"],
	),
	properties: VALUE_MAP_SCHEMA,
});

/** The commands with a typed meaning, each an array as every Micropub value is. */
const COMMANDS_SCHEMA = object({
	"mp-slug": optional(array(string())),
	"mp-syndicate-to": optional(array(string())),
	"post-status": optional(array(enum_(["published", "draft"] as const))),
});

/** An update: at least one of the three change sets, checked for being non-empty after parsing. */
const UPDATE_SCHEMA = object({
	url: URL_SCHEMA,
	replace: optional(VALUE_MAP_SCHEMA),
	add: optional(VALUE_MAP_SCHEMA),
	delete: optional(union([array(string()), VALUE_MAP_SCHEMA])),
});

/** A delete or an undelete, in either encoding. */
const ACTION_SCHEMA = object({
	action: enum_(["delete", "undelete"] as const),
	url: URL_SCHEMA,
});

/**
 * Decodes a POST into an operation and the access token sent with it. A GET is a query,
 * read by `parseQuery`. An update over a form body, an update naming no change, a JSON
 * body that is not an object and a token sent in two places are all `invalid_request`.
 *
 * @param request - The Micropub POST
 * @param options - The `FormData` a middleware already read, and the JSON size cap
 * @returns The operation with its token, or why the request is invalid
 */
export async function parseOperation(
	request: Request,
	options: Micropub.ParseOptions = {},
): Promise<Result<Micropub.Parsed<Micropub.Operation>, MicropubRequestError>> {
	let body = await readBody(
		request,
		options.formData,
		options.maxJsonBytes ?? DEFAULT_MAX_JSON_BYTES,
	);
	if (isFailure(body)) return body;
	let token =
		body.data.kind === "form" ? requestToken(request, body.data.formData) : headerToken(request);
	if (isFailure(token)) return token;
	let operation =
		body.data.kind === "form" ? fromForm(body.data.formData) : fromJSON(body.data.value);
	if (isFailure(operation)) return operation;
	return success({ body: operation.data, accessToken: token.data });
}

/**
 * The scopes any one of which authorizes the operation. A draft may be created with
 * `draft` or `create`, and an undelete with `undelete` or `delete`.
 */
export function requiredScopes(operation: Micropub.Operation): Micropub.Scope[] {
	switch (operation.action) {
		case "create":
			return operation.commands.status === "draft" ? ["draft", "create"] : ["create"];
		case "update":
			return ["update"];
		case "delete":
			return ["delete"];
		case "undelete":
			return ["undelete", "delete"];
	}
}

/**
 * Reshapes a form into the JSON shape. `name[]` and `name` collect into one array, files
 * go to `files` (an empty file input is dropped), `access_token` is never kept, and an
 * `action` makes the form a delete or undelete; updates exist only in JSON.
 */
function fromForm(formData: FormData): Result<Micropub.Operation, MicropubRequestError> {
	let fields: Record<string, string[]> = {};
	let files: Record<string, File[]> = {};
	for (let [rawName, value] of formData) {
		if (rawName === "access_token") continue;
		let name = rawName.endsWith("[]") ? rawName.slice(0, -2) : rawName;
		if (typeof value === "string") (fields[name] ??= []).push(value);
		else if (value.size > 0 || value.name !== "") (files[name] ??= []).push(value);
	}
	let { h, action, ...properties } = fields;
	if (action !== undefined) return fromAction({ action: action[0], url: fields.url?.[0] });
	return toCreate({ type: h?.map((name) => `h-${name}`), properties }, files);
}

/** Dispatches a decoded JSON body on its `action`; a body without one is a create. */
function fromJSON(value: unknown): Result<Micropub.Operation, MicropubRequestError> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return failure(new MicropubRequestError("The JSON body must be an object."));
	}
	if (!("action" in value) || value.action === undefined) return toCreate(value, {});
	if (value.action === "update") return toUpdate(value);
	return fromAction(value);
}

/** A delete or undelete; `update` is named as JSON-only, and any other action is unknown. */
function fromAction(
	value: Record<string, unknown>,
): Result<Micropub.Delete | Micropub.Undelete, MicropubRequestError> {
	if (value.action === "update") {
		return failure(new MicropubRequestError("Updates are sent as JSON, not form-encoded."));
	}
	if (value.action !== "delete" && value.action !== "undelete") {
		return failure(new MicropubRequestError(`Unknown action ${JSON.stringify(value.action)}.`));
	}
	let parsed = parseSafe(ACTION_SCHEMA, value);
	if (!parsed.success) return invalid(`The ${value.action} request is invalid`, parsed.issues);
	return success({ action: parsed.value.action, url: parsed.value.url });
}

/**
 * Validates a create: commands are split from the properties first, so an unknown
 * command keeps its raw values, then the rest must be an mf2 item under `ITEM_SCHEMA`.
 */
function toCreate(
	value: unknown,
	files: Record<string, File[]>,
): Result<Micropub.Create, MicropubRequestError> {
	let outline = parseSafe(CREATE_SCHEMA, value);
	if (!outline.success) return invalid("The create request is invalid", outline.issues);
	let properties: Record<string, unknown[]> = {};
	let commandFields: Record<string, unknown[]> = {};
	let other: Record<string, unknown[]> = {};
	for (let [name, values] of Object.entries(outline.value.properties)) {
		if (KNOWN_COMMANDS.has(name)) commandFields[name] = values;
		else if (name.startsWith("mp-")) other[name] = values;
		else properties[name] = values;
	}
	let commands = parseSafe(COMMANDS_SCHEMA, commandFields);
	if (!commands.success) return invalid("The create commands are invalid", commands.issues);
	let item = canonicalProperties(properties, "properties");
	if (isFailure(item)) return item;
	return success({
		action: "create",
		type: outline.value.type,
		properties: item.data,
		commands: {
			slug: commands.value["mp-slug"]?.[0] ?? null,
			syndicateTo: commands.value["mp-syndicate-to"] ?? [],
			status: commands.value["post-status"]?.[0] ?? null,
			other,
		},
		files,
	});
}

/** Validates an update and splits `delete` into whole properties and single values. */
function toUpdate(value: object): Result<Micropub.Update, MicropubRequestError> {
	let parsed = parseSafe(UPDATE_SCHEMA, value);
	if (!parsed.success) return invalid("The update request is invalid", parsed.issues);
	let { url, replace = {}, add = {}, delete: remove = [] } = parsed.value;
	let deleteProperties = Array.isArray(remove) ? remove : [];
	let sets = {
		replace: canonicalProperties(replace, "replace"),
		add: canonicalProperties(add, "add"),
		delete: canonicalProperties(Array.isArray(remove) ? {} : remove, "delete"),
	};
	if (isFailure(sets.replace)) return sets.replace;
	if (isFailure(sets.add)) return sets.add;
	if (isFailure(sets.delete)) return sets.delete;
	let update: Micropub.Update = {
		action: "update",
		url,
		replace: sets.replace.data,
		add: sets.add.data,
		deleteProperties,
		deleteValues: sets.delete.data,
	};
	let changes =
		Object.keys(update.replace).length +
		Object.keys(update.add).length +
		update.deleteProperties.length +
		Object.keys(update.deleteValues).length;
	if (changes === 0) return failure(new MicropubRequestError("The update names no change."));
	return success(update);
}

/**
 * Canonical mf2 values through `ITEM_SCHEMA`, which fills the `value` of `{ html }`
 * content and of nested items. Numbers and booleans are read as their text first, since
 * clients send coordinates as JSON numbers and mf2 values are strings.
 *
 * @param section - The request member the values came from, used as the issues' path root
 */
function canonicalProperties(
	properties: Record<string, unknown[]>,
	section: string,
): Result<Micropub.Properties, MicropubRequestError> {
	let parsed = parseSafe(ITEM_SCHEMA, { type: [], properties: scalarsAsText(properties) });
	if (parsed.success) return success(parsed.value.properties);
	let issues = parsed.issues.map((issue) => ({
		...issue,
		path: [section, ...(issue.path ?? []).slice(1)],
	}));
	return invalid(`The ${section} values are invalid`, issues);
}

/** Replaces number and boolean values with their text, in nested items' properties too. */
function scalarsAsText(properties: Record<string, unknown[]>): Record<string, unknown[]> {
	let result: Record<string, unknown[]> = {};
	for (let [name, values] of Object.entries(properties)) {
		result[name] = Array.isArray(values) ? values.map(scalarAsText) : values;
	}
	return result;
}

/** One property value with numbers and booleans read as text. */
function scalarAsText(value: unknown): unknown {
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (typeof value !== "object" || value === null || !("properties" in value)) return value;
	let nested = value.properties;
	if (typeof nested !== "object" || nested === null || Array.isArray(nested)) return value;
	return { ...value, properties: scalarsAsText(nested as Record<string, unknown[]>) };
}

/** An `invalid_request` failure whose message names the first issue and where it is. */
function invalid(
	context: string,
	issues: readonly StandardSchemaV1.Issue[],
): Result<never, MicropubRequestError> {
	let [first] = issues;
	let path = (first?.path ?? [])
		.map((segment) => String(typeof segment === "object" ? segment.key : segment))
		.join(".");
	let detail = first === undefined ? "" : `: ${first.message}${path === "" ? "" : ` at ${path}`}`;
	return failure(new MicropubRequestError(`${context}${detail}.`, issues));
}
