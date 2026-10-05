/**
 * The types a language derives from its configuration: the JSON form an
 * expression is written in, and the compiled form evaluation reads. Each keeps
 * only the operators the language was given, so a node narrows on `op`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BuiltinLeaf, BuiltinName, CompiledBuiltinLeaf } from "./builtins.js";
import type { Operator } from "./operator.js";

/** Holds when every member does; `all` of nothing holds. */
export interface AllNode<E> {
	op: "all";
	of: E[];
}

/** Holds when some member does; `any` of nothing never holds. */
export interface AnyNode<E> {
	op: "any";
	of: E[];
}

/** Holds when its operand does not. */
export interface NotNode<E> {
	op: "not";
	of: E;
}

/** Stands for the shared expression declared under `name`. */
export interface ReferenceNode<R extends string> {
	op: R;
	name: string;
}

/** A reference once compiled, carrying the expression it names. */
export interface CompiledReferenceNode<R extends string, C> {
	op: R;
	name: string;
	of: C;
}

/** Any operator a language can be given, whatever nodes it reads. */
export type AnyOperator = Operator<any, any>;

/** The JSON form of the operators in a list. */
export type NodeOf<O extends AnyOperator> = O extends Operator<infer Node, any> ? Node : never;

/** The compiled form of the operators in a list. */
export type CompiledNodeOf<O extends AnyOperator> =
	O extends Operator<any, infer Compiled> ? Compiled : never;

/**
 * The JSON form of a language with the built-ins `B`, references spelled `R`
 * (`never` for none) and extension nodes `X`.
 */
export type ExpressionOf<B extends BuiltinName, R extends string, X> =
	| Extract<BuiltinLeaf, { op: B }>
	| ("all" extends B ? AllNode<ExpressionOf<B, R, X>> : never)
	| ("any" extends B ? AnyNode<ExpressionOf<B, R, X>> : never)
	| ("not" extends B ? NotNode<ExpressionOf<B, R, X>> : never)
	| ([R] extends [never] ? never : ReferenceNode<R>)
	| X;

/** The compiled form of the same language, with patterns built and references resolved. */
export type CompiledOf<B extends BuiltinName, R extends string, X> =
	| Extract<CompiledBuiltinLeaf, { op: B }>
	| ("all" extends B ? AllNode<CompiledOf<B, R, X>> : never)
	| ("any" extends B ? AnyNode<CompiledOf<B, R, X>> : never)
	| ("not" extends B ? NotNode<CompiledOf<B, R, X>> : never)
	| ([R] extends [never] ? never : CompiledReferenceNode<R, CompiledOf<B, R, X>>)
	| X;
