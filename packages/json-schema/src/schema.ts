/**
 * The combinators: each has the name and signature of its `remix/data-schema`
 * counterpart, validates by delegating to it, and adds the JSON Schema 2020-12
 * keywords that describe what it accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { InferInput, InferOutput } from "remix/data-schema";

import { success } from "@sdxc/result";
import * as ds from "remix/data-schema";
import { lazy as dataLazy } from "remix/data-schema/lazy";

import type { JSONSchemaConversionError } from "./error.js";
import type { Describe, DescribeContext } from "./node.js";
import type { DescribedSchema, JSONSchema, Schema } from "./types.js";

import { describeChild, named, nodeOf, wrap } from "./node.js";

/** Any schema a combinator nests, whatever its types. */
type AnySchema = DescribedSchema<any, any>;

/** Flattens an intersection so hovers and errors show one object type. */
type Simplify<T> = { [Key in keyof T]: T[Key] } & {};

/** The keys whose value may be `undefined`, which an object leaves optional. */
type OptionalKeys<T> = { [Key in keyof T]-?: undefined extends T[Key] ? Key : never }[keyof T];

/** Turns keys that accept `undefined` into optional keys, so a caller may leave them out. */
type WithOptionalKeys<T> = Simplify<
	{ [Key in Exclude<keyof T, OptionalKeys<T>>]: T[Key] } & { [Key in OptionalKeys<T>]?: T[Key] }
>;

/** What `object(shape)` accepts. */
export type ObjectInput<Shape extends Record<string, AnySchema>> = WithOptionalKeys<{
	[Key in keyof Shape]: InferInput<Shape[Key]>;
}>;

/** What `object(shape)` produces. */
export type ObjectOutput<Shape extends Record<string, AnySchema>> = WithOptionalKeys<{
	[Key in keyof Shape]: InferOutput<Shape[Key]>;
}>;

/** How `object` treats keys its shape does not name; `"error"` documents as `additionalProperties: false`. */
export interface ObjectOptions {
	/** @default "strip" */
	unknownKeys?: "strip" | "passthrough" | "error";
}

/** A describer for a schema whose keywords never depend on the context. */
function fixed(json: JSONSchema): Describe {
	return () => success({ ...json });
}

/** The JSON type of a literal, so `const` and `enum` also document what kind of value they are. */
function typeOf(value: unknown): JSONSchema.TypeName | undefined {
	if (typeof value === "string") return "string";
	if (typeof value === "boolean") return "boolean";
	if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
	if (value === null) return "null";
	return undefined;
}

/** The scalar types `nullable` widens with `"null"` in place of an `anyOf`. */
const SCALAR_TYPES = new Set<JSONSchema.TypeName>([
	"string",
	"number",
	"integer",
	"boolean",
	"null",
]);

/**
 * Accepts any value, documented as `{}`.
 *
 * @example let payload = s.any();
 */
export function any(): Schema<unknown> {
	return wrap(ds.any(), { describe: fixed({}) });
}

/**
 * Accepts an array whose every item passes `item`.
 *
 * @param item - The schema each item must pass.
 * @example let tags = s.array(s.string());
 */
export function array<Item extends AnySchema>(
	item: Item,
): Schema<InferInput<Item>[], InferOutput<Item>[]> {
	return wrap(ds.array(item), {
		describe(context) {
			let items = describeChild(item, context, "items");
			if (items.status === "failure") return items;
			return success({ type: "array", items: items.data });
		},
	});
}

/** Accepts `true` or `false`. */
export function boolean(): Schema<boolean> {
	return wrap(ds.boolean(), { describe: fixed({ type: "boolean" }) });
}

/**
 * Substitutes `value` for an absent input. The key leaves the input side's `required` and
 * documents `default`; the output side keeps it required, since a parse always yields it.
 *
 * @param schema - The schema a present value must pass.
 * @param value - What an `undefined` input becomes.
 * @example let limit = s.defaulted(s.integer(), 20);
 */
export function defaulted<S extends AnySchema>(
	schema: S,
	value: InferOutput<S>,
): Schema<InferInput<S> | undefined, InferOutput<S>> {
	return wrap(ds.defaulted(schema, value), {
		presence: "defaulted",
		transformed: nodeOf(schema)?.transformed,
		describe(context) {
			let described = describeChild(schema, context);
			if (described.status === "failure") return described;
			return success({ ...described.data, default: value });
		},
	});
}

/**
 * Accepts one of `values`, compared with `===`.
 *
 * @param values - The allowed values, at least one.
 * @example let role = s.enum_(["owner", "member"]);
 */
export function enum_<const Values extends readonly [string | number, ...(string | number)[]]>(
	values: Values,
): Schema<Values[number]> {
	let types = new Set(values.map(typeOf));
	let json: JSONSchema = { enum: [...values] };
	let [only] = types;
	if (types.size === 1 && only !== undefined) json = { type: only, ...json };
	return wrap(ds.enum_(values), { describe: fixed(json) });
}

/** The check `integer` pipes into `number`, reported as data-schema reports its type failures. */
const INTEGER_CHECK: ds.Check<number> = {
	check: (value) => Number.isInteger(value),
	code: "type.integer",
	message: "Expected integer",
};

/**
 * Accepts a finite whole number, documented as `type: "integer"`. It validates as
 * `number()` followed by `Number.isInteger`, so `1.0` passes, as JSON Schema says.
 */
export function integer(): Schema<number> {
	return wrap(ds.number().pipe(INTEGER_CHECK), { describe: fixed({ type: "integer" }) });
}

/**
 * Defers building a schema until first use, for a schema that contains itself. It always
 * documents as a `$ref` into `$defs` under `id`, which is what makes recursion terminate.
 *
 * @param get - Returns the schema; called once, on first validation or description.
 * @param annotations - `id` names the schema in `$defs`.
 * @example const CATEGORY: s.Schema<unknown, Category> = s.lazy(() => s.object({ children: s.array(CATEGORY) }), { id: "Category" });
 */
export function lazy<S extends AnySchema>(
	get: () => S,
	annotations: { id: string },
): Schema<InferInput<S>, InferOutput<S>> {
	return wrap(dataLazy(get), {
		describe: named((context) => describeChild(get(), context), annotations.id, true),
	});
}

/**
 * Accepts exactly `value`, documented as `const`.
 *
 * @param value - The only accepted value.
 * @example let kind = s.literal("http");
 */
export function literal<const Value extends string | number | boolean>(
	value: Value,
): Schema<Value> {
	let type = typeOf(value);
	return wrap(ds.literal(value), {
		describe: fixed(type === undefined ? { const: value } : { type, const: value }),
	});
}

/** Accepts `null`. */
export function null_(): Schema<null> {
	return wrap(ds.null_(), { describe: fixed({ type: "null" }) });
}

/**
 * Accepts `null` besides what `schema` accepts. A scalar documents as `type: [T, "null"]`;
 * an object, array, reference or union as `anyOf` with `{ type: "null" }`.
 *
 * @param schema - The schema a non-null value must pass.
 * @example let enabledAt = s.nullable(s.integer());
 */
export function nullable<S extends AnySchema>(
	schema: S,
): Schema<InferInput<S> | null, InferOutput<S> | null> {
	let node = nodeOf(schema);
	return wrap(ds.nullable(schema), {
		presence: node?.presence,
		transformed: node?.transformed,
		describe(context) {
			let described = describeChild(schema, context);
			if (described.status === "failure") return described;
			return success(withNull(described.data));
		},
	});
}

/** Widens a described schema to accept `null`, keeping `enum` and `const` in agreement with `type`. */
function withNull(json: JSONSchema): JSONSchema {
	let types = json.type === undefined ? [] : Array.isArray(json.type) ? json.type : [json.type];
	let scalar = types.length > 0 && types.every((type) => SCALAR_TYPES.has(type));
	if (!scalar || json.$ref !== undefined) return { anyOf: [json, { type: "null" }] };
	if (types.includes("null")) return json;

	let { const: constant, ...rest } = json;
	let widened: JSONSchema = { ...rest, type: [...types, "null"] };
	if ("const" in json) widened.enum = [constant, null];
	if (json.enum !== undefined) widened.enum = [...json.enum, null];
	return widened;
}

/** Accepts a finite number, excluding `NaN` and the infinities. */
export function number(): Schema<number> {
	return wrap(ds.number(), { describe: fixed({ type: "number" }) });
}

/**
 * Accepts an object with the keys `shape` names. A key is `required` unless its schema is
 * `optional`, or `defaulted` on the input side; unknown keys are stripped by default.
 *
 * @param shape - The schema for each key.
 * @param options - How unknown keys are treated.
 * @example let monitor = s.object({ name: s.string(), paused: s.optional(s.boolean()) });
 */
export function object<Shape extends Record<string, AnySchema>>(
	shape: Shape,
	options?: ObjectOptions,
): Schema<ObjectInput<Shape>, ObjectOutput<Shape>> {
	return wrap(ds.object(shape, options), {
		describe(context) {
			let properties: Record<string, JSONSchema> = {};
			let required: string[] = [];
			for (let [key, schema] of Object.entries(shape)) {
				let described = describeChild(schema, context, "properties", key);
				if (described.status === "failure") return described;
				properties[key] = described.data;
				if (isRequired(schema, context)) required.push(key);
			}

			let json: JSONSchema = { type: "object", properties };
			if (required.length > 0) json.required = required;
			if (options?.unknownKeys === "error") json.additionalProperties = false;
			return success(json);
		},
	});
}

/** Whether an object key must be present on the side being described. */
function isRequired(schema: AnySchema, context: DescribeContext): boolean {
	let presence = nodeOf(schema)?.presence;
	if (presence === "optional") return false;
	return presence !== "defaulted" || context.direction === "output";
}

/**
 * Accepts `undefined` besides what `schema` accepts, which leaves an object key out of
 * `required`.
 *
 * @param schema - The schema a present value must pass.
 * @example let description = s.optional(s.string());
 */
export function optional<S extends AnySchema>(
	schema: S,
): Schema<InferInput<S> | undefined, InferOutput<S> | undefined> {
	return wrap(ds.optional(schema), {
		presence: "optional",
		transformed: nodeOf(schema)?.transformed,
		describe: (context) => describeChild(schema, context),
	});
}

/**
 * Accepts an object used as a map, every key passing `key` and every value `value`. A key
 * schema with keywords beyond `type: "string"` documents as `propertyNames`.
 *
 * @param key - The schema each key must pass.
 * @param value - The schema each value must pass.
 * @example let labels = s.record(s.string(), s.string());
 */
export function record<K extends DescribedSchema<string, string>, V extends AnySchema>(
	key: K,
	value: V,
): Schema<Record<InferInput<K>, InferInput<V>>, Record<InferOutput<K>, InferOutput<V>>> {
	return wrap(ds.record(key, value), {
		describe(context) {
			let values = describeChild(value, context, "additionalProperties");
			if (values.status === "failure") return values;
			let keys = describeChild(key, context, "propertyNames");
			if (keys.status === "failure") return keys;

			let json: JSONSchema = { type: "object", additionalProperties: values.data };
			let { type: _, ...constraints } = keys.data;
			if (Object.keys(constraints).length > 0) json.propertyNames = keys.data;
			return success(json);
		},
	});
}

/** Accepts a string. */
export function string(): Schema<string> {
	return wrap(ds.string(), { describe: fixed({ type: "string" }) });
}

/**
 * Accepts an array of exactly `items.length` entries, each passing the schema at its index.
 *
 * @param items - The schema for each position.
 * @example let point = s.tuple([s.number(), s.number()]);
 */
export function tuple<const Items extends readonly AnySchema[]>(
	items: Items,
): Schema<
	{ -readonly [Index in keyof Items]: InferInput<Items[Index]> },
	{ -readonly [Index in keyof Items]: InferOutput<Items[Index]> }
> {
	return wrap(ds.tuple([...items]) as ds.Schema<unknown, any>, {
		describe(context) {
			let prefixItems = describeAll(items, context, "prefixItems");
			if (prefixItems.status === "failure") return prefixItems;
			return success({
				type: "array",
				prefixItems: prefixItems.data,
				items: false,
				minItems: items.length,
				maxItems: items.length,
			});
		},
	});
}

/**
 * Accepts what any of `members` accepts, trying them in order, documented as `anyOf`.
 *
 * @param members - The candidate schemas.
 * @example let id = s.union([s.string(), s.integer()]);
 */
export function union<const Members extends readonly AnySchema[]>(
	members: Members,
): Schema<InferInput<Members[number]>, InferOutput<Members[number]>> {
	return wrap(ds.union([...members]), {
		describe(context) {
			let anyOf = describeAll(members, context, "anyOf");
			if (anyOf.status === "failure") return anyOf;
			return success({ anyOf: anyOf.data });
		},
	});
}

/**
 * Accepts an object whose `discriminator` key selects the schema it must pass. It documents
 * as `oneOf`, each branch pinning the key with `const`, plus OpenAPI's `discriminator`.
 *
 * @param discriminator - The key whose value names the variant.
 * @param variants - The schema for each value of the key.
 * @example let check = s.variant("kind", { http: s.object({ kind: s.literal("http"), url: s.string() }), dns: s.object({ kind: s.literal("dns"), host: s.string() }) });
 */
export function variant<Key extends string, Variants extends Record<string, AnySchema>>(
	discriminator: Key,
	variants: Variants,
): Schema<InferInput<Variants[keyof Variants]>, InferOutput<Variants[keyof Variants]>> {
	return wrap(ds.variant(discriminator, variants), {
		describe(context) {
			let oneOf: JSONSchema[] = [];
			let mapping: Record<string, string> = {};
			let index = 0;
			for (let [tag, schema] of Object.entries(variants)) {
				let described = describeChild(schema, context, "oneOf", index);
				if (described.status === "failure") return described;
				if (described.data.$ref !== undefined) mapping[tag] = described.data.$ref;
				oneOf.push(pinDiscriminator(described.data, discriminator, tag));
				index += 1;
			}

			let json: JSONSchema = { oneOf, discriminator: { propertyName: discriminator } };
			if (Object.keys(mapping).length > 0)
				json.discriminator = { propertyName: discriminator, mapping };
			return success(json);
		},
	});
}

/**
 * Fixes a variant's discriminator key to its tag. An inline object gains the `const`
 * directly; a reference or any other shape is combined with the constraint through `allOf`.
 */
function pinDiscriminator(json: JSONSchema, key: string, tag: string): JSONSchema {
	if (json.$ref !== undefined || json.properties === undefined) {
		return {
			allOf: [json, { type: "object", properties: { [key]: { const: tag } }, required: [key] }],
		};
	}
	let required = json.required?.includes(key) ? json.required : [...(json.required ?? []), key];
	return {
		...json,
		properties: { ...json.properties, [key]: { ...json.properties[key], const: tag } },
		required,
	};
}

/** Describes each schema of a list, stopping at the first that fails. */
function describeAll(
	schemas: readonly AnySchema[],
	context: DescribeContext,
	keyword: string,
): Result<JSONSchema[], JSONSchemaConversionError> {
	let described: JSONSchema[] = [];
	for (let [index, schema] of schemas.entries()) {
		let result = describeChild(schema, context, keyword, index);
		if (result.status === "failure") return result;
		described.push(result.data);
	}
	return success(described);
}
