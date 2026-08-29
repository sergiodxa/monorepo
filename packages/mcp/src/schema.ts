/**
 * The JSON Schema subset a tool declares its arguments with, and the type-level mapper
 * that turns one of those declarations into the argument type its handler receives.
 *
 * MCP puts JSON Schema on the wire, so declaring it here and deriving the TypeScript
 * type from it keeps the wire format, the runtime validation, and the handler's
 * parameter from ever drifting apart.
 *
 * The subset stays narrow — objects of scalars, enums, and arrays — because a language
 * model fills in tool arguments, and every keyword beyond these only makes the schema
 * harder for it to satisfy without making the tool more capable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Keywords every schema in the subset may carry, none of which constrain a value. */
interface Described {
	/** What the value means, written for the model that has to supply it. */
	readonly description?: string;
	/** Display name for a client that renders the argument. */
	readonly title?: string;
}

/** A string argument, optionally narrowed to a fixed set of values. */
export interface StringSchema extends Described {
	readonly type: "string";
	/** Allowed values; narrows the derived type to the union of these literals. */
	readonly enum?: readonly string[];
	/** Advisory only — validation relies solely on the schema's `type`. */
	readonly format?: string;
	readonly minLength?: number;
	readonly maxLength?: number;
	/** Matches anywhere in the string, per JSON Schema's `pattern` semantics. */
	readonly pattern?: string;
	/** Substituted when the argument is absent, so an optional argument still arrives. */
	readonly default?: string;
}

/** A numeric argument. `integer` additionally rejects a fractional value. */
export interface NumberSchema extends Described {
	readonly type: "number" | "integer";
	readonly minimum?: number;
	readonly maximum?: number;
	readonly default?: number;
}

/** A boolean argument. */
export interface BooleanSchema extends Described {
	readonly type: "boolean";
	readonly default?: boolean;
}

/** A homogeneous array argument. */
export interface ArraySchema extends Described {
	readonly type: "array";
	readonly items: PropertySchema;
	readonly minItems?: number;
	readonly maxItems?: number;
}

/**
 * An object argument, and the shape of a tool's whole argument set. A property missing
 * from `required` is optional, and every property keeps a single concrete type, since
 * a model given a choice between a value and `null` reaches for `null` far more often.
 */
export interface ObjectSchema extends Described {
	readonly type: "object";
	readonly properties: { readonly [name: string]: PropertySchema };
	readonly required?: readonly string[];
	/** Unknown properties are dropped regardless; this only advertises that to a client. */
	readonly additionalProperties?: boolean;
}

/** Any schema the subset accepts for a single property. */
export type PropertySchema =
	| StringSchema
	| NumberSchema
	| BooleanSchema
	| ArraySchema
	| ObjectSchema;

/** Flattens an intersection into a single readable object type for hover tooltips. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The property names {@link ObjectSchema.required} lists, narrowed to real properties. */
type RequiredKeys<S extends ObjectSchema> = S["required"] extends readonly (infer name extends
	string)[]
	? name & keyof S["properties"]
	: never;

/**
 * The property names carrying a `default`. They join {@link RequiredKeys} in the
 * derived type because the validator substitutes the default, so the handler always
 * receives that resolved value directly, with the default declared in exactly one place.
 */
type DefaultedKeys<S extends ObjectSchema> = {
	[name in keyof S["properties"]]: S["properties"][name] extends { default: unknown }
		? name
		: never;
}[keyof S["properties"]];

/** The property names that always reach a handler: required, or carrying a default. */
type PresentKeys<S extends ObjectSchema> = RequiredKeys<S> | DefaultedKeys<S>;

/** The property names a handler may find absent. */
type OptionalKeys<S extends ObjectSchema> = Exclude<keyof S["properties"], PresentKeys<S>>;

/**
 * The TypeScript type a value satisfying `S` has: a `string` schema carrying `enum` derives
 * the union of its literals, keeping a handler's `switch` over it exhaustive; `tool`'s
 * `const` type parameter preserves those literals without an `as const` at the call site.
 */
export type FromSchema<S extends PropertySchema> = S extends {
	type: "string";
	enum: readonly (infer value extends string)[];
}
	? value
	: S extends { type: "string" }
		? string
		: S extends { type: "number" | "integer" }
			? number
			: S extends { type: "boolean" }
				? boolean
				: S extends { type: "array"; items: infer item }
					? item extends PropertySchema
						? Array<FromSchema<item>>
						: never
					: S extends ObjectSchema
						? FromObjectSchema<S>
						: never;

/** The argument object a handler receives for an {@link ObjectSchema} declaration. */
export type FromObjectSchema<S extends ObjectSchema> = Simplify<
	{
		[name in PresentKeys<S>]: S["properties"][name] extends PropertySchema
			? FromSchema<S["properties"][name]>
			: never;
	} & {
		[name in OptionalKeys<S>]?: S["properties"][name] extends PropertySchema
			? FromSchema<S["properties"][name]>
			: never;
	}
>;
