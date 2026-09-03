/**
 * Runtime validation of a tool call's arguments against the schema the tool published.
 *
 * The schema on the wire and the schema checked here are the same object, so a client
 * cannot be told one contract and held to another. Validation runs before a handler is
 * entered, so a handler's argument arrives already checked, typed as `FromObjectSchema`
 * derives it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { ObjectSchema, PropertySchema } from "./schema.js";

import { InvalidArgumentsError } from "./errors.js";

/**
 * Checks `value` against `schema`, filling in defaults and dropping unknown properties:
 * a model's stray argument still names something the tool can do, so only a missing or
 * mistyped *declared* argument is a refusal, with every constraint checked before returning.
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
	let candidate = value === undefined || value === null ? {} : value;
	let checked = checkObject(schema, candidate, "", issues);

	if (issues.length > 0) return failure(new InvalidArgumentsError(issues));
	return success(checked as Record<string, unknown>);
}

function label(path: string): string {
	return path === "" ? "(root)" : path;
}

function join(path: string, key: string | number): string {
	if (typeof key === "number") return `${label(path)}[${key}]`;
	return path === "" ? key : `${path}.${key}`;
}

/**
 * Checks one value against one schema, pushing failures onto `issues` so a caller reads
 * the whole list once at the end while every checker keeps collecting past the first
 * problem; the return value is meaningless once `issues` has grown.
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

/**
 * Checks a finite number, its integer-ness where required, and its range. Confirms
 * finiteness explicitly, since JSON has no `NaN` or `Infinity` literal that a lenient
 * encoder might still let through, past every bound below.
 */
function checkNumber(
	schema: Extract<PropertySchema, { type: "number" | "integer" }>,
	value: unknown,
	path: string,
	issues: string[],
): number | undefined {
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

/**
 * Checks required properties, validates declared ones, and applies defaults.
 *
 * A property counts as absent whether a client spells it `null` or omits the key
 * entirely — JSON carries no `undefined`, so both mean the same thing here.
 */
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
