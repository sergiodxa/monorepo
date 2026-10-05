/**
 * How a language learns an operator it does not ship with. An operator asks
 * about one field, and the language reads that field before the operator runs,
 * so an extension inherits the missing-field rule instead of reimplementing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { JSONValue } from "@sdxc/types";
import type { Schema } from "remix/data-schema";

import { isFailure, success } from "@sdxc/result";

/** Collapses an intersection into one object type, so an editor shows a node as written. */
export type Flatten<T> = { [K in keyof T]: T[K] } & {};

/** The JSON form of a field operator: its name, the path it reads, and its own fields. */
export type FieldNode<Op extends string, Fields extends object> = Flatten<
	{ op: Op; field: string } & Fields
>;

/** What a field operator is handed: the value at its path, which is never absent. */
export type FieldValue = Date | JSONValue;

/** The shape every field operator's node shares, whatever else it carries. */
export interface AnyFieldNode {
	op: string;
	field: string;
}

/**
 * An operator a language can be given. `Node` is how it is written and stored,
 * `Compiled` is what evaluation reads after the operator's compile step ran.
 *
 * @template Node The operator's JSON form.
 * @template Compiled The operator's node once compiled.
 */
export interface Operator<Node extends AnyFieldNode, Compiled extends AnyFieldNode> {
	readonly op: Node["op"];
	/**
	 * The node's fields in the order the text form's call syntax takes them,
	 * starting with `field`, so `semver(appVersion, ">=", "2.0.0")` fills
	 * `field`, `compare` and `value`.
	 */
	readonly args: readonly string[];
	/** Validates the fields beyond `op` and `field`, which the language checks itself. */
	readonly schema: Schema<unknown, object>;
	/** Runs once per node when an expression compiles; a failure fails the expression. */
	compile(node: Node): Result<Compiled, Error>;
	/** Answers for a value the path resolved to; a missing field answers `false` first. */
	test(value: FieldValue, node: Compiled): boolean;
}

/**
 * An operator as an author declares it.
 *
 * @template Op The name the operator is written under.
 * @template Fields The fields its node carries beyond `op` and `field`.
 * @template Prepared What its compile step prepares for evaluation.
 */
export interface OperatorDefinition<Op extends string, Fields extends object, Prepared> {
	op: Op;
	/** The node's fields in call order for the text form, `field` first. */
	args: readonly ["field", ...NoInfer<keyof Fields & string>[]];
	/** An object schema for the fields beyond `op` and `field`. */
	schema: Schema<unknown, Fields>;
	/**
	 * Prepares work once per node, the way `matches` builds its `RegExp`. A
	 * failure fails the expression at compile time instead of every evaluation.
	 */
	compile?: (node: FieldNode<Op, Fields>) => Result<Prepared, Error>;
	/** Answers for a value that is there; the language answers `false` for a missing one. */
	test: (value: FieldValue, node: FieldNode<Op, Fields>, prepared: Prepared) => boolean;
}

/**
 * Declares a field operator for `createLanguage`. A compile step's result is
 * kept on the compiled node as `prepared` and handed to `test` as its third
 * argument.
 *
 * @param definition The operator's name, fields, compile step and test.
 * @example defineOperator({ op: "even", args: ["field"], schema: s.object({}), test: (value) => typeof value === "number" && value % 2 === 0 })
 */
export function defineOperator<const Op extends string, Fields extends object, Prepared>(
	definition: OperatorDefinition<Op, Fields, Prepared> & {
		compile: (node: FieldNode<Op, Fields>) => Result<Prepared, Error>;
	},
): Operator<FieldNode<Op, Fields>, Flatten<FieldNode<Op, Fields> & { prepared: Prepared }>>;
export function defineOperator<const Op extends string, Fields extends object>(
	definition: OperatorDefinition<Op, Fields, undefined>,
): Operator<FieldNode<Op, Fields>, FieldNode<Op, Fields>>;
export function defineOperator(
	definition: OperatorDefinition<string, any, any>,
): Operator<any, any> {
	let { compile, test } = definition;

	let operator: Operator<AnyFieldNode, AnyFieldNode & { prepared?: unknown }> = {
		op: definition.op,
		args: definition.args,
		schema: definition.schema,
		compile(node) {
			if (compile === undefined) return success(node);
			let prepared = compile(node);
			if (isFailure(prepared)) return prepared;
			return success({ ...node, prepared: prepared.data });
		},
		test(value, node) {
			return test(value, node, node.prepared);
		},
	};
	return operator;
}
