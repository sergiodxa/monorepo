/**
 * The JSON Schema subset a tool declares its arguments with, and the type-level
 * mapper that turns one of those declarations into the argument type its handler
 * receives.
 *
 * MCP puts JSON Schema on the wire, so the schema a client reads has to exist as a
 * literal object either way. Declaring it here and deriving the TypeScript type from
 * it means the wire format, the runtime validation, and the handler's parameter all
 * come from one declaration and cannot drift apart — which is the failure a separate
 * validator schema alongside a hand-written JSON Schema invites.
 *
 * The subset is deliberately narrow: objects of scalars, enums, and arrays. Tool
 * arguments are filled in by a language model, and every keyword beyond these makes
 * the schema harder for it to satisfy without making the tool more capable.
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
	/** Advisory only — the validator does not interpret it. */
	readonly format?: string;
	readonly minLength?: number;
	readonly maxLength?: number;
	/** Anchored implicitly at neither end, matching JSON Schema's `pattern` semantics. */
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
 * An object argument, and the shape of a tool's whole argument set.
 *
 * A property missing from `required` is optional, which is the only place optionality
 * is expressed — the subset has no `nullable` and no union types, because a model
 * given a choice between a value and `null` supplies `null` far more often than the
 * tool's author intended.
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

/** Flattens an intersection so a hover shows one object rather than `A & B`. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The property names {@link ObjectSchema.required} lists, narrowed to real properties. */
type RequiredKeys<S extends ObjectSchema> = S["required"] extends readonly (infer name extends
	string)[]
	? name & keyof S["properties"]
	: never;

/**
 * The property names carrying a `default`.
 *
 * They join {@link RequiredKeys} in the derived type even though a caller may omit
 * them, because the validator substitutes the default and the handler therefore
 * always receives a value. Typing them optional would make every handler write a
 * `?? fallback` that restates the default the schema already states.
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
 * The TypeScript type a value satisfying `S` has.
 *
 * A `string` schema carrying `enum` derives the union of its literals rather than
 * `string`, which is what makes a handler's `switch` over an enumerated argument
 * exhaustive. That only holds when the declaration preserves its literal types, which
 * `defineTool`'s `const` type parameter arranges without an `as const` at the call site.
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
