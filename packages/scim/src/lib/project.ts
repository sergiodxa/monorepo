/**
 * Attribute projection, RFC 7644 §3.4.2.5 and RFC 7643 §2.2 `returned`: which members of a
 * wire resource a response carries, given the request's `attributes` or
 * `excludedAttributes` and the definitions that say what is returned when.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discovery } from "../discovery.js";
import type { Filter } from "../filter.js";
import type { Scim } from "../index.js";

import type { WireObject } from "./attributes.js";

import {
	declaredSchemas,
	findAttribute,
	findSchema,
	isWireObject,
	resolvePath,
	schemaOfPath,
} from "./attributes.js";

/** Which attributes, and which of their sub-attributes, a list names. */
interface Selection {
	/** Schemas named as a whole, by lowercased URN. */
	schemas: Set<string>;
	/** Attributes by `schema|attribute`, each with the sub-attributes named, or `null` for the whole attribute. */
	attributes: Map<string, Set<string> | null>;
}

/**
 * The key a selection stores an attribute under.
 *
 * @param schema - The owning schema, `null` for common attributes
 * @param attribute - The attribute
 * @returns The key
 */
function selectionKey(
	schema: Discovery.SchemaDefinition | null,
	attribute: Discovery.Attribute,
): string {
	return `${schema?.id ?? ""}|${attribute.name}`.toLowerCase();
}

/**
 * Resolves a list of paths into a selection, resolving unqualified names with the resource's
 * own schemas first, as its members resolve. Paths no definition declares select nothing.
 *
 * @param paths - The requested paths
 * @param definitions - The served definitions
 * @param prefer - The resource's declared schemas
 * @returns The selection
 */
function select(
	paths: Filter.AttributePath[],
	definitions: Discovery.Definitions,
	prefer: string[],
): Selection {
	let selection: Selection = { schemas: new Set(), attributes: new Map() };
	for (let path of paths) {
		let schema = schemaOfPath(path, definitions);
		if (schema) {
			selection.schemas.add(schema.id.toLowerCase());
			continue;
		}
		let resolved = resolvePath(path, definitions, prefer);
		if (!resolved) continue;
		let key = selectionKey(resolved.schema, resolved.attribute);
		let current = selection.attributes.get(key);
		if (resolved.subAttribute === null) selection.attributes.set(key, null);
		else if (current !== null) {
			selection.attributes.set(
				key,
				(current ?? new Set()).add(resolved.subAttribute.name.toLowerCase()),
			);
		}
	}
	return selection;
}

/**
 * Projects a complex value's sub-attributes by their own `returned` characteristic.
 *
 * @param value - One complex value
 * @param attribute - Its definition
 * @param named - Sub-attributes named in `attributes`, `null` when the whole attribute was
 * @param excluded - Sub-attributes named in `excludedAttributes`
 * @returns The projected value
 */
function projectComplex(
	value: WireObject,
	attribute: Discovery.Attribute,
	named: Set<string> | null,
	excluded: Set<string> | null,
): WireObject {
	let result: WireObject = {};
	for (let [key, item] of Object.entries(value)) {
		let sub = findAttribute(attribute.subAttributes, key);
		let name = (sub?.name ?? key).toLowerCase();
		let returned = sub?.returned ?? "default";
		if (returned === "never") continue;
		let keep =
			returned === "always" ||
			(named === null ? returned === "default" && !excluded?.has(name) : named.has(name));
		if (keep) result[key] = item;
	}
	return result;
}

/**
 * Projects one attribute's value, or answers `undefined` when the response leaves it out.
 *
 * @param value - The attribute's value
 * @param schema - The owning schema, `null` for common attributes
 * @param attribute - Its definition
 * @param included - The `attributes` selection, `null` when the request named none
 * @param excluded - The `excludedAttributes` selection
 * @returns The projected value, or `undefined`
 */
function projectAttribute(
	value: unknown,
	schema: Discovery.SchemaDefinition | null,
	attribute: Discovery.Attribute,
	included: Selection | null,
	excluded: Selection,
): unknown {
	if (attribute.returned === "never") return undefined;
	if (attribute.returned === "always") return value;

	let key = selectionKey(schema, attribute);
	let wholeSchema = schema !== null && included?.schemas.has(schema.id.toLowerCase());
	let named: Set<string> | null = null;
	let excludedSubs: Set<string> | null = null;

	if (included !== null) {
		if (!wholeSchema) {
			if (!included.attributes.has(key)) return undefined;
			named = included.attributes.get(key) ?? null;
		}
	} else {
		if (attribute.returned === "request") return undefined;
		if (schema !== null && excluded.schemas.has(schema.id.toLowerCase())) return undefined;
		if (excluded.attributes.has(key)) {
			excludedSubs = excluded.attributes.get(key) ?? null;
			if (excludedSubs === null) return undefined;
		}
	}

	if (attribute.type !== "complex") return value;
	let project = (item: unknown) =>
		isWireObject(item) ? projectComplex(item, attribute, named, excludedSubs) : item;
	return Array.isArray(value) ? value.map(project) : project(value);
}

/**
 * Applies `returned` and the request's `attributes`/`excludedAttributes` to one wire object:
 * `always` members stay, `never` members go, `request` members appear only when named, and
 * undeclared members stay only without `attributes`, which wins over `excludedAttributes`.
 *
 * @param resource - The wire resource
 * @param query - The parsed list query, or any object with the two lists
 * @param definitions - The served definitions
 * @returns The projected copy
 * @example project(userResource(user), query.data, definitions)
 */
export function project(
	resource: object,
	query: Pick<Scim.ListQuery, "attributes" | "excludedAttributes">,
	definitions: Discovery.Definitions,
): WireObject {
	let wire = resource as WireObject;
	let prefer = declaredSchemas(wire);
	let included = query.attributes.length > 0 ? select(query.attributes, definitions, prefer) : null;
	let excluded = select(query.excludedAttributes, definitions, prefer);
	let result: WireObject = {};

	for (let [key, value] of Object.entries(wire)) {
		if (key.toLowerCase() === "schemas") {
			result[key] = value;
			continue;
		}

		let extension = findSchema(definitions, key);
		if (extension && isWireObject(value)) {
			let projected: WireObject = {};
			for (let [member, item] of Object.entries(value)) {
				let attribute = findAttribute(extension.attributes, member);
				let next = attribute
					? projectAttribute(item, extension, attribute, included, excluded)
					: included === null && !excluded.schemas.has(extension.id.toLowerCase())
						? item
						: undefined;
				if (next !== undefined) projected[member] = next;
			}
			if (Object.keys(projected).length > 0) result[key] = projected;
			continue;
		}

		let resolved = resolvePath(
			{ schema: null, attribute: key, subAttribute: null },
			definitions,
			prefer,
		);
		let next = resolved
			? projectAttribute(value, resolved.schema, resolved.attribute, included, excluded)
			: included === null
				? value
				: undefined;
		if (next !== undefined) result[key] = next;
	}

	return result;
}
