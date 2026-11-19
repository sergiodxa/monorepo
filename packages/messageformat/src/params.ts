/**
 * `MessageParams`, a type-level reader of MessageFormat 2 source: it lists the external
 * variables a message reads and types each by the function that formats it, so a caller
 * holding the message as a string literal type can type-check the values it passes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The values a message reads, by variable name, typed as the default functions accept them:
 * `:number`/`:integer` take `number | bigint`, `:string` and plain placeholders take text or
 * numbers, and option values take `unknown`. `.local` names are left out; `string` reads any.
 *
 * @template Source - The message's MessageFormat 2 source.
 * @example let values: MessageParams<"{$count :number} new posts"> = { count: 3 };
 */
export type MessageParams<Source extends string> = string extends Source
	? Record<string, unknown>
	: Source extends string
		? Collect<Scan<StripEscapes<Source>>>
		: never;

/** How a variable is used: as a numeric operand, a plain or `:string` one, or anything else. */
type Usage = "number" | "plain" | "any";

/** One variable reference, as its name and how it is used there. */
type Reference = [name: string, usage: Usage];

/** The whitespace and bidi controls the grammar lets surround tokens. */
type Space =
	| " "
	| "\t"
	| "\r"
	| "\n"
	| "\u3000"
	| "\u061C"
	| "\u200E"
	| "\u200F"
	| "\u2066"
	| "\u2067"
	| "\u2068"
	| "\u2069";

/** The characters that end a variable or function name. */
type NameEnd = Space | ":" | "=" | "@" | "{" | "}" | "|" | "$" | "/" | "#";

/**
 * Drops every backslash escape with the character it escapes. An escaped character is text
 * or literal content, so what remains delimits placeholders and literals unambiguously.
 */
type StripEscapes<
	S extends string,
	Kept extends string = "",
> = S extends `${infer Before}\\${infer _Escaped}${infer After}`
	? StripEscapes<After, `${Kept}${Before}`>
	: `${Kept}${S}`;

/** `S` without leading whitespace. */
type TrimStart<S extends string> = S extends `${Space}${infer Rest}` ? TrimStart<Rest> : S;

/** The name at the start of `S`, up to the first character a name cannot hold. */
type ReadName<S extends string, Name extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends NameEnd
		? Name
		: ReadName<Rest, `${Name}${C}`>
	: Name;

/** The text after a quoted literal's closing `|`, given the text after its opening one. */
type SkipLiteral<S extends string> = S extends `${string}|${infer Rest}` ? Rest : "";

/** A message is complex when, after leading whitespace, it opens with `.` or `{{`. */
type Scan<S extends string> =
	TrimStart<S> extends `${"." | "{{"}${string}`
		? Code<TrimStart<S>, never, never>
		: Text<S, false, never, never>;

/**
 * Pattern text: only `{` opens a placeholder, and inside a quoted pattern the first `}`
 * outside a placeholder closes it, returning to the declarations and variants around it.
 */
type Text<
	S extends string,
	Quoted extends boolean,
	Refs extends Reference,
	Locals extends string,
> = Quoted extends false
	? S extends `${string}{${infer Rest}`
		? Expr<Rest, "text", "", Refs, Locals>
		: [Refs, Locals]
	: S extends `${infer Before}}${infer Rest}`
		? Before extends `${string}{${infer Inside}`
			? Expr<`${Inside}}${Rest}`, "quoted", "", Refs, Locals>
			: Code<Rest extends `}${infer After}` ? After : Rest, Refs, Locals>
		: [Refs, Locals];

/**
 * The body of one placeholder or declaration, read up to its closing `}` with quoted
 * literals blanked, since a literal may hold `}`, `$` or `{` as content.
 */
type Expr<
	S extends string,
	Resume extends "text" | "quoted" | "code",
	Body extends string,
	Refs extends Reference,
	Locals extends string,
> = S extends `${infer Before}}${infer Rest}`
	? Before extends `${infer Head}|${infer Literal}`
		? Expr<SkipLiteral<`${Literal}}${Rest}`>, Resume, `${Body}${Head}||`, Refs, Locals>
		: Resume extends "code"
			? Code<Rest, Refs | Expression<`${Body}${Before}`>, Locals>
			: Text<
					Rest,
					Resume extends "quoted" ? true : false,
					Refs | Expression<`${Body}${Before}`>,
					Locals
				>
	: [Refs | Expression<`${Body}${S}`>, Locals];

/**
 * A complex message's code: `.input` and `.local` declarations, `.match` selectors and
 * variant keys, each quoted pattern scanned as text.
 */
type Code<S extends string, Refs extends Reference, Locals extends string> = S extends ""
	? [Refs, Locals]
	: S extends `${Space}${infer Rest}`
		? Code<Rest, Refs, Locals>
		: S extends `.local${infer Rest}`
			? Code<LocalExpr<Rest>, Refs, Locals | LocalName<Rest>>
			: S extends `{{${infer Rest}`
				? Text<Rest, true, Refs, Locals>
				: S extends `{${infer Rest}`
					? Expr<Rest, "code", "", Refs, Locals>
					: S extends `$${infer Rest}`
						? Code<Rest, Refs | [ReadName<Rest>, "any"], Locals>
						: S extends `|${infer Rest}`
							? Code<SkipLiteral<Rest>, Refs, Locals>
							: S extends `${infer _Skipped}${infer Rest}`
								? Code<Rest, Refs, Locals>
								: [Refs, Locals];

/** The name a `.local` declaration binds, given the text after the keyword. */
type LocalName<S extends string> = TrimStart<S> extends `$${infer Rest}` ? ReadName<Rest> : never;

/** The text from a `.local` declaration's expression on, given the text after the keyword. */
type LocalExpr<S extends string> = S extends `${string}=${infer Rest}` ? Rest : "";

/**
 * The references in one expression or markup body. A variable operand is used as its
 * function says; option values, markup options and selectors take anything.
 */
type Expression<Body extends string> =
	TrimStart<Body> extends `${"#" | "/"}${string}`
		? Variables<Body>
		: TrimStart<Body> extends `$${infer Rest}`
			? Operand<ReadName<Rest>, Rest extends `${ReadName<Rest>}${infer After}` ? After : "">
			: Variables<Body>;

/** An operand named `Name`, followed by `Rest`: its optional function, options and attributes. */
type Operand<Name extends string, Rest extends string> =
	TrimStart<Rest> extends `:${infer Annotation}`
		? [Name, FunctionUsage<ReadName<Annotation>>] | Variables<Annotation>
		: [Name, "plain"] | Variables<Rest>;

/** How the default functions read their operand; any other function's operand is opaque. */
type FunctionUsage<Name extends string> = Name extends "number" | "integer"
	? "number"
	: Name extends "string"
		? "plain"
		: "any";

/** Every `$name` in `S`, each used as anything. */
type Variables<
	S extends string,
	Refs extends Reference = never,
> = S extends `${string}$${infer Rest}` ? Variables<Rest, Refs | [ReadName<Rest>, "any"]> : Refs;

/**
 * One object type from a scan, which yields every reference and the names `.local` binds:
 * each referenced name but the locals, typed by its uses.
 */
type Collect<Result> = Result extends [infer Refs extends Reference, infer Locals extends string]
	? { [Name in Exclude<Refs[0], Locals | "">]: ValueOf<Extract<Refs, [Name, Usage]>[1]> }
	: never;

/** The values every use of a variable accepts at once. */
type ValueOf<Uses extends Usage> = "number" extends Uses
	? number | bigint
	: "plain" extends Uses
		? string | number | bigint
		: unknown;
