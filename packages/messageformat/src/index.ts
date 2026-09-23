/**
 * Public surface of the MessageFormat 2 package: the `MessageFormat` class shaped like the
 * TC39 `Intl.MessageFormat` proposal, a `parse` that reports errors as a `Result`, and the
 * data model, value and part types both work with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	Attributes,
	CatchallKey,
	Declaration,
	Expression,
	FunctionExpression,
	FunctionRef,
	InputDeclaration,
	Literal,
	LiteralExpression,
	LocalDeclaration,
	Markup,
	MessageData,
	Options,
	Pattern,
	PatternMessage,
	SelectMessage,
	VariableExpression,
	VariableRef,
	Variant,
} from "./data-model.js";
export type { MessageErrorOptions, MessageErrorType } from "./errors.js";
export type {
	MessageErrorHandler,
	MessageFormatOptions,
	ResolvedMessageFormatOptions,
} from "./message-format.js";
export type {
	Direction,
	MessageBidiIsolationPart,
	MessageExpressionPart,
	MessageFallbackPart,
	MessageFunction,
	MessageFunctionContext,
	MessageMarkupPart,
	MessageNumberPart,
	MessagePart,
	MessageStringPart,
	MessageTextPart,
	MessageUnknownPart,
	MessageValue,
} from "./values.js";

export { MessageError } from "./errors.js";
export { MessageFormat } from "./message-format.js";
export { parse } from "./parse.js";
