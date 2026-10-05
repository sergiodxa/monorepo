/**
 * Public surface of the expression package: defining a dialect and its
 * operators, the node types a dialect derives, the error every step reports,
 * and the dotted-path reader a consumer shares with its expressions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { BuiltinLeaf, BuiltinName, CompiledBuiltinLeaf } from "./builtins.js";
export type { CompileOptions } from "./compile.js";
export type {
	AllNode,
	AnyNode,
	AnyOperator,
	CompiledOf,
	CompiledReferenceNode,
	ExpressionOf,
	NotNode,
	ReferenceNode,
} from "./expression.js";
export type { ExpressionErrorOptions } from "./expression-error.js";
export type { Language, LanguageOptions } from "./language.js";
export type {
	AnyFieldNode,
	FieldNode,
	FieldValue,
	Operator,
	OperatorDefinition,
} from "./operator.js";
export type { Context, ContextValue } from "./read.js";

export { ExpressionError } from "./expression-error.js";
export { createLanguage } from "./language.js";
export { defineOperator } from "./operator.js";
export { read } from "./read.js";
