/**
 * A dialect of the expression language, defined once: the built-ins it keeps,
 * the operators it adds and how it spells a reference. The language carries
 * the schema, compile, evaluate, parse and stringify typed to that dialect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";

import type { BuiltinName } from "./builtins.js";
import type { CompileOptions, ReferenceCache } from "./compile.js";
import type { ExpressionError } from "./expression-error.js";
import type {
	AnyOperator,
	CompiledNodeOf,
	CompiledOf,
	ExpressionOf,
	NodeOf,
} from "./expression.js";
import type { Node } from "./grammar.js";

import { BUILTIN_NAMES } from "./builtins.js";
import { compile } from "./compile.js";
import { evaluate } from "./evaluate.js";
import { createGrammar } from "./grammar.js";
import { parse } from "./parse.js";
import { stringify } from "./stringify.js";

/**
 * How a dialect is configured.
 *
 * @template B The built-ins it keeps.
 * @template R How it spells a reference.
 * @template O The operators it adds.
 */
export interface LanguageOptions<
	B extends BuiltinName,
	R extends string,
	O extends readonly AnyOperator[],
> {
	/**
	 * The built-in operators this language keeps, every one by default. Leaving
	 * out `matches` is how a language guarantees evaluation in linear time.
	 */
	builtins?: readonly B[];
	/**
	 * The operator name a reference to a shared expression is written under, as
	 * in `{ op: "segment", name: "internal" }`. Without it, nothing references.
	 */
	reference?: R;
	/** Field operators declared with `defineOperator`. */
	operators?: O;
}

/**
 * One dialect, with every step typed to it.
 *
 * @template E The JSON form of its expressions.
 * @template C The compiled form evaluation reads.
 */
export interface Language<E, C> {
	/** The JSON form's type, read as `typeof language.Expression`; it holds nothing at runtime. */
	readonly Expression: E;
	/** The compiled form's type, read as `typeof language.Compiled`; it holds nothing at runtime. */
	readonly Compiled: C;
	/** A Standard Schema for the JSON form, for validating a stored or submitted expression. */
	readonly schema: Schema<unknown, E>;
	/**
	 * Validates an expression, runs every operator's compile step and resolves
	 * every reference, failing with the path of the node at fault.
	 *
	 * @param expression The expression as stored, validated by nobody yet.
	 * @param options The shared expressions a reference may name.
	 */
	compile(expression: unknown, options?: CompileOptions): Result<C, ExpressionError>;
	/**
	 * Answers whether a compiled expression holds for a context, synchronously.
	 *
	 * @param compiled What `compile` returned.
	 * @param context Any object, read by path: nested records, arrays and `Date` values.
	 */
	evaluate(compiled: C, context: object): boolean;
	/**
	 * Reads the text form into the JSON form, validated against the schema. A
	 * failure carries the `line` and `column` the text broke at.
	 *
	 * @param text Like `plan.tier == "pro" and (country in ["AR"] or exists(beta))`.
	 */
	parse(text: string): Result<E, ExpressionError>;
	/**
	 * Prints an expression in the canonical text form, which `parse` reads back
	 * to the same JSON.
	 *
	 * @param expression A valid expression of this language.
	 */
	stringify(expression: E): string;
}

/**
 * Defines a dialect. With no options it keeps every built-in, adds nothing and
 * has no references.
 *
 * @param options The built-ins kept, the operators added, and the reference spelling.
 * @example let conditions = createLanguage({ reference: "segment" });
 */
export function createLanguage<
	const B extends BuiltinName = BuiltinName,
	const R extends string = never,
	const O extends readonly AnyOperator[] = [],
>(
	options: LanguageOptions<B, R, O> = {},
): Language<ExpressionOf<B, R, NodeOf<O[number]>>, CompiledOf<B, R, CompiledNodeOf<O[number]>>> {
	type E = ExpressionOf<B, R, NodeOf<O[number]>>;
	type C = CompiledOf<B, R, CompiledNodeOf<O[number]>>;

	let grammar = createGrammar(
		options.builtins ?? BUILTIN_NAMES,
		options.operators ?? [],
		options.reference,
	);
	let cache: ReferenceCache = new WeakMap();

	return {
		Expression: undefined as unknown as E,
		Compiled: undefined as unknown as C,
		schema: grammar.schema as Schema<unknown, E>,
		compile(expression, compileOptions = {}) {
			return compile(grammar, expression, compileOptions, cache) as Result<C, ExpressionError>;
		},
		evaluate(compiled, context) {
			return evaluate(grammar, compiled as Node, context);
		},
		parse(text) {
			return parse(grammar, text) as Result<E, ExpressionError>;
		},
		stringify(expression) {
			return stringify(grammar, expression as Node);
		},
	};
}
