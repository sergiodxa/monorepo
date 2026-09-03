/**
 * The recursive-descent parser for `.spec` files: consumes the lexer's token
 * stream and builds the AST one node per GRAMMAR.md production, enforcing the
 * structural rules the grammar states in prose — phase order, `eventually`
 * placement, call expressions only as a full right-hand side, unique object
 * keys. Every failure is a `ParseError` value naming what was expected and
 * what was found.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type {
	ArgumentNode,
	BlockNode,
	CallNode,
	CommandNode,
	DefinitionNode,
	EventuallyNode,
	ExpectNode,
	ExpressionNode,
	FixtureNode,
	LetNode,
	ObjectEntryNode,
	ObjectNode,
	ReferenceNode,
	ReturnNode,
	RhsNode,
	SpecFileNode,
	StatementNode,
	TestNode,
	UseNode,
} from "./ast.js";
import type { SourceFile, Span } from "./source.js";
import type { Keyword, Token, TokenKind } from "./tokens.js";

import { ParseError } from "./errors.js";
import { lex } from "./lexer.js";

/** The three test phases, in the only order the grammar admits. */
const PHASES = ["given", "when", "then"] as const;

type Phase = (typeof PHASES)[number];

/** Token kinds that can begin an argument (plus the `true`/`false` keywords). */
const ARGUMENT_START_KINDS: ReadonlySet<TokenKind> = new Set<TokenKind>([
	"string",
	"multiline-string",
	"number",
	"duration",
	"identifier",
	"lbrace",
]);

/**
 * Parse a `.spec` file into its AST, lexing it first. The result is either
 * the complete `SpecFileNode` or the first `ParseError` encountered, which
 * carries the file path and the span of the offending text.
 *
 * @param source - The file to parse.
 * @returns The parsed file, or a `ParseError` describing the failure.
 */
export function parse(source: SourceFile): Result<SpecFileNode, ParseError> {
	let lexed = lex(source);
	if (isFailure(lexed)) return lexed;
	let tokens = lexed.data;
	let position = 0;

	/** The token under the cursor; the stream always ends with `eof`. */
	function current(): Token {
		let token = tokens[position];
		if (token) return token;
		let last = tokens[tokens.length - 1];
		if (last) return last;
		throw new ParseError("Unexpected end of input.", source.path);
	}

	/** Consume and return the current token; `eof` is never consumed. */
	function advance(): Token {
		let token = current();
		if (token.kind !== "eof") position += 1;
		return token;
	}

	function check(kind: TokenKind): boolean {
		return current().kind === kind;
	}

	function checkKeyword(word: Keyword): boolean {
		let token = current();
		return token.kind === "keyword" && token.keyword === word;
	}

	function fail(message: string, span: Span): never {
		throw new ParseError(message, source.path, span);
	}

	/** Abort naming what was expected and what the cursor actually found. */
	function expected(what: string): never {
		let token = current();
		fail(`Expected ${what}, found ${describeToken(token)}.`, token.span);
	}

	function expectKind(kind: TokenKind, what: string): Token {
		if (!check(kind)) expected(what);
		return advance();
	}

	function expectKeyword(word: Keyword): Token {
		if (!checkKeyword(word)) expected(`the keyword "${word}"`);
		return advance();
	}

	/** Consume a plain (dot-free, non-reserved) identifier used as a name. */
	function expectName(what: string): Token {
		let token = current();
		if (token.kind === "keyword") {
			fail(
				`Expected ${what}, found the reserved keyword "${token.text}"; keywords cannot be used as names.`,
				token.span,
			);
		}
		if (token.kind !== "identifier") expected(what);
		if (token.text.includes(".")) {
			fail(
				`Expected ${what}, found the dotted name "${token.text}"; ${what} cannot contain dots.`,
				token.span,
			);
		}
		return advance();
	}

	/** Skip a run of newline tokens (blank lines are insignificant). */
	function skipNewlines(): void {
		while (check("newline")) advance();
	}

	/** A statement ends at a newline or at the block's closing brace. */
	function expectStatementEnd(): void {
		if (check("newline")) {
			skipNewlines();
			return;
		}
		if (check("rbrace") || check("eof")) return;
		expected("a newline to end the statement");
	}

	/** A top-level item ends at a newline or at the end of the file. */
	function expectTopLevelEnd(): void {
		if (check("newline")) {
			skipNewlines();
			return;
		}
		if (check("eof")) return;
		expected("a newline after the declaration");
	}

	/** file = { use | definition | test } */
	function parseFile(): SpecFileNode {
		let uses: UseNode[] = [];
		let definitions: DefinitionNode[] = [];
		let tests: TestNode[] = [];
		skipNewlines();
		while (!check("eof")) {
			if (checkKeyword("use")) uses.push(parseUse());
			else if (checkKeyword("command")) definitions.push(parseCommand());
			else if (checkKeyword("fixture")) definitions.push(parseFixture());
			else if (checkKeyword("test")) tests.push(parseTest());
			else expected('"use", "command", "fixture", or "test" at the top level');
			expectTopLevelEnd();
		}
		return { path: source.path, uses, definitions, tests };
	}

	/** use = "use" IDENT */
	function parseUse(): UseNode {
		let keyword = expectKeyword("use");
		let name = expectName("a namespace name");
		return { namespace: name.text, span: { start: keyword.span.start, end: name.span.end } };
	}

	/** command = "command" IDENT [ "(" [ params ] ")" ] block */
	function parseCommand(): CommandNode {
		let keyword = expectKeyword("command");
		let name = expectName("a command name");
		let params: string[] = [];
		if (check("lparen")) {
			advance();
			skipNewlines();
			if (!check("rparen")) {
				while (true) {
					params.push(expectName("a parameter name").text);
					skipNewlines();
					if (check("comma")) {
						advance();
						skipNewlines();
						continue;
					}
					break;
				}
			}
			expectKind("rparen", '")" to close the parameter list');
		}
		let body = parseBlock(false);
		return {
			kind: "command",
			name: name.text,
			params,
			body,
			span: { start: keyword.span.start, end: body.span.end },
		};
	}

	/** fixture = "fixture" IDENT block */
	function parseFixture(): FixtureNode {
		let keyword = expectKeyword("fixture");
		let name = expectName("a fixture name");
		let body = parseBlock(false);
		return {
			kind: "fixture",
			name: name.text,
			body,
			span: { start: keyword.span.start, end: body.span.end },
		};
	}

	/** test = "test" STRING "{" [ given ] [ when ] [ then ] "}" — ≥1 phase. */
	function parseTest(): TestNode {
		let keyword = expectKeyword("test");
		let title = expectKind("string", "a test title string");
		expectKind("lbrace", '"{" to open the test');
		skipNewlines();
		let blocks = new Map<Phase, BlockNode>();
		let lastPhase: Phase | undefined;
		while (!check("rbrace")) {
			let token = current();
			let phase = PHASES.find((name) => checkKeyword(name));
			if (!phase) expected('"given", "when", "then", or "}"');
			if (blocks.has(phase)) {
				fail(
					`The "${phase}" phase appears more than once; each phase may appear at most once per test.`,
					token.span,
				);
			}
			if (lastPhase && PHASES.indexOf(phase) < PHASES.indexOf(lastPhase)) {
				fail(
					`The "${phase}" phase cannot follow "${lastPhase}"; phases run in given, when, then order.`,
					token.span,
				);
			}
			advance();
			blocks.set(phase, parseBlock(phase === "then"));
			lastPhase = phase;
			skipNewlines();
		}
		let close = advance();
		let span: Span = { start: keyword.span.start, end: close.span.end };
		if (blocks.size === 0) {
			fail("A test must contain at least one phase (given, when, or then).", span);
		}
		let node: TestNode = { title: stringValue(title), span };
		let given = blocks.get("given");
		let when = blocks.get("when");
		let then = blocks.get("then");
		if (given) node.given = given;
		if (when) node.when = when;
		// oxlint-disable-next-line unicorn/no-thenable -- the grammar names the phase "then"; a TestNode is never awaited.
		if (then) node.then = then;
		return node;
	}

	/** block = "{" { statement } "}" — newlines ignored after `{`/before `}`. */
	function parseBlock(allowEventually: boolean): BlockNode {
		let open = expectKind("lbrace", '"{" to open a block');
		skipNewlines();
		let statements: StatementNode[] = [];
		while (!check("rbrace")) {
			if (check("eof")) expected('"}" to close the block');
			statements.push(parseStatement(allowEventually));
			expectStatementEnd();
		}
		let close = advance();
		return { statements, span: { start: open.span.start, end: close.span.end } };
	}

	/** statement = let | return | expect | eventually | call */
	function parseStatement(allowEventually: boolean): StatementNode {
		if (checkKeyword("let")) return parseLet();
		if (checkKeyword("return")) return parseReturn();
		if (checkKeyword("expect")) return parseExpect();
		if (checkKeyword("eventually")) {
			if (!allowEventually) {
				fail('"eventually" is only valid directly inside a "then" block.', current().span);
			}
			return parseEventually();
		}
		if (check("identifier")) return parseCall();
		return expected('a statement ("let", "return", "expect", "eventually", or a call)');
	}

	/** let = "let" IDENT "=" rhs */
	function parseLet(): LetNode {
		let keyword = expectKeyword("let");
		let name = expectName("a binding name");
		expectKind("equals", '"=" after the binding name');
		let value = parseRhs();
		return {
			kind: "let",
			name: name.text,
			value,
			span: { start: keyword.span.start, end: value.span.end },
		};
	}

	/** return = "return" rhs */
	function parseReturn(): ReturnNode {
		let keyword = expectKeyword("return");
		let value = parseRhs();
		return { kind: "return", value, span: { start: keyword.span.start, end: value.span.end } };
	}

	/**
	 * rhs = call-expr | expression. A `PATH` here with arguments is a call
	 * expression, without arguments a reference — the only place the grammar
	 * allows a value-producing invocation.
	 */
	function parseRhs(): RhsNode {
		if (checkKeyword("fixture")) {
			let keyword = advance();
			let name = expectName("a fixture name");
			return {
				kind: "fixture-call",
				name: name.text,
				span: { start: keyword.span.start, end: name.span.end },
			};
		}
		if (check("identifier")) {
			let target = advance();
			if (!atArgumentStart()) return referenceFrom(target);
			let args = parseArguments();
			let last = args[args.length - 1];
			return {
				kind: "call-expr",
				target: target.text,
				args,
				span: { start: target.span.start, end: last ? last.span.end : target.span.end },
			};
		}
		return parseExpression();
	}

	function atArgumentStart(): boolean {
		let token = current();
		if (token.kind === "keyword") return token.keyword === "true" || token.keyword === "false";
		return ARGUMENT_START_KINDS.has(token.kind);
	}

	/** argument list: as many arguments as the line offers, possibly none. */
	function parseArguments(): ArgumentNode[] {
		let args: ArgumentNode[] = [];
		while (atArgumentStart()) args.push(parseArgument());
		return args;
	}

	/** argument = expression | word — a bare identifier here is a word. */
	function parseArgument(): ArgumentNode {
		let token = current();
		if (token.kind === "identifier" && !token.text.includes(".")) {
			advance();
			return { kind: "word", word: token.text, span: token.span };
		}
		return parseExpression();
	}

	/** expression = literal | object | PATH-as-reference */
	function parseExpression(): ExpressionNode {
		let token = current();
		if (token.kind === "string" || token.kind === "multiline-string") {
			advance();
			return { kind: "string", value: stringValue(token), span: token.span };
		}
		if (token.kind === "number") {
			advance();
			return { kind: "number", value: numberValue(token), span: token.span };
		}
		if (token.kind === "duration") {
			advance();
			return { kind: "duration", milliseconds: numberValue(token), span: token.span };
		}
		if (token.kind === "keyword" && (token.keyword === "true" || token.keyword === "false")) {
			advance();
			return { kind: "boolean", value: token.keyword === "true", span: token.span };
		}
		if (token.kind === "lbrace") return parseObject();
		if (token.kind === "identifier") {
			advance();
			return referenceFrom(token);
		}
		return expected("an expression (a literal, an object, or a reference)");
	}

	/** A dotted identifier token as a reference into bindings. */
	function referenceFrom(token: Token): ReferenceNode {
		return { kind: "reference", path: token.text.split("."), span: token.span };
	}

	/** object = "{" [ entry { entry-sep entry } ] "}" — keys must be unique. */
	function parseObject(): ObjectNode {
		let open = expectKind("lbrace", '"{" to open an object literal');
		skipNewlines();
		let entries: ObjectEntryNode[] = [];
		let seen = new Set<string>();
		while (!check("rbrace")) {
			let entry = parseObjectEntry();
			if (seen.has(entry.key)) fail(`Duplicate key "${entry.key}" in object literal.`, entry.span);
			seen.add(entry.key);
			entries.push(entry);
			let separated = false;
			if (check("newline")) {
				skipNewlines();
				separated = true;
			}
			if (check("comma")) {
				advance();
				skipNewlines();
				if (check("rbrace")) expected('an object key after ","');
				separated = true;
			}
			if (check("rbrace")) break;
			if (!separated) {
				expected('"," or a newline between object entries, or "}" to close the object');
			}
		}
		let close = expectKind("rbrace", '"}" to close the object literal');
		return { kind: "object", entries, span: { start: open.span.start, end: close.span.end } };
	}

	/** entry = ( IDENT | STRING ) ":" expression */
	function parseObjectEntry(): ObjectEntryNode {
		let token = current();
		let key: string;
		if (token.kind === "identifier" && !token.text.includes(".")) {
			advance();
			key = token.text;
		} else if (token.kind === "string") {
			advance();
			key = stringValue(token);
		} else if (token.kind === "keyword") {
			fail(
				`Expected an object key, found the reserved keyword "${token.text}"; quote it ("${token.text}") to use it as a key.`,
				token.span,
			);
		} else {
			return expected("an object key (an identifier or a string)");
		}
		expectKind("colon", '":" after the object key');
		let value = parseExpression();
		return { key, value, span: { start: token.span.start, end: value.span.end } };
	}

	/** expect = "expect" argument { argument } — at least one argument. */
	function parseExpect(): ExpectNode {
		let keyword = expectKeyword("expect");
		if (!atArgumentStart()) expected('at least one argument to "expect"');
		let args = parseArguments();
		let last = args[args.length - 1];
		return {
			kind: "expect",
			args,
			span: { start: keyword.span.start, end: last ? last.span.end : keyword.span.end },
		};
	}

	/** eventually = "eventually" [ "within" DURATION ] block */
	function parseEventually(): EventuallyNode {
		let keyword = expectKeyword("eventually");
		let withinMs: number | undefined;
		if (checkKeyword("within")) {
			advance();
			let duration = expectKind("duration", 'a duration (like 10s) after "within"');
			withinMs = numberValue(duration);
		}
		let block = parseBlock(false);
		let node: EventuallyNode = {
			kind: "eventually",
			block,
			span: { start: keyword.span.start, end: block.span.end },
		};
		if (withinMs !== undefined) node.withinMs = withinMs;
		return node;
	}

	/** call = PATH { argument } — a statement-position invocation. */
	function parseCall(): CallNode {
		let target = expectKind("identifier", "a call target");
		let args = parseArguments();
		let last = args[args.length - 1];
		return {
			kind: "call",
			target: target.text,
			args,
			span: { start: target.span.start, end: last ? last.span.end : target.span.end },
		};
	}

	try {
		return success(parseFile());
	} catch (error) {
		if (error instanceof ParseError) return failure(error);
		let message = error instanceof Error ? error.message : String(error);
		return failure(new ParseError(message, source.path));
	}
}

/** Render a token for an error message, the way a reader would name it. */
function describeToken(token: Token): string {
	if (token.kind === "eof") return "the end of the file";
	if (token.kind === "newline") return "a line break";
	if (token.kind === "keyword") return `the keyword "${token.text}"`;
	if (token.kind === "identifier") return `"${token.text}"`;
	if (token.kind === "string") return "a string";
	if (token.kind === "multiline-string") return "a multiline string";
	if (token.kind === "number") return `the number ${token.text}`;
	if (token.kind === "duration") return `the duration ${token.text}`;
	return `"${token.text}"`;
}

/** The decoded payload of a string-like token; the lexer always sets it. */
function stringValue(token: Token): string {
	return typeof token.value === "string" ? token.value : token.text;
}

/** The numeric payload of a number or duration token; the lexer always sets it. */
function numberValue(token: Token): number {
	return typeof token.value === "number" ? token.value : Number(token.text);
}
