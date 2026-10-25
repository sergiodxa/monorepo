/**
 * Expands parsed template parts with variable values, following RFC 6570 Appendix A for
 * strings, lists and associative arrays, so undefined values vanish and every operator
 * writes its own prefix, separators and names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Expression, OperatorRules, TemplatePart, VariableSpec } from "./syntax.js";

import { encodeValue } from "./encode.js";
import { UriTemplateError } from "./error.js";
import { OPERATORS } from "./syntax.js";

/** A scalar a template writes as text. */
export type Scalar = string | number | boolean;

/**
 * A variable's value: a scalar, a list, or an associative array (an object, or `[key, value]`
 * pairs to fix their order). `null`, `undefined`, an empty list and an empty object are undefined.
 */
export type VariableValue =
	| Scalar
	| null
	| undefined
	| readonly Scalar[]
	| readonly (readonly [string, Scalar])[]
	| Readonly<Record<string, Scalar>>;

/** Values by variable name. */
export type Variables = Readonly<Record<string, VariableValue>>;

/** A defined value, normalized: a string, a list, or ordered key/value pairs. */
type Defined =
	| { kind: "string"; value: string }
	| { kind: "list"; items: string[] }
	| { kind: "pairs"; pairs: [string, string][] };

/**
 * Expands `parts` with `variables`.
 *
 * @param parts - The parsed template.
 * @param variables - Values by name; names the template does not use are ignored.
 * @returns The URI reference, or a failure when a prefix modifier meets a composite value.
 */
export function expandParts(
	parts: readonly TemplatePart[],
	variables: Variables,
): Result<string, UriTemplateError> {
	let out = "";
	for (let part of parts) {
		if (typeof part === "string") {
			out += part;
			continue;
		}
		let expanded = expandExpression(part, variables);
		if (isFailure(expanded)) return expanded;
		out += expanded.data;
	}
	return success(out);
}

/** Appendix A for one expression: each defined variable expanded, joined by the separator. */
function expandExpression(
	expression: Expression,
	variables: Variables,
): Result<string, UriTemplateError> {
	let rules = OPERATORS[expression.operator];
	let items: string[] = [];
	for (let spec of expression.variables) {
		let value = normalize(Object.hasOwn(variables, spec.name) ? variables[spec.name] : undefined);
		if (value === null) continue;
		if (spec.prefix !== null && value.kind !== "string") {
			return failure(
				new UriTemplateError(
					expression.offset,
					`The prefix modifier on "${spec.name}" needs a string value`,
				),
			);
		}
		items.push(expandVariable(spec, value, rules));
	}
	return success(items.length === 0 ? "" : rules.first + items.join(rules.separator));
}

/** One defined variable as its operator writes it. */
function expandVariable(spec: VariableSpec, value: Defined, rules: OperatorRules): string {
	let encode = (text: string) => encodeValue(text, rules.allowReserved);
	/** `name=value` for named operators, with the operator's form for an empty value. */
	let named = (name: string, text: string) => {
		if (!rules.named) return text;
		return text === "" ? name + rules.ifEmpty : `${name}=${text}`;
	};

	if (value.kind === "string") {
		let text = value.value;
		if (spec.prefix !== null) text = Array.from(text).slice(0, spec.prefix).join("");
		return named(spec.name, encode(text));
	}
	if (!spec.explode) {
		let items =
			value.kind === "list"
				? value.items.map(encode)
				: value.pairs.flatMap(([key, item]) => [encode(key), encode(item)]);
		return named(spec.name, items.join(","));
	}
	if (value.kind === "list") {
		return value.items.map((item) => named(spec.name, encode(item))).join(rules.separator);
	}
	return value.pairs
		.map(([key, item]) =>
			rules.named ? named(encode(key), encode(item)) : `${encode(key)}=${encode(item)}`,
		)
		.join(rules.separator);
}

/** A value as one of the three kinds, or `null` when section 2.3 counts it as undefined. */
function normalize(value: VariableValue): Defined | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== "object") return { kind: "string", value: String(value) };
	if (Array.isArray(value)) {
		if (value.length === 0) return null;
		if (value.every((item) => Array.isArray(item) && item.length === 2)) {
			let pairs = (value as readonly (readonly [string, Scalar])[]).map(
				([key, item]): [string, string] => [key, String(item)],
			);
			return { kind: "pairs", pairs };
		}
		return { kind: "list", items: (value as readonly Scalar[]).map(String) };
	}
	let entries = Object.entries(value as Record<string, Scalar>);
	if (entries.length === 0) return null;
	return {
		kind: "pairs",
		pairs: entries.map(([key, item]): [string, string] => [key, String(item)]),
	};
}
