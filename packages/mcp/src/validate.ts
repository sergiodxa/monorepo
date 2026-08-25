/**
 * Runtime validation of a tool call's arguments against the schema the tool published.
 *
 * The schema on the wire and the schema checked here are the same object, so a client
 * cannot be told one contract and held to another. Validation runs before a handler is
 * entered, which is what lets a handler treat its argument as the type
 * `FromObjectSchema` derived rather than re-checking it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { ObjectSchema, PropertySchema } from "./schema";

import { InvalidArgumentsError } from "./errors";

/**
 * Checks `value` against `schema`, filling in defaults and dropping unknown properties.
 *
 * Unknown properties are dropped rather than refused because a model that invents an
 * extra argument has still asked for something the tool can do, and failing the call
 * teaches it nothing it can act on. A missing or mistyped *declared* argument is a
 * refusal, since running the handler on it would be guessing.
 *
 * Every constraint is checked before returning, so a caller that got two arguments wrong
 * learns about both in one round trip instead of discovering them one call at a time.
 *
 * @param schema The tool's argument schema.
 * @param value The `arguments` object from a `tools/call` request, possibly absent.
 * @returns Every handler-visible property, or the collected constraint failures.
 * @example
 * let checked = validateArguments(schema, { query: "remix" });
 */
export function validateArguments(
	schema: ObjectSchema,
	value: unknown,
): Result<Record<string, unknown>, InvalidArgumentsError> {
	let issues: string[] = [];
	// A tool taking no arguments is called with `arguments` omitted entirely, which is a
	// valid call rather than a missing object.
	let candidate = value === undefined || value === null ? {} : value;
	let checked = checkObject(schema, candidate, "", issues);

	if (issues.length > 0) return failure(new InvalidArgumentsError(issues));
	return success(checked as Record<string, unknown>);
}

/** Names a property for an issue message, using `(root)` for the argument object itself. */
function label(path: string): string {
	return path === "" ? "(root)" : path;
}

/** Joins a parent path with a child property name or array index. */
function join(path: string, key: string | number): string {
	if (typeof key === "number") return `${label(path)}[${key}]`;
	return path === "" ? key : `${path}.${key}`;
}

/**
 * Checks one value against one schema.
 *
 * Failures are pushed onto `issues` rather than returned, so a caller reads the whole
 * list once at the end and every checker can keep collecting past the first problem.
 * The return value is the coerced value, and is meaningless when `issues` grew.
 */
function check(schema: PropertySchema, value: unknown, path: string, issues: string[]): unknown {
	switch (schema.type) {
		case "string": {
			return checkString(schema, value, path, issues);
		}
		case "number":
		case "integer": {
			return checkNumber(schema, value, path, issues);
		}
		case "boolean": {
			if (typeof value === "boolean") return value;
			issues.push(`${label(path)}: expected a boolean`);
			return undefined;
		}
		case "array": {
			return checkArray(schema, value, path, issues);
		}
		case "object": {
			return checkObject(schema, value, path, issues);
		}
	}
}

/** Checks a string, its enum membership, and its length and pattern bounds. */
function checkString(
	schema: Extract<PropertySchema, { type: "string" }>,
	value: unknown,
	path: string,
	issues: string[],
): string | undefined {
	if (typeof value !== "string") {
		issues.push(`${label(path)}: expected a string`);
		return undefined;
	}

	if (schema.enum && !schema.enum.includes(value)) {
		issues.push(`${label(path)}: expected one of ${schema.enum.join(", ")}`);
	}
	if (schema.minLength !== undefined && value.length < schema.minLength) {
		issues.push(`${label(path)}: expected at least ${schema.minLength} characters`);
	}
	if (schema.maxLength !== undefined && value.length > schema.maxLength) {
		issues.push(`${label(path)}: expected at most ${schema.maxLength} characters`);
	}
	if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
		issues.push(`${label(path)}: expected to match ${schema.pattern}`);
	}

	return value;
}

/** Checks a finite number, its integer-ness where required, and its range. */
function checkNumber(
	schema: Extract<PropertySchema, { type: "number" | "integer" }>,
	value: unknown,
	path: string,
	issues: string[],
): number | undefined {
	// `Number.isFinite` rather than a `typeof` test alone: JSON has no `NaN` or
	// `Infinity` literal, but a client may still send one through a lenient encoder, and
	// every bound below would silently pass it.
	if (typeof value !== "number" || !Number.isFinite(value)) {
		issues.push(`${label(path)}: expected a number`);
		return undefined;
	}

	if (schema.type === "integer" && !Number.isInteger(value)) {
		issues.push(`${label(path)}: expected a whole number`);
	}
	if (schema.minimum !== undefined && value < schema.minimum) {
		issues.push(`${label(path)}: expected ${schema.minimum} or more`);
	}
	if (schema.maximum !== undefined && value > schema.maximum) {
		issues.push(`${label(path)}: expected ${schema.maximum} or less`);
	}

	return value;
}

/** Checks an array's length bounds and every element against the item schema. */
function checkArray(
	schema: Extract<PropertySchema, { type: "array" }>,
	value: unknown,
	path: string,
	issues: string[],
): unknown[] | undefined {
	if (!Array.isArray(value)) {
		issues.push(`${label(path)}: expected an array`);
		return undefined;
	}

	if (schema.minItems !== undefined && value.length < schema.minItems) {
		issues.push(`${label(path)}: expected at least ${schema.minItems} items`);
	}
	if (schema.maxItems !== undefined && value.length > schema.maxItems) {
		issues.push(`${label(path)}: expected at most ${schema.maxItems} items`);
	}

	return value.map((item, index) => check(schema.items, item, join(path, index), issues));
}

/** Checks required properties, validates declared ones, and applies defaults. */
function checkObject(
	schema: ObjectSchema,
	value: unknown,
	path: string,
	issues: string[],
): Record<string, unknown> | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		issues.push(`${label(path)}: expected an object`);
		return undefined;
	}

	let source = value as Record<string, unknown>;
	let required = new Set(schema.required ?? []);
	let checked: Record<string, unknown> = {};

	for (let [name, property] of Object.entries(schema.properties)) {
		// `undefined` counts as absent: a client that spells an omitted argument as `null`
		// or leaves the key out entirely means the same thing, and JSON has no `undefined`.
		let present =
			Object.hasOwn(source, name) && source[name] !== undefined && source[name] !== null;

		if (!present) {
			if (required.has(name)) issues.push(`${join(path, name)}: is required`);
			else if ("default" in property) checked[name] = property.default;
			continue;
		}

		checked[name] = check(property, source[name], join(path, name), issues);
	}

	return checked;
}
