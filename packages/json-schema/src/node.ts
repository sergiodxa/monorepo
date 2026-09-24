/**
 * The machinery every combinator shares: a schema pairs a `remix/data-schema` validator
 * with a describer, and describing walks nested schemas with one context that collects
 * named schemas, so `$defs` holds each name once and recursion terminates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { Check as DataCheck, Schema as DataSchema } from "remix/data-schema";

import { failure, success } from "@sdxc/result";

import type { Annotations, DescribedSchema, JSONSchema, Schema } from "./types.js";

import { JSONSchemaConversionError, toPointer } from "./error.js";

/** The meta-schema URI a standalone document declares. */
export const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema";

/**
 * Registered globally so schemas built by two copies of this package still describe each
 * other as their own, keeping presence and naming intact across the boundary.
 */
const NODE = Symbol.for("@sdxc/json-schema.node");

/** The state one conversion threads through every nested schema. */
export interface DescribeContext {
	direction: JSONSchema.Direction;
	refs: "defs" | "inline";
	/** Named schemas described so far; the root document's `$defs`. */
	defs: Map<string, JSONSchema>;
	/** Names being described right now, where a nested use becomes a `$ref` to stop recursion. */
	pending: Set<string>;
	/** Where the schema being described sits in the emitted document. */
	path: (string | number)[];
}

/** One conversion step: this schema's keywords, or why it has none. */
export type Describe = (context: DescribeContext) => Result<JSONSchema, JSONSchemaConversionError>;

/** What a schema knows about itself beyond validation. */
export interface Node {
	describe: Describe;
	/**
	 * `optional` leaves the key out of an object's `required` on both sides; `defaulted`
	 * leaves it out of the input side only, since the parser always produces a value.
	 */
	presence?: "optional" | "defaulted";
	/** Set once `transform` runs, after which checks describe the output side only. */
	transformed?: boolean;
}

/**
 * Reads the describer a schema from this package carries.
 *
 * @param schema - Any value; one without a describer yields `undefined`.
 */
export function nodeOf(schema: unknown): Node | undefined {
	if (typeof schema !== "object" || schema === null) return undefined;
	return (schema as { [NODE]?: Node })[NODE];
}

/**
 * Starts a conversion with no named schemas collected yet.
 *
 * @param direction - The side of each `transform` to describe.
 * @param refs - Whether named schemas become `$ref`s into `$defs` or stay inline.
 */
export function createContext(
	direction: JSONSchema.Direction,
	refs: "defs" | "inline",
): DescribeContext {
	return { direction, refs, defs: new Map(), pending: new Set(), path: [] };
}

/**
 * Describes a nested schema one location deeper. A schema from this package uses its
 * describer; any other Standard JSON Schema is asked through its converter and its `$defs`
 * are lifted into the root's; anything else is a failure naming where it sits.
 *
 * @param schema - The nested schema.
 * @param context - The enclosing schema's context.
 * @param segments - The keyword path from the enclosing schema to this one.
 */
export function describeChild(
	schema: unknown,
	context: DescribeContext,
	...segments: (string | number)[]
): Result<JSONSchema, JSONSchemaConversionError> {
	let child =
		segments.length === 0 ? context : { ...context, path: [...context.path, ...segments] };
	let node = nodeOf(schema);
	if (node) return node.describe(child);
	return describeForeign(schema, child);
}

/**
 * Asks a schema from another library for its JSON Schema through Standard JSON Schema.
 * Its converter may throw, as that interface allows; the throw becomes a failure here.
 */
function describeForeign(
	schema: unknown,
	context: DescribeContext,
): Result<JSONSchema, JSONSchemaConversionError> {
	let converter = (schema as Partial<StandardJSONSchemaV1> | null)?.["~standard"]?.jsonSchema;
	let pointer = toPointer(context.path);
	if (typeof converter?.[context.direction] !== "function") {
		return failure(
			new JSONSchemaConversionError(
				`The schema at "${pointer}" cannot describe itself as JSON Schema`,
				context.path,
			),
		);
	}

	let emitted: Record<string, unknown>;
	try {
		emitted = converter[context.direction]({ target: "draft-2020-12" });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(
			new JSONSchemaConversionError(
				`The schema at "${pointer}" failed to convert: ${reason}`,
				context.path,
				{ cause: error },
			),
		);
	}

	let { $schema: _, $defs, ...json } = emitted as JSONSchema;
	for (let [name, definition] of Object.entries($defs ?? {})) {
		let registered = register(context, name, definition);
		if (registered.status === "failure") return registered;
	}
	return success(json);
}

/**
 * Records a named schema in the root's `$defs`. The same name describing a different
 * schema is a failure, since a `$ref` could then point at either.
 */
function register(
	context: DescribeContext,
	name: string,
	json: JSONSchema,
): Result<void, JSONSchemaConversionError> {
	let existing = context.defs.get(name);
	if (existing !== undefined && !isDeepEqual(existing, json)) {
		return failure(
			new JSONSchemaConversionError(`Two different schemas are named "${name}"`, context.path),
		);
	}
	context.defs.set(name, json);
	return success(undefined);
}

/**
 * Wraps a describer so the schema it describes lives in `$defs` under `id`. While `id` is
 * being described, a nested use yields its `$ref`, which is what makes recursion finish.
 *
 * @param describe - The unnamed schema's describer.
 * @param id - The `$defs` key.
 * @param always - Keeps the `$ref` in `"inline"` mode too, which a recursive schema needs.
 */
export function named(describe: Describe, id: string, always = false): Describe {
	return (context) => {
		if (context.refs === "inline" && !always) return describe(context);
		let ref = { $ref: `#/$defs/${id}` };
		if (context.pending.has(id)) return success(ref);

		context.pending.add(id);
		let described = describe(context);
		context.pending.delete(id);
		if (described.status === "failure") return described;

		let registered = register(context, id, described.data);
		if (registered.status === "failure") return registered;
		return success(ref);
	};
}

/**
 * Converts a schema into a standalone 2020-12 document, with every named schema it
 * reaches collected under `$defs`.
 *
 * @param schema - Any schema; one without a JSON Schema form fails naming where it sits.
 * @param direction - The side of each `transform` to describe.
 * @param refs - Whether named schemas become `$ref`s or stay inline.
 */
export function convert(
	schema: unknown,
	direction: JSONSchema.Direction,
	refs: "defs" | "inline",
): Result<JSONSchema, JSONSchemaConversionError> {
	let context = createContext(direction, refs);
	let described = describeChild(schema, context);
	if (described.status === "failure") return described;

	let document: JSONSchema = { $schema: DRAFT_2020_12, ...described.data };
	if (context.defs.size > 0) document.$defs = Object.fromEntries(context.defs);
	return success(document);
}

/**
 * The Standard JSON Schema converter a schema exposes. That interface reports an
 * unsupported target or schema by throwing, so this is the one place the package throws;
 * `toJSONSchema` is the `Result`-returning way in.
 */
function standardConverter(schema: unknown): StandardJSONSchemaV1.Converter {
	let run = (direction: JSONSchema.Direction, options: StandardJSONSchemaV1.Options) => {
		if (options.target !== "draft-2020-12") {
			throw new JSONSchemaConversionError(`Unsupported JSON Schema target "${options.target}"`);
		}
		let converted = convert(schema, direction, "defs");
		if (converted.status === "failure") throw converted.error;
		return converted.data as Record<string, unknown>;
	};
	return {
		input: (options) => run("input", options),
		output: (options) => run("output", options),
	};
}

/**
 * Adds keywords to a described schema. A length check on an array documents as its item
 * count, since data-schema's `minLength` and `maxLength` read `.length` of either.
 */
function applyKeywords(json: JSONSchema, keywords: JSONSchema): JSONSchema {
	let isArray = json.type === "array" || (Array.isArray(json.type) && json.type.includes("array"));
	if (!isArray) return { ...json, ...keywords };

	let { minLength, maxLength, ...rest } = keywords;
	let merged: JSONSchema = { ...json, ...rest };
	if (minLength !== undefined) merged.minItems = minLength;
	if (maxLength !== undefined) merged.maxItems = maxLength;
	return merged;
}

/**
 * Pairs a data-schema validator with a describer, producing a schema whose chain methods
 * keep both in step: `pipe` adds each check's keywords, `refine` keeps the description,
 * `transform` switches the output side, and `meta` annotates or names it.
 *
 * @param base - The validator every call delegates to.
 * @param node - How the schema describes itself.
 */
export function wrap<Input, Output>(
	base: DataSchema<any, Output>,
	node: Node,
): Schema<Input, Output> {
	let schema: Schema<Input, Output> = {
		"~standard": {
			...(base["~standard"] as Schema<Input, Output>["~standard"]),
			get jsonSchema() {
				return standardConverter(schema);
			},
		},
		"~run": base["~run"],
		pipe(...checks: DataCheck<Output>[]) {
			let keywords = checks
				.map((check) => (check as { keywords?: JSONSchema }).keywords)
				.filter((entry): entry is JSONSchema => entry !== undefined);
			return wrap<Input, Output>(base.pipe(...checks), {
				...node,
				describe(context) {
					let described = node.describe(context);
					if (described.status === "failure") return described;
					if (node.transformed && context.direction === "input") return described;
					return success(keywords.reduce(applyKeywords, described.data));
				},
			});
		},
		refine(predicate: (value: Output) => boolean, message?: string) {
			return wrap<Input, Output>(base.refine(predicate, message), node);
		},
		transform<Next>(fn: (value: Output) => Next, output?: DescribedSchema<any, Next>) {
			return wrap<Input, Next>(base.transform(fn), {
				presence: node.presence,
				transformed: true,
				describe(context) {
					if (context.direction === "input") return node.describe(context);
					if (output === undefined) return success({});
					return describeChild(output, context);
				},
			});
		},
		meta(annotations: Annotations<Output>) {
			let { id, ...keywords } = annotations;
			let annotate: Describe = (context) => {
				let described = node.describe(context);
				if (described.status === "failure") return described;
				return success({ ...described.data, ...keywords });
			};
			return wrap<Input, Output>(base, {
				...node,
				describe: id === undefined ? annotate : named(annotate, id),
			});
		},
	};
	Object.defineProperty(schema, NODE, { value: node });
	return schema;
}

/**
 * Structural equality over JSON values, used to tell a second use of a named schema from
 * a different schema claiming the same name.
 */
function isDeepEqual(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
		return false;
	}
	if (Array.isArray(left) !== Array.isArray(right)) return false;
	let leftKeys = Object.keys(left);
	let rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	return leftKeys.every((key) =>
		isDeepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
	);
}
