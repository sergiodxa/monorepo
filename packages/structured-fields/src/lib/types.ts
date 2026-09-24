/**
 * The Structured Field value model as types: what `parse` produces and what `stringify`
 * accepts. Kept in one namespace so a caller writes `SF.Dictionary` next to the functions
 * that read and write one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Decimal, DisplayString, Token } from "./values.js";

/**
 * Groups the Structured Field value model under a single import surface.
 */
export namespace SF {
	/**
	 * Integer and Decimal as `number` and `Decimal`, String as `string`, Token as `Token`,
	 * Byte Sequence as `Uint8Array`, Boolean as `boolean`, Date as `Date`,
	 * Display String as `DisplayString`.
	 */
	export type BareItem =
		| number
		| Decimal
		| string
		| Token
		| Uint8Array
		| boolean
		| Date
		| DisplayString;

	/** Keys in insertion order, on a null-prototype object. */
	export type Parameters = Record<string, BareItem>;

	/**
	 * A bare item with its parameters.
	 *
	 * @template Value - The bare item type the field allows
	 */
	export interface Item<Value extends BareItem = BareItem> {
		value: Value;
		params: Parameters;
	}

	/** A parenthesized list of items, itself carrying parameters. */
	export interface InnerList {
		items: Item[];
		params: Parameters;
	}

	/** One List or Dictionary member. */
	export type Member = Item | InnerList;

	/** Members in field order. */
	export type List = Member[];

	/** Members keyed in field order, on a null-prototype object. */
	export type Dictionary = Record<string, Member>;

	/** The top-level type a field's definition fixes. */
	export type FieldType = "list" | "dictionary" | "item";

	/** The value `parse` produces for each field type. */
	export interface ValueOf {
		list: List;
		dictionary: Dictionary;
		item: Item;
	}

	/** An Item as `stringify` accepts it, with `params` optional. */
	export interface ItemInput {
		value: BareItem;
		params?: Parameters;
	}

	/** An Inner List as `stringify` accepts it, each item bare or with parameters. */
	export interface InnerListInput {
		items: Array<BareItem | ItemInput>;
		params?: Parameters;
	}

	/**
	 * What `stringify` accepts: the parsed model, or any member written as its bare value
	 * (a member without parameters), and `params` optional everywhere.
	 */
	export type MemberInput = BareItem | ItemInput | InnerListInput;

	/** The value `stringify` accepts for each field type. */
	export interface InputOf {
		list: MemberInput[];
		dictionary: Record<string, MemberInput>;
		item: BareItem | ItemInput;
	}

	/**
	 * A Standard Schema whose `validate` answers synchronously, which is every
	 * `remix/data-schema` schema. Header parsing sits on hot paths that stay synchronous,
	 * so a schema with an async refinement is a type error here.
	 *
	 * @template Output - What the schema produces
	 */
	export type SyncSchema<Output = unknown> = StandardSchemaV1<unknown, Output> & {
		readonly "~standard": {
			validate(value: unknown, options?: StandardSchemaV1.Options): StandardSchemaV1.Result<Output>;
		};
	};
}
