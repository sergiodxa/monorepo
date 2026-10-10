/**
 * Typed fields over a key/value meta table. Each field is a codec between the text a meta
 * row's value column holds and the typed value a model's rows carry under `row.meta`, so a
 * model declares its open-ended attributes once and reads and writes them as plain values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

/** What encoding a value for storage produced: the rows' texts, or why the value is refused. */
export type EncodeResult = { ok: true; texts: string[] } | { ok: false; message: string };

/**
 * A codec for one meta key, carrying its value type and its write rules in its type.
 *
 * Reads answer `Value | undefined` unless the field declares a default, because a key/value
 * table can lack any key for any row; `required()` applies to writes only.
 *
 * @template Value What a row's `meta` holds for this key.
 * @template Required Whether `create` fails without a value for it.
 * @template Defaulted Whether a missing value reads as the declared default.
 * @template Item What one stored row holds, which differs from `Value` for a list field.
 */
export interface Field<
	Value = unknown,
	Required extends boolean = boolean,
	Defaulted extends boolean = boolean,
	Item = Value,
> {
	/** Type-only: the decoded value. */
	readonly "~value"?: Value;
	/** Type-only: what one stored row decodes to. */
	readonly "~item"?: Item;
	/** Whether `create` refuses a write without this key, and `update` refuses `null` for it. */
	readonly isRequired: Required;
	/** Whether a missing value reads as {@link Field.defaultValue}. */
	readonly hasDefault: Defaulted;
	/** What a missing or undecodable value reads as when {@link Field.hasDefault} is set. */
	readonly defaultValue: Value | undefined;
	/** Whether the key holds one row per item, read back in insertion order. */
	readonly isList: boolean;
	/** Turns a value into the texts stored for it, one per row. */
	encode(value: unknown): EncodeResult;
	/** Turns one stored text back into an item, answering `undefined` for text the codec rejects. */
	decodeItem(text: string): Item | undefined;
	/** The same field, refusing a `create` that leaves it out. */
	required(): Field<Value, true, Defaulted, Item>;
	/** The same field, reading as `value` whenever the key is missing or undecodable. */
	default(value: Value): Field<Value, Required, true, Item>;
}

/** Any field, for the places that hold a model's whole field map. */
// oxlint-disable-next-line typescript/no-explicit-any -- field value types vary per key
export type AnyField = Field<any, boolean, boolean, any>;

/** A model's declared meta fields, keyed by the meta key they read. */
export type FieldMap = Record<string, AnyField>;

/** The value a field decodes to. */
export type FieldValue<F> = F extends Field<infer Value, boolean, boolean, unknown> ? Value : never;

/** What one stored row of a field holds: an item for a list field, the value otherwise. */
export type FieldItem<F> = F extends Field<unknown, boolean, boolean, infer Item> ? Item : never;

/** A row's decoded `meta`: defaulted fields always hold a value, every other one may be missing. */
export type DecodedMeta<Fields extends FieldMap> = {
	[Key in keyof Fields]: Fields[Key] extends Field<infer Value, boolean, true, unknown>
		? Value
		: FieldValue<Fields[Key]> | undefined;
};

/** The meta keys a `create` must name. */
type RequiredFieldKeys<Fields extends FieldMap> = {
	[Key in keyof Fields]: Fields[Key] extends Field<unknown, true, boolean, unknown> ? Key : never;
}[keyof Fields];

/** The `meta` a `create` takes: required keys named, the rest optional or `null` to leave unset. */
export type CreateMeta<Fields extends FieldMap> = {
	[Key in RequiredFieldKeys<Fields>]: FieldValue<Fields[Key]>;
} & {
	[Key in Exclude<keyof Fields, RequiredFieldKeys<Fields>>]?: FieldValue<Fields[Key]> | null;
};

/** The `meta` an `update` takes: every key optional, `null` removing one that is not required. */
export type UpdateMeta<Fields extends FieldMap> = {
	[Key in RequiredFieldKeys<Fields>]?: FieldValue<Fields[Key]>;
} & {
	[Key in Exclude<keyof Fields, RequiredFieldKeys<Fields>>]?: FieldValue<Fields[Key]> | null;
};

/** Whether a field map declares any key `create` must name. */
export type HasRequiredField<Fields extends FieldMap> = [RequiredFieldKeys<Fields>] extends [never]
	? false
	: true;

/** How one scalar codec turns a value into text and back. */
interface Codec<Value> {
	encode(value: unknown): { ok: true; text: string } | { ok: false; message: string };
	decode(text: string): Value | undefined;
}

/** Builds a field from a scalar codec, keeping the write and read rules beside it. */
function scalar<Value>(
	codec: Codec<Value>,
	isRequired: boolean,
	hasDefault: boolean,
	defaultValue: Value | undefined,
): Field<Value, false, false> {
	return {
		isRequired: isRequired as false,
		hasDefault: hasDefault as false,
		defaultValue,
		isList: false,
		encode(value) {
			let encoded = codec.encode(value);
			return encoded.ok ? { ok: true, texts: [encoded.text] } : encoded;
		},
		decodeItem: (text) => codec.decode(text),
		required: () => scalar(codec, true, hasDefault, defaultValue) as never,
		default: (value) => scalar(codec, isRequired, true, value) as never,
	};
}

/** Accepts strings as they are, stored verbatim. */
const TEXT_CODEC: Codec<string> = {
	encode: (value) =>
		typeof value === "string" ? { ok: true, text: value } : { ok: false, message: "Expected text" },
	decode: (text) => text,
};

/** Accepts whole numbers in the safe integer range, stored as decimal text. */
const INTEGER_CODEC: Codec<number> = {
	encode: (value) =>
		typeof value === "number" && Number.isSafeInteger(value)
			? { ok: true, text: String(value) }
			: { ok: false, message: "Expected a whole number" },
	decode: (text) => {
		let value = Number(text);
		return text.trim() !== "" && Number.isSafeInteger(value) ? value : undefined;
	},
};

/** Accepts finite numbers, stored as decimal text. */
const NUMBER_CODEC: Codec<number> = {
	encode: (value) =>
		typeof value === "number" && Number.isFinite(value)
			? { ok: true, text: String(value) }
			: { ok: false, message: "Expected a number" },
	decode: (text) => {
		let value = Number(text);
		return text.trim() !== "" && Number.isFinite(value) ? value : undefined;
	},
};

/** Stores booleans as `"1"` and `"0"`, reading the words `true` and `false` too. */
const BOOLEAN_CODEC: Codec<boolean> = {
	encode: (value) =>
		typeof value === "boolean"
			? { ok: true, text: value ? "1" : "0" }
			: { ok: false, message: "Expected true or false" },
	decode: (text) => {
		if (text === "1" || text === "true") return true;
		if (text === "0" || text === "false") return false;
		return undefined;
	},
};

/** Accepts anything `Date` parses, stored and read back as ISO 8601. */
const TIMESTAMP_CODEC: Codec<string> = {
	encode: (value) => {
		let date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
		if (date === null || Number.isNaN(date.getTime())) {
			return { ok: false, message: "Expected a date" };
		}
		return { ok: true, text: date.toISOString() };
	},
	decode: (text) => {
		let date = new Date(text);
		return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
	},
};

/** Accepts absolute URLs, stored as written. */
const URL_CODEC: Codec<string> = {
	encode: (value) =>
		typeof value === "string" && URL.canParse(value)
			? { ok: true, text: value }
			: { ok: false, message: "Expected an absolute URL" },
	decode: (text) => (URL.canParse(text) ? text : undefined),
};

/**
 * Runs a Standard Schema synchronously, since a meta value is decoded while rows are read.
 *
 * @throws {TypeError} When the schema validates asynchronously.
 */
function validateSync<Schema extends StandardSchemaV1>(
	schema: Schema,
	value: unknown,
): StandardSchemaV1.Result<StandardSchemaV1.InferOutput<Schema>> {
	let result = schema["~standard"].validate(value);
	if (result instanceof Promise) {
		throw new TypeError("field.json() needs a schema that validates synchronously");
	}
	return result;
}

/** Builds the JSON codec for one schema: validated on write, and validated again on read. */
function jsonCodec<Schema extends StandardSchemaV1>(
	schema: Schema,
): Codec<StandardSchemaV1.InferOutput<Schema>> {
	return {
		encode: (value) => {
			let result = validateSync(schema, value);
			if (result.issues !== undefined) {
				return { ok: false, message: result.issues[0]?.message ?? "Invalid value" };
			}
			return { ok: true, text: JSON.stringify(result.value) };
		},
		decode: (text) => {
			let parsed: unknown;
			try {
				parsed = JSON.parse(text);
			} catch {
				return undefined;
			}
			let result = validateSync(schema, parsed);
			return result.issues === undefined ? result.value : undefined;
		},
	};
}

/** Builds a list field over an item field, one row per item. */
function list<Item>(
	item: Field<Item, boolean, boolean>,
	isRequired: boolean,
	hasDefault: boolean,
	defaultValue: Item[] | undefined,
): Field<Item[], false, false, Item> {
	return {
		isRequired: isRequired as false,
		hasDefault: hasDefault as false,
		defaultValue,
		isList: true,
		encode(value) {
			if (!Array.isArray(value)) return { ok: false, message: "Expected a list" };
			let texts: string[] = [];
			for (let entry of value) {
				let encoded = item.encode(entry);
				if (!encoded.ok) return encoded;
				texts.push(...encoded.texts);
			}
			return { ok: true, texts };
		},
		decodeItem: (text) => item.decodeItem(text),
		required: () => list(item, true, hasDefault, defaultValue) as never,
		default: (value) => list(item, isRequired, true, value) as never,
	};
}

/**
 * The meta field constructors. Every field starts optional with no default; chain
 * `.required()` to refuse a `create` without it and `.default(value)` to read a missing key
 * as `value`.
 *
 * @example field.text().required()
 * @example field.enum(["en", "es"]).default("en")
 * @example field.list(field.text())
 */
export const field = {
	/** Text, stored verbatim. */
	text: (): Field<string, false, false> => scalar(TEXT_CODEC, false, false, undefined),
	/** A whole number in the safe integer range, stored as decimal text. */
	integer: (): Field<number, false, false> => scalar(INTEGER_CODEC, false, false, undefined),
	/** A finite number, stored as decimal text. */
	number: (): Field<number, false, false> => scalar(NUMBER_CODEC, false, false, undefined),
	/** A boolean, stored as `"1"` or `"0"`. */
	boolean: (): Field<boolean, false, false> => scalar(BOOLEAN_CODEC, false, false, undefined),
	/** An instant, accepted as a `Date` or a parseable string and read back as ISO 8601. */
	timestamp: (): Field<string, false, false> => scalar(TIMESTAMP_CODEC, false, false, undefined),
	/** An absolute URL, stored as written. */
	url: (): Field<string, false, false> => scalar(URL_CODEC, false, false, undefined),
	/**
	 * One of a fixed set of strings; a stored value outside the set reads as missing.
	 *
	 * @param values The accepted values, which become the field's type.
	 */
	enum: <const Values extends readonly [string, ...string[]]>(
		values: Values,
	): Field<Values[number], false, false> =>
		scalar<Values[number]>(
			{
				encode: (value) =>
					typeof value === "string" && values.includes(value)
						? { ok: true, text: value }
						: { ok: false, message: `Expected one of ${values.join(", ")}` },
				decode: (text) => (values.includes(text) ? text : undefined),
			},
			false,
			false,
			undefined,
		),
	/**
	 * A JSON value validated by a synchronous Standard Schema, on write and again on read.
	 *
	 * @param schema The schema a stored value must satisfy, such as a `remix/data-schema` object.
	 */
	json: <Schema extends StandardSchemaV1>(
		schema: Schema,
	): Field<StandardSchemaV1.InferOutput<Schema>, false, false> =>
		scalar(jsonCodec(schema), false, false, undefined),
	/**
	 * Several values under one key, one row per item, read back in insertion order.
	 *
	 * @param item The field each item is stored as.
	 */
	list: <Item>(item: Field<Item, boolean, boolean>): Field<Item[], false, false, Item> =>
		list(item, false, false, undefined),
};
