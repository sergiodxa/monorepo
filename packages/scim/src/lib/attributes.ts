/**
 * Resolves attribute paths against attribute definitions and locates them on wire-shaped
 * resources. SCIM attribute names are case-insensitive (RFC 7643 §2.1) and extension
 * attributes live under their schema URN, so every read and write goes through here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discovery } from "../discovery.js";
import type { Filter } from "../filter.js";

import { COMMON_ATTRIBUTES } from "./discovery/definitions.js";

/** An attribute path matched to the definitions that describe it. */
export interface ResolvedPath {
	/** The schema the attribute belongs to; `null` for the RFC 7643 §3 common attributes. */
	schema: Discovery.SchemaDefinition | null;
	attribute: Discovery.Attribute;
	subAttribute: Discovery.Attribute | null;
}

/** A plain JSON object, the shape every wire resource and complex value takes. */
export interface WireObject {
	[key: string]: unknown;
}

/**
 * Whether a value is a plain object rather than an array, `null` or a primitive.
 *
 * @param value - Any value
 * @returns Whether it can be read as a `WireObject`
 */
export function isWireObject(value: unknown): value is WireObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Finds the attribute a name refers to, ignoring case.
 *
 * @param attributes - The candidates
 * @param name - The name as written
 * @returns The definition, or `undefined`
 */
export function findAttribute(
	attributes: readonly Discovery.Attribute[] | undefined,
	name: string,
): Discovery.Attribute | undefined {
	let lower = name.toLowerCase();
	return attributes?.find((attribute) => attribute.name.toLowerCase() === lower);
}

/**
 * Finds the schema a URN names, ignoring case.
 *
 * @param definitions - The served definitions
 * @param urn - The URN as written
 * @returns The definition, or `undefined`
 */
export function findSchema(
	definitions: Discovery.Definitions,
	urn: string,
): Discovery.SchemaDefinition | undefined {
	let lower = urn.toLowerCase();
	return Object.values(definitions).find((definition) => definition.id.toLowerCase() === lower);
}

/**
 * Resolves a path against the definitions. An unqualified name tries the schemas in `prefer`
 * first (a resource's own `schemas`), then every definition in insertion order, then the
 * common attributes, so the core schema should come first in `definitions`.
 *
 * @param path - The parsed path
 * @param definitions - The served definitions
 * @param prefer - Schema URNs to try first
 * @returns The resolution, or `null` when no definition declares the path
 */
export function resolvePath(
	path: Filter.AttributePath,
	definitions: Discovery.Definitions,
	prefer: readonly string[] = [],
): ResolvedPath | null {
	let found: { schema: Discovery.SchemaDefinition | null; attribute: Discovery.Attribute } | null =
		null;

	if (path.schema !== null) {
		let schema = findSchema(definitions, path.schema);
		if (!schema) return null;
		let attribute = findAttribute(schema.attributes, path.attribute);
		if (attribute) found = { schema, attribute };
	} else {
		let preferred = prefer.flatMap((urn) => findSchema(definitions, urn) ?? []);
		for (let schema of [...preferred, ...Object.values(definitions)]) {
			let attribute = findAttribute(schema.attributes, path.attribute);
			if (attribute) {
				found = { schema, attribute };
				break;
			}
		}
	}

	if (!found) {
		let common = findAttribute(COMMON_ATTRIBUTES, path.attribute);
		if (!common) return null;
		found = { schema: null, attribute: common };
	}

	if (path.subAttribute === null) return { ...found, subAttribute: null };
	let subAttribute = findAttribute(found.attribute.subAttributes, path.subAttribute);
	if (!subAttribute) return null;
	return { ...found, subAttribute };
}

/**
 * The key an object stores a name under, matched without regard to case.
 *
 * @param object - The object to search
 * @param name - The name as written
 * @returns The stored key, or `undefined` when absent
 */
export function findKey(object: WireObject, name: string): string | undefined {
	if (Object.hasOwn(object, name)) return name;
	let lower = name.toLowerCase();
	return Object.keys(object).find((key) => key.toLowerCase() === lower);
}

/**
 * The value an object stores under a name, matched without regard to case.
 *
 * @param object - The object to read
 * @param name - The name as written
 * @returns The value, or `undefined`
 */
export function readKey(object: WireObject, name: string): unknown {
	let key = findKey(object, name);
	return key === undefined ? undefined : object[key];
}

/**
 * The object holding a resolved attribute on a resource: the URN-keyed extension object when
 * the resource has one for the attribute's schema, the resource itself otherwise.
 *
 * @param resource - The wire resource
 * @param resolved - The resolved path
 * @returns The containing object, or `undefined` when an extension object is malformed
 */
export function readContainer(
	resource: WireObject,
	resolved: ResolvedPath,
): WireObject | undefined {
	if (resolved.schema === null) return resource;
	let extension = readKey(resource, resolved.schema.id);
	if (extension === undefined) return resource;
	return isWireObject(extension) ? extension : undefined;
}

/**
 * Whether a resource keeps a schema's attributes at its top level. The first URN of the
 * resource's `schemas` is its core schema; a resource without `schemas` takes the first
 * served definition as its core.
 *
 * @param resource - The wire resource
 * @param schema - The schema an attribute belongs to
 * @param definitions - The served definitions
 * @returns Whether the schema is the resource's core schema
 */
export function isCoreSchema(
	resource: WireObject,
	schema: Discovery.SchemaDefinition,
	definitions: Discovery.Definitions,
): boolean {
	let declared = readKey(resource, "schemas");
	let core = Array.isArray(declared)
		? declared.find((urn): urn is string => typeof urn === "string")
		: Object.values(definitions)[0]?.id;
	return core?.toLowerCase() === schema.id.toLowerCase();
}

/**
 * The URNs a resource declares in `schemas`, for resolving its unqualified attribute names.
 *
 * @param resource - The wire resource
 * @returns The declared URNs, empty when absent
 */
export function declaredSchemas(resource: WireObject): string[] {
	let declared = readKey(resource, "schemas");
	if (!Array.isArray(declared)) return [];
	return declared.filter((urn): urn is string => typeof urn === "string");
}

/**
 * Reads the strings `"true"` and `"false"`, in any case, as booleans wherever the definition
 * says `boolean`, descending into complex and multi-valued values. Other values pass through.
 *
 * @param value - The value as sent
 * @param attribute - The attribute it is written to
 * @returns The value with its booleans coerced
 */
export function coerceBooleans(value: unknown, attribute: Discovery.Attribute): unknown {
	if (Array.isArray(value) && attribute.multiValued) {
		return value.map((item) => coerceBooleans(item, { ...attribute, multiValued: false }));
	}
	if (attribute.type === "boolean" && typeof value === "string") {
		let lower = value.toLowerCase();
		if (lower === "true") return true;
		if (lower === "false") return false;
		return value;
	}
	if (attribute.type === "complex" && isWireObject(value)) {
		let result: WireObject = {};
		for (let [key, item] of Object.entries(value)) {
			let sub = findAttribute(attribute.subAttributes, key);
			result[key] = sub ? coerceBooleans(item, sub) : item;
		}
		return result;
	}
	return value;
}

/**
 * Whether a value counts as assigned: RFC 7643 §2.5 treats `null`, an empty array and an
 * empty object as unassigned, and RFC 7644 §3.4.2.2 `pr` also rejects an empty string.
 *
 * @param value - The attribute's value
 * @returns Whether the attribute is present
 */
export function isPresent(value: unknown): boolean {
	if (value === undefined || value === null || value === "") return false;
	if (Array.isArray(value)) return value.some(isPresent);
	if (isWireObject(value)) return Object.values(value).some(isPresent);
	return true;
}

/**
 * The schema a path names as a whole, as `attributes=urn:…:enterprise:2.0:User` selects an
 * entire extension. Attribute notation reads such a URN as a schema prefix plus a final
 * name, so the two are joined back before matching.
 *
 * @param path - The parsed path
 * @param definitions - The served definitions
 * @returns The schema, or `undefined` when the path names an attribute
 */
export function schemaOfPath(
	path: Filter.AttributePath,
	definitions: Discovery.Definitions,
): Discovery.SchemaDefinition | undefined {
	if (path.schema === null || path.subAttribute !== null) return undefined;
	return findSchema(definitions, `${path.schema}:${path.attribute}`);
}
