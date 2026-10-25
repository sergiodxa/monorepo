/**
 * The parts of an RFC 6570 URI Template and the per-operator expansion rules of its
 * Appendix A, shared by expansion and matching so both read a template the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The expression operators of section 2.2; `""` is simple string expansion. */
export type Operator = "" | "+" | "#" | "." | "/" | ";" | "?" | "&";

/** One variable of an expression with its level 4 modifier, if any. */
export interface VariableSpec {
	name: string;
	/** The `:N` prefix length in characters, or `null`. */
	prefix: number | null;
	/** Whether `*` explodes a list or associative array into separate items. */
	explode: boolean;
}

/** A `{…}` expression. */
export interface Expression {
	operator: Operator;
	variables: VariableSpec[];
	/** UTF-16 offset of the `{` in the template. */
	offset: number;
}

/** Literal text, already in its expanded (percent-encoded where needed) form, or an expression. */
export type TemplatePart = string | Expression;

/** Appendix A's table: what an operator writes first, between items, and which characters it keeps. */
export interface OperatorRules {
	first: string;
	separator: string;
	named: boolean;
	/** What follows a name whose value is empty: `"="` for query forms, nothing for `;`. */
	ifEmpty: string;
	/** Whether reserved characters and existing percent-encodings pass through unencoded. */
	allowReserved: boolean;
}

/** The expansion rules for every operator. */
export const OPERATORS: Record<Operator, OperatorRules> = {
	"": { first: "", separator: ",", named: false, ifEmpty: "", allowReserved: false },
	"+": { first: "", separator: ",", named: false, ifEmpty: "", allowReserved: true },
	"#": { first: "#", separator: ",", named: false, ifEmpty: "", allowReserved: true },
	".": { first: ".", separator: ".", named: false, ifEmpty: "", allowReserved: false },
	"/": { first: "/", separator: "/", named: false, ifEmpty: "", allowReserved: false },
	";": { first: ";", separator: ";", named: true, ifEmpty: "", allowReserved: false },
	"?": { first: "?", separator: "&", named: true, ifEmpty: "=", allowReserved: false },
	"&": { first: "&", separator: "&", named: true, ifEmpty: "=", allowReserved: false },
};
