/**
 * Converts between SCIM wire resources and the camelCase `Scim.User` and `Scim.Group` types.
 * Parsing folds attribute-name case, treats `null` as unassigned and moves URN-keyed
 * extensions under caller-chosen keys; writing reverses it and drops unassigned members.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Discovery } from "../discovery.js";
import type { Scim } from "../index.js";

import type { WireObject } from "./attributes.js";

import { findAttribute, findKey, isPresent, isWireObject } from "./attributes.js";
import { ENTERPRISE_USER_SCHEMA, GROUP_SCHEMA, USER_SCHEMA } from "./constants.js";
import {
	COMMON_ATTRIBUTES,
	ENTERPRISE_USER_DEFINITION,
	GROUP_DEFINITION,
	USER_DEFINITION,
} from "./discovery/definitions.js";
import { badRequest, ScimError } from "./error.js";

/**
 * Extension schemas by the key their data takes in `Scim.User.extensions`, each naming the
 * URN it is written under on the wire and a synchronous Standard Schema validating it.
 */
export interface ExtensionSchemas {
	[key: string]: { urn: string; schema: StandardSchemaV1<unknown, unknown> };
}

/**
 * The `extensions` type an `ExtensionSchemas` value parses to:
 * `{ enterprise: { urn, schema } }` becomes `{ enterprise?: InferOutput<schema> }`.
 *
 * @template Extensions - The extension schemas
 */
export type InferExtensions<Extensions extends ExtensionSchemas> = {
	[Key in keyof Extensions]?: StandardSchemaV1.InferOutput<Extensions[Key]["schema"]>;
};

/** The extensions `parseUser` reads when given none: the Enterprise User extension. */
export interface DefaultExtensions extends ExtensionSchemas {
	enterprise: { urn: string; schema: StandardSchemaV1<unknown, Scim.EnterpriseUser> };
}

/** Options accepted by `parseUser`. */
export interface ParseUserOptions<Extensions extends ExtensionSchemas> {
	/** The extensions to read; the Enterprise User extension under `enterprise` when omitted. */
	extensions?: Extensions;
}

/** Options accepted by `userResource`. */
export interface ResourceOptions {
	/** The URN each `extensions` key is written under; `enterprise` defaults to the Enterprise URN. */
	extensions?: ExtensionSchemas;
}

/** A string that parses as a date, read as a `Date`. */
const DATE_TIME_SCHEMA = s
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), "Expected a date-time")
	.transform((value) => new Date(value));

/** An optional string member. */
const OPTIONAL_STRING_SCHEMA = s.optional(s.string());

/** RFC 7643 §3.1 `meta`, every member but `version` required. */
const META_SCHEMA = s.object({
	resourceType: s.string(),
	created: DATE_TIME_SCHEMA,
	lastModified: DATE_TIME_SCHEMA,
	location: s.string(),
	version: s.optional(s.string()),
});

/** One value of a multi-valued attribute. */
const MULTI_VALUED_SCHEMA = s.object({
	value: s.string(),
	display: s.optional(s.string()),
	type: s.optional(s.string()),
	primary: s.optional(s.boolean()),
});

/** One of a user's groups, `$ref` read as `ref`. */
const GROUP_MEMBERSHIP_SCHEMA = s
	.object({
		value: s.string(),
		$ref: OPTIONAL_STRING_SCHEMA,
		display: s.optional(s.string()),
		type: s.optional(s.string()),
		primary: s.optional(s.boolean()),
	})
	.transform(({ $ref, ...group }): Scim.GroupMembership =>
		withoutUndefined({ ...group, ref: $ref }),
	);

/** An optional list of multi-valued attribute values. */
const MULTI_VALUED_LIST_SCHEMA = s.optional(s.array(MULTI_VALUED_SCHEMA));

/** RFC 7643 §4.1.1 `name`. */
const NAME_SCHEMA = s.object({
	formatted: OPTIONAL_STRING_SCHEMA,
	familyName: OPTIONAL_STRING_SCHEMA,
	givenName: OPTIONAL_STRING_SCHEMA,
	middleName: OPTIONAL_STRING_SCHEMA,
	honorificPrefix: OPTIONAL_STRING_SCHEMA,
	honorificSuffix: OPTIONAL_STRING_SCHEMA,
});

/** RFC 7643 §4.1.2 `addresses` value. */
const ADDRESS_SCHEMA = s.object({
	formatted: OPTIONAL_STRING_SCHEMA,
	streetAddress: OPTIONAL_STRING_SCHEMA,
	locality: OPTIONAL_STRING_SCHEMA,
	region: OPTIONAL_STRING_SCHEMA,
	postalCode: OPTIONAL_STRING_SCHEMA,
	country: OPTIONAL_STRING_SCHEMA,
	type: OPTIONAL_STRING_SCHEMA,
	primary: s.optional(s.boolean()),
});

/** The core User attributes; `meta` is read separately since servers ignore it on write. */
const USER_SCHEMA_SHAPE = s.object({
	id: OPTIONAL_STRING_SCHEMA,
	externalId: OPTIONAL_STRING_SCHEMA,
	userName: s.string(),
	name: s.optional(NAME_SCHEMA),
	displayName: OPTIONAL_STRING_SCHEMA,
	nickName: OPTIONAL_STRING_SCHEMA,
	profileUrl: OPTIONAL_STRING_SCHEMA,
	title: OPTIONAL_STRING_SCHEMA,
	userType: OPTIONAL_STRING_SCHEMA,
	preferredLanguage: OPTIONAL_STRING_SCHEMA,
	locale: OPTIONAL_STRING_SCHEMA,
	timezone: OPTIONAL_STRING_SCHEMA,
	active: s.optional(s.boolean()),
	password: OPTIONAL_STRING_SCHEMA,
	emails: MULTI_VALUED_LIST_SCHEMA,
	phoneNumbers: MULTI_VALUED_LIST_SCHEMA,
	ims: MULTI_VALUED_LIST_SCHEMA,
	photos: MULTI_VALUED_LIST_SCHEMA,
	addresses: s.optional(s.array(ADDRESS_SCHEMA)),
	groups: s.optional(s.array(GROUP_MEMBERSHIP_SCHEMA)),
	entitlements: MULTI_VALUED_LIST_SCHEMA,
	roles: MULTI_VALUED_LIST_SCHEMA,
	x509Certificates: MULTI_VALUED_LIST_SCHEMA,
});

/** The Enterprise User extension, `manager.$ref` read as `manager.ref`. */
const ENTERPRISE_USER_SCHEMA_SHAPE = s.object({
	employeeNumber: OPTIONAL_STRING_SCHEMA,
	costCenter: OPTIONAL_STRING_SCHEMA,
	organization: OPTIONAL_STRING_SCHEMA,
	division: OPTIONAL_STRING_SCHEMA,
	department: OPTIONAL_STRING_SCHEMA,
	manager: s.optional(
		s
			.object({
				value: OPTIONAL_STRING_SCHEMA,
				$ref: OPTIONAL_STRING_SCHEMA,
				displayName: OPTIONAL_STRING_SCHEMA,
			})
			.transform(({ $ref, ...manager }) => withoutUndefined({ ...manager, ref: $ref })),
	),
});

/** A Group member, `$ref` read as `ref` and `type` matched without regard to case. */
const MEMBER_SCHEMA = s
	.object({
		value: s.string(),
		$ref: OPTIONAL_STRING_SCHEMA,
		display: OPTIONAL_STRING_SCHEMA,
		type: s.optional(
			s
				.string()
				.refine((type) => /^(?:user|group)$/i.test(type), 'Expected "User" or "Group"')
				.transform((type): "User" | "Group" => (type.toLowerCase() === "user" ? "User" : "Group")),
		),
	})
	.transform(({ $ref, ...member }): Scim.Member => withoutUndefined({ ...member, ref: $ref }));

/** The core Group attributes. */
const GROUP_SCHEMA_SHAPE = s.object({
	id: OPTIONAL_STRING_SCHEMA,
	externalId: OPTIONAL_STRING_SCHEMA,
	displayName: s.string(),
	members: s.optional(s.array(MEMBER_SCHEMA)),
});

/** The extensions `parseUser` reads when given none. */
const DEFAULT_EXTENSIONS: DefaultExtensions = {
	enterprise: { urn: ENTERPRISE_USER_SCHEMA, schema: ENTERPRISE_USER_SCHEMA_SHAPE },
};

/**
 * A copy holding only defined members, so an optional field is either set or absent.
 *
 * @param value - The object
 * @returns The copy
 */
function withoutUndefined<Value extends object>(value: Value): Value {
	return Object.fromEntries(
		Object.entries(value).filter(([, item]) => item !== undefined),
	) as Value;
}

/**
 * Renames members to the definitions' spelling, recursing into complex and multi-valued
 * values, and drops `null` members, which RFC 7643 §2.5 makes equivalent to unassigned.
 *
 * @param value - The wire object
 * @param attributes - The attributes its members may name
 * @returns The canonical copy; unknown members keep their spelling
 */
function canonicalize(value: WireObject, attributes: readonly Discovery.Attribute[]): WireObject {
	let result: WireObject = {};
	for (let [key, item] of Object.entries(value)) {
		if (item === null) continue;
		let attribute = findAttribute(attributes, key);
		if (!attribute) {
			result[key] = item;
			continue;
		}
		let subs = attribute.subAttributes ?? [];
		let canonical = (entry: unknown) => (isWireObject(entry) ? canonicalize(entry, subs) : entry);
		result[attribute.name] = Array.isArray(item)
			? item.filter((entry) => entry !== null).map(canonical)
			: canonical(item);
	}
	return result;
}

/**
 * Validates a value with a synchronous Standard Schema, turning the first issue into an
 * `invalidValue` error that names where it is.
 *
 * @param schema - The schema
 * @param value - The value
 * @param prefix - A label for where the value sits, prepended to the issue path
 * @returns The output, or the error
 */
function validate<Output>(
	schema: StandardSchemaV1<unknown, Output>,
	value: unknown,
	prefix: string | null,
): Output | ScimError {
	let result = s.parseSafe(schema, value);
	if (result.success) return result.value;
	let [issue] = result.issues;
	let segments = (issue?.path ?? []).map((segment) =>
		String(typeof segment === "object" ? segment.key : segment),
	);
	let where = [prefix, ...segments].filter((segment) => segment !== null).join(".");
	let message = issue?.message ?? "Invalid value";
	return badRequest("invalidValue", where ? `${where}: ${message}` : message);
}

/**
 * Reads `meta` when it is complete and drops it otherwise: it is read-only, so a server
 * ignores what a client sends, while a client reading a server's resource gets it typed.
 *
 * @param value - The wire `meta`
 * @returns The metadata, or `undefined`
 */
function readMeta(value: unknown): Scim.Meta | undefined {
	let result = s.parseSafe(META_SCHEMA, value);
	return result.success ? withoutUndefined(result.value) : undefined;
}

/**
 * Parses a User from a request or response body, matching names case-insensitively and
 * reading each extension from its URN member. A missing `userName` or mistyped member fails
 * `400 invalidValue`; a body that is not an object fails `400 invalidSyntax`.
 *
 * @param body - The decoded JSON body
 * @param options - The extensions to read, the Enterprise User extension by default
 * @returns The user
 * @example parseUser(body, { extensions: { enterprise: { urn: ENTERPRISE_USER_SCHEMA, schema } } })
 */
export function parseUser<Extensions extends ExtensionSchemas = DefaultExtensions>(
	body: unknown,
	options: ParseUserOptions<Extensions> = {},
): Result<Scim.User<InferExtensions<Extensions>>, ScimError> {
	if (!isWireObject(body))
		return failure(badRequest("invalidSyntax", "The body must be an object."));

	let wire = canonicalize(body, [...USER_DEFINITION.attributes, ...COMMON_ATTRIBUTES]);
	let core = validate(USER_SCHEMA_SHAPE, wire, null);
	if (core instanceof ScimError) return failure(core);

	let schemas: ExtensionSchemas = options.extensions ?? DEFAULT_EXTENSIONS;
	let extensions: WireObject = {};
	for (let [key, { urn, schema }] of Object.entries(schemas)) {
		let member = findKey(body, urn);
		let raw = member === undefined ? undefined : body[member];
		if (raw === undefined || raw === null) continue;
		let value =
			urn.toLowerCase() === ENTERPRISE_USER_SCHEMA.toLowerCase() && isWireObject(raw)
				? canonicalize(raw, ENTERPRISE_USER_DEFINITION.attributes)
				: raw;
		let parsed = validate(schema, value, urn);
		if (parsed instanceof ScimError) return failure(parsed);
		extensions[key] = isWireObject(parsed) ? withoutUndefined(parsed) : parsed;
	}

	let meta = readMeta(wire.meta);
	let user = {
		...withoutUndefined(core),
		extensions: extensions as InferExtensions<Extensions>,
		...(meta ? { meta } : {}),
	};
	return success(user);
}

/**
 * Parses a Group from a request or response body, with the same case folding and `null`
 * handling as `parseUser`. Member `type` matches `User` or `Group` in any case.
 *
 * @param body - The decoded JSON body
 * @returns The group
 */
export function parseGroup(body: unknown): Result<Scim.Group, ScimError> {
	if (!isWireObject(body))
		return failure(badRequest("invalidSyntax", "The body must be an object."));
	let wire = canonicalize(body, [...GROUP_DEFINITION.attributes, ...COMMON_ATTRIBUTES]);
	let group = validate(GROUP_SCHEMA_SHAPE, wire, null);
	if (group instanceof ScimError) return failure(group);
	let meta = readMeta(wire.meta);
	return success({ ...withoutUndefined(group), ...(meta ? { meta } : {}) });
}

/**
 * Drops unassigned members, recursively: `undefined`, `null`, empty arrays and objects that
 * hold nothing assigned.
 *
 * @param value - Any value
 * @returns The compacted value, `undefined` when nothing assigned remains
 */
function compact(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) {
		let items = value.map(compact).filter((item) => item !== undefined);
		return items.length > 0 ? items : undefined;
	}
	if (isWireObject(value)) {
		let entries = Object.entries(value)
			.map(([key, item]) => [key, compact(item)] as const)
			.filter(([, item]) => item !== undefined);
		return entries.length > 0 ? Object.fromEntries(entries) : undefined;
	}
	return value === null ? undefined : value;
}

/**
 * The wire `meta`, dates as RFC 3339 strings.
 *
 * @param meta - The metadata
 * @returns The wire object
 */
function metaResource(meta: Scim.Meta): WireObject {
	return withoutUndefined({
		resourceType: meta.resourceType,
		created: meta.created.toISOString(),
		lastModified: meta.lastModified.toISOString(),
		location: meta.location,
		version: meta.version,
	});
}

/**
 * The wire User: `schemas` lists the core URN plus each extension present, extensions sit
 * under their URNs, `ref` is written `$ref`, unassigned members are dropped, and `password`
 * is left out, as RFC 7643 marks it `returned: never`.
 *
 * @param user - The user
 * @param options - The URN each extension key is written under
 * @returns The wire object, ready for `scimResponse` or `project`
 */
export function userResource(user: Scim.User<object>, options: ResourceOptions = {}): WireObject {
	let { extensions, meta, password: _password, groups, ...core } = user;
	let wireGroups = groups?.map(({ ref, ...group }) => ({ ...group, $ref: ref }));
	let resource = (compact({ ...core, groups: wireGroups }) ?? {}) as WireObject;
	let schemas = [USER_SCHEMA];

	for (let [key, value] of Object.entries(extensions)) {
		let urn =
			options.extensions?.[key]?.urn ?? (key === "enterprise" ? ENTERPRISE_USER_SCHEMA : null);
		if (urn === null) continue;
		let wire =
			urn === ENTERPRISE_USER_SCHEMA && isWireObject(value) ? enterpriseResource(value) : value;
		let compacted = compact(wire);
		if (compacted === undefined || !isPresent(compacted)) continue;
		schemas.push(urn);
		resource[urn] = compacted;
	}

	return { schemas, ...resource, ...(meta ? { meta: metaResource(meta) } : {}) };
}

/**
 * The Enterprise User extension on the wire, `manager.ref` written as `$ref`.
 *
 * @param value - The parsed extension
 * @returns The wire object
 */
function enterpriseResource(value: WireObject): WireObject {
	let manager = value.manager;
	if (!isWireObject(manager)) return value;
	let { ref, ...rest } = manager;
	return { ...value, manager: { ...rest, $ref: ref } };
}

/**
 * The wire Group: `ref` written `$ref`, unassigned members dropped, an empty `members`
 * omitted, as RFC 7643 §2.5 makes it equivalent to unassigned.
 *
 * @param group - The group
 * @returns The wire object
 */
export function groupResource(group: Scim.Group): WireObject {
	let { meta, members, ...core } = group;
	let wireMembers = members?.map(({ ref, ...member }) => ({ ...member, $ref: ref }));
	let resource = (compact({ ...core, members: wireMembers }) ?? {}) as WireObject;
	return { schemas: [GROUP_SCHEMA], ...resource, ...(meta ? { meta: metaResource(meta) } : {}) };
}
