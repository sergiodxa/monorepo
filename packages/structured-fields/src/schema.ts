/**
 * `remix/data-schema` schemas over the Structured Field model, so a field's shape is
 * declared once and `parse` or `getField` hands back typed values. The helpers unwrap
 * `Token`, `Decimal` and `DisplayString` and compose with `s.object`, `s.array` and checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Issue, ParseOptions, Schema } from "remix/data-schema";

import { createSchema, fail } from "remix/data-schema";

import type { SF } from "./index.js";

import { Decimal, DisplayString, Token } from "./index.js";

/** Where a nested schema runs, carried so its issues point into the whole field. */
interface Context {
	path: NonNullable<Issue["path"]>;
	options?: ParseOptions;
}

/** The largest magnitude an Integer may carry: fifteen nines. */
const MAX_INTEGER = 999_999_999_999_999;

/** The schema builders, as one catalog of functions. */
export interface StructuredFieldSchemas {
	/** An Integer, checked against the RFC range of fifteen digits. */
	integer(): Schema<SF.BareItem, number>;
	/** A Decimal or Integer, output as `number`. */
	decimal(): Schema<SF.BareItem, number>;
	/**
	 * A Token, output as its text; with a list, narrowed to those literals.
	 *
	 * @template T - The literals the field allows
	 */
	token<const T extends string = string>(allowed?: readonly T[]): Schema<SF.BareItem, T>;
	/** A Display String, output as its text. A plain sf-string is `s.string()`. */
	displayString(): Schema<SF.BareItem, string>;
	/** A Byte Sequence. */
	bytes(): Schema<SF.BareItem, Uint8Array>;
	/** A Date. */
	date(): Schema<SF.BareItem, Date>;
	/**
	 * An Item: its bare value through `value`, its parameters through `params`, which pass
	 * through untouched when no parameter schema is given.
	 *
	 * @template V - The bare value's output
	 * @template P - The parameters' output
	 */
	item<V, P = SF.Parameters>(
		value: SF.SyncSchema<V>,
		params?: SF.SyncSchema<P>,
	): Schema<SF.Member, { value: V; params: P }>;
	/**
	 * An Item whose parameters the caller ignores, output as its bare value alone.
	 *
	 * @template V - The bare value's output
	 */
	value<V>(value: SF.SyncSchema<V>): Schema<SF.Member, V>;
	/**
	 * An Inner List of items matching `item`.
	 *
	 * @template I - Each item's output
	 * @template P - The list parameters' output
	 */
	innerList<I, P = SF.Parameters>(
		item: SF.SyncSchema<I>,
		params?: SF.SyncSchema<P>,
	): Schema<SF.Member, { items: I[]; params: P }>;
}

/**
 * Runs a nested schema at a path inside the field. A `remix/data-schema` schema runs with
 * the path and options directly; any other Standard Schema has its issue paths prefixed.
 *
 * @param schema - The nested schema
 * @param value - The nested value
 * @param context - Where it sits
 * @returns The nested result
 */
function run<Output>(
	schema: SF.SyncSchema<Output>,
	value: unknown,
	context: Context,
): StandardSchemaV1.Result<Output> {
	if ("~run" in schema && typeof schema["~run"] === "function") {
		return (schema as unknown as Schema<unknown, Output>)["~run"](value, context);
	}
	let result: StandardSchemaV1.Result<Output> | Promise<unknown> = schema["~standard"].validate(
		value,
		context.options,
	);
	if (result instanceof Promise) return fail("Schema must validate synchronously", context.path);
	if (!result.issues) return result;
	return {
		issues: result.issues.map((issue) => ({
			...issue,
			path: [...context.path, ...(issue.path ?? [])],
		})),
	};
}

/**
 * Builds the failure a helper reports for an input of the wrong type.
 *
 * @param message - What the helper expected
 * @param code - The error-map code, so callers can localize the message
 * @param value - The input
 * @param context - Where it sits
 * @returns The failure
 */
function reject(
	message: string,
	code: string,
	value: unknown,
	context: Context,
): StandardSchemaV1.FailureResult {
	return fail(message, context.path, { code, input: value, parseOptions: context.options });
}

/**
 * @param value - Any model value
 * @returns Whether it is an Item, the member form without `items`
 */
function isItem(value: unknown): value is SF.Item {
	return typeof value === "object" && value !== null && "value" in value && !("items" in value);
}

/**
 * @param value - Any model value
 * @returns Whether it is an Inner List
 */
function isInnerList(value: unknown): value is SF.InnerList {
	return (
		typeof value === "object" && value !== null && "items" in value && Array.isArray(value.items)
	);
}

/**
 * Validates a member's parameters, passing them through when no schema is given.
 *
 * @param schema - The parameter schema, if any
 * @param params - The member's parameters
 * @param context - Where the member sits
 * @returns The parameters' result
 */
function runParams<P>(
	schema: SF.SyncSchema<P> | undefined,
	params: SF.Parameters | undefined,
	context: Context,
): StandardSchemaV1.Result<P> {
	let input = params ?? Object.create(null);
	if (schema === undefined) return { value: input as P };
	return run(schema, input, { path: [...context.path, "params"], options: context.options });
}

/**
 * The Structured Field schema builders. Each call returns a fresh schema, and none holds
 * state, so a field's schema is built once at module scope and reused on every request.
 *
 * @example s.object({ u: s.optional(sf.value(sf.integer())) })
 * @example sf.item(sf.token(), s.object({ ttl: s.optional(sf.integer()) }))
 */
export const sf: StructuredFieldSchemas = {
	integer() {
		return createSchema((value, context) => {
			if (typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= MAX_INTEGER) {
				return { value };
			}
			return reject("Expected an Integer", "sf.integer", value, context);
		});
	},

	decimal() {
		return createSchema((value, context) => {
			if (value instanceof Decimal) return { value: value.value };
			if (typeof value === "number" && Number.isFinite(value)) return { value };
			return reject("Expected a Decimal", "sf.decimal", value, context);
		});
	},

	token<const T extends string = string>(allowed?: readonly T[]) {
		return createSchema<SF.BareItem, T>((value, context) => {
			if (!(value instanceof Token)) return reject("Expected a Token", "sf.token", value, context);
			if (allowed && !allowed.includes(value.value as T)) {
				return fail(`Expected one of ${allowed.join(", ")}`, context.path, {
					code: "sf.token.allowed",
					input: value,
					values: { allowed: allowed.join(", ") },
					parseOptions: context.options,
				});
			}
			return { value: value.value as T };
		});
	},

	displayString() {
		return createSchema((value, context) => {
			if (value instanceof DisplayString) return { value: value.value };
			return reject("Expected a Display String", "sf.displayString", value, context);
		});
	},

	bytes() {
		return createSchema((value, context) => {
			if (value instanceof Uint8Array) return { value };
			return reject("Expected a Byte Sequence", "sf.bytes", value, context);
		});
	},

	date() {
		return createSchema((value, context) => {
			if (value instanceof Date) return { value };
			return reject("Expected a Date", "sf.date", value, context);
		});
	},

	item<V, P = SF.Parameters>(value: SF.SyncSchema<V>, params?: SF.SyncSchema<P>) {
		return createSchema<SF.Member, { value: V; params: P }>((input, context) => {
			if (!isItem(input)) return reject("Expected an Item", "sf.item", input, context);
			let bare = run(value, input.value, {
				path: [...context.path, "value"],
				options: context.options,
			});
			let parameters = runParams(params, input.params, context);
			if (bare.issues || parameters.issues) {
				return { issues: [...(bare.issues ?? []), ...(parameters.issues ?? [])] };
			}
			return { value: { value: bare.value, params: parameters.value } };
		});
	},

	value<V>(value: SF.SyncSchema<V>) {
		return createSchema<SF.Member, V>((input, context) => {
			if (!isItem(input)) return reject("Expected an Item", "sf.item", input, context);
			return run(value, input.value, {
				path: [...context.path, "value"],
				options: context.options,
			});
		});
	},

	innerList<I, P = SF.Parameters>(item: SF.SyncSchema<I>, params?: SF.SyncSchema<P>) {
		return createSchema<SF.Member, { items: I[]; params: P }>((input, context) => {
			if (!isInnerList(input)) {
				return reject("Expected an Inner List", "sf.innerList", input, context);
			}
			let issues: StandardSchemaV1.Issue[] = [];
			let items: I[] = [];
			input.items.forEach((member, index) => {
				let result = run(item, member, {
					path: [...context.path, "items", index],
					options: context.options,
				});
				if (result.issues) issues.push(...result.issues);
				else items.push(result.value);
			});
			let parameters = runParams(params, input.params, context);
			if (parameters.issues) issues.push(...parameters.issues);
			if (issues.length > 0 || parameters.issues) return { issues };
			return { value: { items, params: parameters.value } };
		});
	},
};
