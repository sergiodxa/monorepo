/**
 * The shapes the package speaks in: the JSON Schema 2020-12 vocabulary it emits and
 * reads, and the schema and check contracts that pair a `remix/data-schema` validator
 * with the JSON Schema describing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { Check as DataCheck, Schema as DataSchema } from "remix/data-schema";

/**
 * A JSON Schema 2020-12 document, as far as this package emits and reads it. `discriminator`
 * is OpenAPI's vocabulary extension; everything else is 2020-12 core and validation.
 */
export interface JSONSchema {
	$schema?: string;
	$id?: string;
	$ref?: string;
	$defs?: Record<string, JSONSchema>;
	type?: JSONSchema.TypeName | JSONSchema.TypeName[];
	enum?: readonly unknown[];
	const?: unknown;
	properties?: Record<string, JSONSchema>;
	required?: string[];
	additionalProperties?: boolean | JSONSchema;
	propertyNames?: JSONSchema;
	items?: boolean | JSONSchema;
	prefixItems?: JSONSchema[];
	anyOf?: JSONSchema[];
	oneOf?: JSONSchema[];
	allOf?: JSONSchema[];
	discriminator?: { propertyName: string; mapping?: Record<string, string> };
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	format?: string;
	minimum?: number;
	maximum?: number;
	minItems?: number;
	maxItems?: number;
	default?: unknown;
	title?: string;
	description?: string;
	examples?: unknown[];
	deprecated?: boolean;
	readOnly?: boolean;
	writeOnly?: boolean;
}

export namespace JSONSchema {
	/** The seven primitive types 2020-12 names in `type`. */
	export type TypeName = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
	/** Which side of a `transform` to describe: what a caller sends, or what the parser yields. */
	export type Direction = "input" | "output";
}

/** Keywords that describe a schema without changing what it accepts. */
export interface Annotations<Output> {
	/** Hoists the schema into `$defs` (and OpenAPI `components.schemas`) under this name. */
	id?: string;
	title?: string;
	description?: string;
	examples?: Output[];
	deprecated?: boolean;
	format?: string;
	/** Documents a pattern a `refine` enforces; `checks.pattern` enforces and documents at once. */
	pattern?: string;
	readOnly?: boolean;
	writeOnly?: boolean;
}

/**
 * What a combinator accepts as a nested schema: anything `remix/data-schema` can run that
 * also implements Standard JSON Schema. Every schema from this package qualifies, and so
 * does a schema built with data-schema directly that carries its own converter.
 *
 * @template Input - What the schema is documented to accept.
 * @template Output - What a successful parse yields.
 */
export type DescribedSchema<Input = any, Output = any> = DataSchema<Input, Output> &
	StandardJSONSchemaV1<Input, Output>;

/**
 * A `remix/data-schema` check that also contributes JSON Schema keywords to the schema it
 * is piped into, so the check that runs and the keyword that documents it are one value.
 */
export interface Check<Output> extends DataCheck<Output> {
	readonly keywords: JSONSchema;
}

/**
 * A `remix/data-schema` schema that can also describe itself as JSON Schema. It validates
 * through the same `~standard.validate`, and implements Standard JSON Schema, so any tool
 * that asks a schema for JSON Schema can read it.
 *
 * @template Input - What the schema is documented to accept.
 * @template Output - What a successful parse yields.
 */
export interface Schema<Input, Output = Input> extends DataSchema<Input, Output> {
	readonly "~standard": DataSchema<Input, Output>["~standard"] &
		StandardJSONSchemaV1.Props<Input, Output>;
	/** A check carrying `keywords` documents itself; a plain data-schema check validates only. */
	pipe(...checks: DataCheck<Output>[]): Schema<Input, Output>;
	/** The predicate validates; the JSON Schema is unchanged, so describe it with `meta`. */
	refine(predicate: (value: Output) => boolean, message?: string): Schema<Input, Output>;
	/** The input side keeps this schema; the output side is `output`, or `{}` without one. */
	transform<Next>(
		fn: (value: Output) => Next,
		output?: DescribedSchema<any, Next>,
	): Schema<Input, Next>;
	meta(annotations: Annotations<Output>): Schema<Input, Output>;
}
