/**
 * Applies PATCH operations to a wire-shaped resource following RFC 7644 §3.5.2. Work happens
 * on a copy and the first failure discards it, so a request applies completely or leaves
 * the caller's resource as it was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Discovery } from "../../discovery.js";
import type { Filter } from "../../filter.js";
import type { Patch } from "../../patch.js";
import type { ResolvedPath, WireObject } from "../attributes.js";

import {
	coerceBooleans,
	declaredSchemas,
	findAttribute,
	findKey,
	findSchema,
	isCoreSchema,
	isPresent,
	isWireObject,
	readKey,
	resolvePath,
} from "../attributes.js";
import { deepEqual } from "../equal.js";
import { badRequest, ScimError } from "../error.js";
import { compileValueFilter } from "../filter/compile.js";
import { parsePatchPath } from "../filter/parse.js";
import { stringifyFilter, stringifyPath } from "../filter/stringify.js";

/** One operation's target, resolved against the definitions and located on the resource. */
interface Target {
	resolved: ResolvedPath;
	/** The sub-attribute written, from `name.givenName` or from `emails[...].value`. */
	sub: Discovery.Attribute | null;
	filter: Filter.Expression | null;
	/** The path as the client wrote it, for error details. */
	text: string;
}

/**
 * The text of a PATCH path, for error details.
 *
 * @param path - The parsed path
 * @returns Its text
 */
function pathText(path: Patch.Path): string {
	let text = stringifyPath(path.attribute);
	if (path.filter) text += `[${stringifyFilter(path.filter)}]`;
	if (path.subAttribute) text += `.${path.subAttribute}`;
	return text;
}

/**
 * Resolves an operation's path. A path the definitions do not declare is `invalidPath`.
 *
 * @param resource - The resource, whose `schemas` guide unqualified names
 * @param path - The parsed path
 * @param definitions - The served definitions
 * @returns The target, or `invalidPath`
 */
function resolveTarget(
	resource: WireObject,
	path: Patch.Path,
	definitions: Discovery.Definitions,
): Target | ScimError {
	let text = pathText(path);
	let resolved = resolvePath(path.attribute, definitions, declaredSchemas(resource));
	if (!resolved) return badRequest("invalidPath", `"${text}" is not a known attribute.`);

	let sub = resolved.subAttribute;
	if (path.subAttribute !== null) {
		sub = findAttribute(resolved.attribute.subAttributes, path.subAttribute) ?? null;
		if (!sub)
			return badRequest(
				"invalidPath",
				`"${text}" names no sub-attribute of ${resolved.attribute.name}.`,
			);
	}
	if (path.filter && !resolved.attribute.multiValued) {
		return badRequest(
			"invalidPath",
			`"${text}" filters ${resolved.attribute.name}, which is single-valued.`,
		);
	}
	return { resolved, sub, filter: path.filter, text };
}

/**
 * The object an attribute is written into: the resource, or its URN-keyed extension object,
 * created (and added to `schemas`) when `create` is set.
 *
 * @param resource - The resource copy being patched
 * @param resolved - The resolved attribute
 * @param definitions - The served definitions
 * @param create - Whether a missing extension object should be created
 * @returns The container, or `undefined` when the extension is absent and not created
 */
function writeContainer(
	resource: WireObject,
	resolved: ResolvedPath,
	definitions: Discovery.Definitions,
	create: boolean,
): WireObject | undefined {
	let schema = resolved.schema;
	if (schema === null || isCoreSchema(resource, schema, definitions)) return resource;

	let key = findKey(resource, schema.id);
	let existing = key === undefined ? undefined : resource[key];
	if (isWireObject(existing)) return existing;
	if (!create) return undefined;

	let extension: WireObject = {};
	resource[key ?? schema.id] = extension;
	let schemas = readKey(resource, "schemas");
	let lower = schema.id.toLowerCase();
	if (
		Array.isArray(schemas) &&
		!schemas.some((urn) => typeof urn === "string" && urn.toLowerCase() === lower)
	) {
		schemas.push(schema.id);
	}
	return extension;
}

/**
 * Drops an extension object a `remove` emptied, and its URN from `schemas`, since RFC 7643
 * §2.5 treats an empty value as unassigned.
 *
 * @param resource - The resource copy being patched
 * @param container - The container the operation wrote to
 * @param resolved - The resolved attribute
 */
function dropEmptyExtension(
	resource: WireObject,
	container: WireObject,
	resolved: ResolvedPath,
): void {
	if (container === resource || resolved.schema === null || isPresent(container)) return;
	let schemaId = resolved.schema.id;
	let key = findKey(resource, schemaId);
	if (key !== undefined) delete resource[key];
	let schemas = readKey(resource, "schemas");
	if (!Array.isArray(schemas)) return;
	let index = schemas.findIndex(
		(urn) => typeof urn === "string" && urn.toLowerCase() === schemaId.toLowerCase(),
	);
	if (index !== -1) schemas.splice(index, 1);
}

/**
 * Refuses writes RFC 7643 §2.2 forbids: any change to a `readOnly` attribute, and a change
 * to an `immutable` one that already has a value. Writing back the current value is allowed.
 *
 * @param target - The resolved target
 * @param current - The value on the resource now
 * @param next - The value the operation would leave, `undefined` for a removal
 * @returns `mutability`, or `null` when the write is allowed
 */
function checkMutability(target: Target, current: unknown, next: unknown): ScimError | null {
	if (deepEqual(current, next)) return null;
	let written = target.sub ?? target.resolved.attribute;
	if (target.resolved.attribute.mutability === "readOnly" || written.mutability === "readOnly") {
		return badRequest("mutability", `${target.text} is read-only.`);
	}
	if (written.mutability === "immutable" && isPresent(current)) {
		return badRequest("mutability", `${target.text} is immutable.`);
	}
	return null;
}

/**
 * The sub-attribute values a value filter pins down with `eq`, such as `type` and `work` in
 * `emails[type eq "work"]`, used to create the value an `add` targets when none matches.
 *
 * @param filter - The value filter
 * @param attribute - The multi-valued attribute
 * @returns The pinned values, or `null` when the filter is not a conjunction of `eq`
 */
function pinnedValues(
	filter: Filter.Expression,
	attribute: Discovery.Attribute,
): WireObject | null {
	if (filter.kind === "and") {
		let left = pinnedValues(filter.left, attribute);
		let right = pinnedValues(filter.right, attribute);
		return left && right ? { ...left, ...right } : null;
	}
	if (filter.kind !== "compare" || filter.operator !== "eq" || filter.value === null) return null;
	let sub = findAttribute(attribute.subAttributes, filter.path.attribute);
	if (!sub || filter.path.schema !== null || filter.path.subAttribute !== null) return null;
	return { [sub.name]: filter.value };
}

/**
 * Keeps RFC 7643 §2.4's "at most one primary": when a written value is primary, the flag is
 * removed from every other value.
 *
 * @param values - The attribute's values after the write
 * @param written - The values the operation wrote
 */
function keepOnePrimary(values: unknown[], written: unknown[]): void {
	let primary = written.find((value) => isWireObject(value) && readKey(value, "primary") === true);
	if (primary === undefined) return;
	for (let value of values) {
		if (value === primary || !isWireObject(value)) continue;
		let key = findKey(value, "primary");
		if (key !== undefined) delete value[key];
	}
}

/**
 * Writes a sub-attribute into a complex value, reusing the key's existing casing.
 *
 * @param value - The complex value
 * @param sub - The sub-attribute
 * @param next - The value to write
 */
function writeSub(value: WireObject, sub: Discovery.Attribute, next: unknown): void {
	value[findKey(value, sub.name) ?? sub.name] = next;
}

/**
 * Removes a sub-attribute from a complex value.
 *
 * @param value - The complex value
 * @param sub - The sub-attribute
 */
function removeSub(value: WireObject, sub: Discovery.Attribute): void {
	let key = findKey(value, sub.name);
	if (key !== undefined) delete value[key];
}

/**
 * Applies an operation whose path carries a value filter: it acts on the matching values,
 * and a filter matching nothing is `noTarget`, except that an `add` whose filter pins values
 * with `eq` appends a new value built from them, which is how Entra ID adds a work email.
 *
 * @param op - The operation name
 * @param target - The resolved target
 * @param values - The attribute's current values, mutated in place
 * @param value - The operation's value
 * @param definitions - The served definitions
 * @returns An error, or `null` on success
 */
function applyFiltered(
	op: Patch.Operation["op"],
	target: Target,
	values: unknown[],
	value: unknown,
	definitions: Discovery.Definitions,
): ScimError | null {
	let attribute = target.resolved.attribute;
	let test = compileValueFilter(target.filter as Filter.Expression, target.resolved, definitions);
	if (test instanceof ScimError)
		return badRequest("invalidPath", `${target.text}: ${test.message}`);
	let matched = values.filter((item) => test(item));
	let sub = target.sub;

	if (op === "remove") {
		if (matched.length === 0) return badRequest("noTarget", `${target.text} matches no value.`);
		if (sub) {
			for (let item of matched) if (isWireObject(item)) removeSub(item, sub);
		} else {
			let kept = values.filter((item) => !matched.includes(item));
			values.splice(0, values.length, ...kept);
		}
		return null;
	}

	if (matched.length === 0) {
		let pinned = op === "add" && target.filter ? pinnedValues(target.filter, attribute) : null;
		if (!pinned) return badRequest("noTarget", `${target.text} matches no value.`);
		let created = sub
			? { ...pinned, [sub.name]: value }
			: isWireObject(value)
				? { ...pinned, ...value }
				: null;
		if (!created) return badRequest("invalidValue", `${target.text} needs an object value.`);
		values.push(created);
		keepOnePrimary(values, [created]);
		return null;
	}

	if (sub) {
		for (let item of matched) if (isWireObject(item)) writeSub(item, sub, value);
		keepOnePrimary(values, sub.name === "primary" && value === true ? matched.slice(0, 1) : []);
		return null;
	}

	if (!isWireObject(value))
		return badRequest("invalidValue", `${target.text} needs an object value.`);
	let written: unknown[] = [];
	for (let [index, item] of values.entries()) {
		if (!matched.includes(item)) continue;
		let next = op === "replace" ? { ...value } : { ...(isWireObject(item) ? item : {}), ...value };
		values[index] = next;
		written.push(next);
	}
	keepOnePrimary(values, written);
	return null;
}

/**
 * Reads a bare value written to a complex attribute as its `value` sub-attribute, as Entra ID
 * sets `manager` to an id string; arrays are read item by item.
 *
 * @param value - The operation's value
 * @returns The value with primitives wrapped as `{ value }`
 */
function wrapPrimitives(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(wrapPrimitives);
	let primitive =
		typeof value === "string" || typeof value === "number" || typeof value === "boolean";
	return primitive ? { value } : value;
}

/**
 * Applies one operation at a resolved path.
 *
 * @param resource - The resource copy being patched
 * @param op - The operation name
 * @param path - The parsed path
 * @param rawValue - The operation's value as sent
 * @param definitions - The served definitions
 * @returns An error, or `null` on success
 */
function applyAtPath(
	resource: WireObject,
	op: Patch.Operation["op"],
	path: Patch.Path,
	rawValue: unknown,
	definitions: Discovery.Definitions,
): ScimError | null {
	let target = resolveTarget(resource, path, definitions);
	if (target instanceof ScimError) return target;
	let { resolved, sub } = target;
	let attribute = resolved.attribute;

	let container = writeContainer(resource, resolved, definitions, op !== "remove");
	if (!container) {
		return target.filter ? badRequest("noTarget", `${target.text} matches no value.`) : null;
	}
	let key = findKey(container, attribute.name) ?? attribute.name;
	let current = container[key];

	let valueSub = sub ? undefined : findAttribute(attribute.subAttributes, "value");
	let wrapped = valueSub ? wrapPrimitives(rawValue) : rawValue;
	let coerceAs =
		sub ??
		(attribute.multiValued && (target.filter !== null || !Array.isArray(wrapped))
			? { ...attribute, multiValued: false }
			: attribute);
	let value = coerceBooleans(wrapped, coerceAs);

	if (attribute.multiValued) {
		let values = Array.isArray(current) ? structuredClone(current) : [];
		let error = applyMultiValued(op, target, values, value, definitions);
		if (error) return error;
		let next = values.length > 0 ? values : undefined;
		let refused = checkMutability(target, current, next);
		if (refused) return refused;
		if (next === undefined) delete container[key];
		else container[key] = next;
	} else {
		let next = singleValued(op, target, current, value);
		if (next instanceof ScimError) return next;
		let refused = checkMutability(target, current, next);
		if (refused) return refused;
		if (next === undefined || (isWireObject(next) && !isPresent(next))) delete container[key];
		else container[key] = next;
	}

	dropEmptyExtension(resource, container, resolved);
	return null;
}

/**
 * The next value of a single-valued attribute. `add` and `replace` both set a simple
 * attribute and merge into a complex one (RFC 7644 §3.5.2.1 and §3.5.2.3), and a sub-attribute
 * path writes or removes just that member.
 *
 * @param op - The operation name
 * @param target - The resolved target
 * @param current - The attribute's current value
 * @param value - The coerced operation value
 * @returns The next value (`undefined` to unassign), or `invalidValue`
 */
function singleValued(
	op: Patch.Operation["op"],
	target: Target,
	current: unknown,
	value: unknown,
): unknown {
	let base: WireObject = isWireObject(current) ? { ...current } : {};
	if (target.sub) {
		if (op === "remove") removeSub(base, target.sub);
		else writeSub(base, target.sub, value);
		return base;
	}
	if (op === "remove") return undefined;
	if (target.resolved.attribute.type !== "complex") return value;
	if (!isWireObject(value)) {
		return badRequest("invalidValue", `${target.text} is complex and needs an object value.`);
	}
	return { ...base, ...value };
}

/**
 * Applies an operation to a multi-valued attribute's values, in place. `add` appends values
 * not already present, `replace` swaps the whole set, and `remove` clears it, or, given a
 * value list as Entra ID sends for group members, removes the values matching those items.
 *
 * @param op - The operation name
 * @param target - The resolved target
 * @param values - The current values, mutated in place
 * @param value - The coerced operation value
 * @param definitions - The served definitions
 * @returns An error, or `null` on success
 */
function applyMultiValued(
	op: Patch.Operation["op"],
	target: Target,
	values: unknown[],
	value: unknown,
	definitions: Discovery.Definitions,
): ScimError | null {
	if (target.filter) return applyFiltered(op, target, values, value, definitions);

	if (target.sub) {
		if (values.length === 0) return badRequest("noTarget", `${target.text} has no values.`);
		for (let item of values) {
			if (!isWireObject(item)) continue;
			if (op === "remove") removeSub(item, target.sub);
			else writeSub(item, target.sub, value);
		}
		return null;
	}

	let incoming = Array.isArray(value) ? value : value === undefined ? [] : [value];

	if (op === "remove") {
		if (incoming.length === 0) {
			values.splice(0, values.length);
			return null;
		}
		let kept = values.filter((item) => !incoming.some((pattern) => matchesItem(item, pattern)));
		values.splice(0, values.length, ...kept);
		return null;
	}

	if (op === "replace") values.splice(0, values.length);
	let written: unknown[] = [];
	for (let item of incoming) {
		if (values.some((existing) => deepEqual(existing, item))) continue;
		values.push(item);
		written.push(item);
	}
	keepOnePrimary(values, written);
	return null;
}

/**
 * Whether a value matches an item of a `remove` value list: every member the item names
 * equals the value's, so `{ value: "id" }` selects the member with that id.
 *
 * @param item - An existing value
 * @param pattern - An item of the operation's value list
 * @returns Whether the value is selected
 */
function matchesItem(item: unknown, pattern: unknown): boolean {
	if (!isWireObject(pattern) || !isWireObject(item)) return deepEqual(item, pattern);
	return Object.entries(pattern).every(([key, expected]) =>
		deepEqual(readKey(item, key), expected),
	);
}

/**
 * Applies a path-less `add` or `replace`: each member of the value object is applied at its
 * own path. A member named by a schema URN applies each of its members inside that schema,
 * and a member whose name is itself a path (`name.givenName`) is applied at that path.
 *
 * @param resource - The resource copy being patched
 * @param op - `add` or `replace`
 * @param value - The object of attributes
 * @param definitions - The served definitions
 * @returns An error, or `null` on success
 */
function applyWithoutPath(
	resource: WireObject,
	op: Patch.Operation["op"],
	value: WireObject,
	definitions: Discovery.Definitions,
): ScimError | null {
	for (let [name, member] of Object.entries(value)) {
		if (name.toLowerCase() === "schemas") continue;

		let schema = findSchema(definitions, name);
		let entries: [string, unknown][] =
			schema && isWireObject(member)
				? Object.entries(member).map(([key, item]) => [`${schema.id}:${key}`, item])
				: [[name, member]];

		for (let [text, item] of entries) {
			let path = parsePatchPath(text);
			if (isFailure(path)) return path.error;
			let error = applyAtPath(resource, op, path.data, item, definitions);
			if (error) return error;
		}
	}
	return null;
}

/**
 * Applies PATCH operations to a wire-shaped resource, in order, returning the patched copy.
 * The first failure returns before the caller's resource is touched: a value filter matching
 * nothing is `noTarget` for `remove` and `replace`, and a read-only change is `mutability`.
 *
 * @param resource - The current wire representation
 * @param operations - Operations from `parsePatch`
 * @param options - The definitions that type every attribute
 * @returns The patched copy
 * @example applyPatch(userResource(user), unwrap(parsePatch(body)), { definitions })
 */
export function applyPatch<Resource extends object>(
	resource: Resource,
	operations: Patch.Operation[],
	options: Patch.ApplyOptions,
): Result<Resource, ScimError> {
	let copy = structuredClone(resource) as unknown as WireObject;

	for (let [index, operation] of operations.entries()) {
		let error =
			operation.path === null
				? isWireObject(operation.value)
					? applyWithoutPath(copy, operation.op, operation.value, options.definitions)
					: badRequest(
							operation.op === "remove" ? "noTarget" : "invalidValue",
							"The operation needs a path.",
						)
				: applyAtPath(copy, operation.op, operation.path, operation.value, options.definitions);
		if (error) {
			return failure(
				new ScimError(error.status, `Operations[${index}]: ${error.message}`, {
					scimType: error.scimType ?? undefined,
				}),
			);
		}
	}

	return success(copy as unknown as Resource);
}
