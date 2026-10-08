/**
 * A recursive-descent parser from TeX math to a MathML tree. Each grammar rule
 * is one method, and a failure throws a positioned error the public entry
 * catches, so the recursion reads as the grammar it implements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Token } from "./lexer.js";
import type { Limits } from "./symbols.js";
import type { MathNode } from "./tree.js";

import { MathError } from "./errors.js";
import { Lexer } from "./lexer.js";
import {
	ACCENTS,
	BIG_OPERATORS,
	DELIMITER_CHARACTERS,
	DELIMITER_COMMANDS,
	ENVIRONMENTS,
	FONTS,
	FUNCTIONS,
	GREEK_LOWER,
	GREEK_UPPER,
	OPERATOR_CHARACTERS,
	SPACES,
	SYMBOLS,
} from "./symbols.js";
import { element, row, token } from "./tree.js";
import { applyVariant } from "./variants.js";

/** The invisible operator MathML places between a function name and its argument. */
const FUNCTION_APPLICATION = "⁡";

/**
 * Tokens that end the expression being read. Each belongs to some enclosing
 * construct, which decides whether it was the one expected there.
 */
const CLOSERS = new Set(["}", "&", "\\\\", "\\end", "\\right"]);

/**
 * A parsed atom, with what the scripts that follow it need to know: where a big
 * operator puts its limits, and whether a function application follows it.
 */
interface Atom {
	node: MathNode;
	limits?: Limits;
	applies?: boolean;
}

/**
 * @param source - TeX math source
 * @param display - Whether the formula is a block, which moves big operators' limits under and over them
 * @returns The formula's nodes, in order
 * @throws {MathError} When the source holds anything outside the supported subset
 */
export function parse(source: string, display: boolean): MathNode[] {
	return new Parser(source, display).parseFormula();
}

/** Holds the cursor and the display mode the grammar rules share while one formula is read. */
class Parser {
	private readonly lexer: Lexer;

	/**
	 * @param source - TeX math source
	 * @param display - Whether the formula is a block
	 */
	constructor(
		private readonly source: string,
		private readonly display: boolean,
	) {
		this.lexer = new Lexer(source);
	}

	/** The whole source as one expression; any closer left over had nothing to close. */
	parseFormula(): MathNode[] {
		let nodes = this.parseExpression(false);
		this.expect("");
		return nodes;
	}

	/**
	 * Reads atoms with their scripts until a closer or the end. A `]` closes too
	 * when the expression is the optional argument of `\sqrt`.
	 */
	private parseExpression(bracket: boolean): MathNode[] {
		let nodes: MathNode[] = [];

		while (true) {
			let next = this.lexer.peek();
			if (next.kind === "end" || CLOSERS.has(next.value)) return nodes;
			if (bracket && next.value === "]") return nodes;
			nodes.push(...this.parseScripted());
		}
	}

	/** One atom and the scripts attached to it, followed by function application when the atom is a function. */
	private parseScripted(): MathNode[] {
		let next = this.lexer.peek();
		let atom: Atom =
			next.value === "^" || next.value === "_" ? { node: element("mrow") } : this.parseAtom();
		let limits = atom.limits;
		let sub: MathNode | undefined;
		let sup: MathNode | undefined;

		while (true) {
			let script = this.lexer.peek();
			if (
				script.kind === "command" &&
				(script.value === "\\limits" || script.value === "\\nolimits")
			) {
				if (limits === undefined) {
					throw this.error(`${script.value} must follow an operator`, script);
				}
				this.lexer.next();
				limits = script.value === "\\limits" ? "always" : "never";
				continue;
			}
			if (script.value === "^" && script.kind === "character") {
				this.lexer.next();
				if (sup) throw this.error("Double superscript", script);
				sup = this.parseArgument();
				continue;
			}
			if (script.value === "_" && script.kind === "character") {
				this.lexer.next();
				if (sub) throw this.error("Double subscript", script);
				sub = this.parseArgument();
				continue;
			}
			break;
		}

		let scripted = this.attachScripts(atom.node, sub, sup, this.takesLimits(limits));
		if (!atom.applies) return [scripted];
		return [scripted, token("mo", FUNCTION_APPLICATION)];
	}

	/** Whether scripts become limits, which for most big operators depends on the display mode. */
	private takesLimits(limits: Limits | undefined): boolean {
		if (limits === "always") return true;
		if (limits === "display") return this.display;
		return false;
	}

	/** Builds the scripted element, choosing under/over placement for limits and beside placement otherwise. */
	private attachScripts(
		base: MathNode,
		sub: MathNode | undefined,
		sup: MathNode | undefined,
		limits: boolean,
	): MathNode {
		if (sub && sup) return element(limits ? "munderover" : "msubsup", [base, sub, sup]);
		if (sub) return element(limits ? "munder" : "msub", [base, sub]);
		if (sup) return element(limits ? "mover" : "msup", [base, sup]);
		return base;
	}

	/**
	 * What a script or a command takes: a braced group, a single digit, or one
	 * atom. A closer or the end here means the argument is missing.
	 */
	private parseArgument(): MathNode {
		let next = this.lexer.peek();
		if (
			next.kind === "end" ||
			CLOSERS.has(next.value) ||
			(next.kind === "character" && (next.value === "^" || next.value === "_"))
		) {
			throw this.error("Expected an argument", next);
		}
		if (next.kind === "number") return token("mn", this.lexer.nextDigit().value);
		return this.parseAtom().node;
	}

	/** A braced group, unwrapped when it holds a single node. */
	private parseGroup(): MathNode {
		this.lexer.next();
		let nodes = this.parseExpression(false);
		this.expect("}");
		return row(nodes);
	}

	/** One unit of the formula: a number, a character, a group, or a command and its arguments. */
	private parseAtom(): Atom {
		let next = this.lexer.peek();

		if (next.kind === "number") return { node: token("mn", this.lexer.next().value) };
		if (next.kind === "character") {
			if (next.value === "{") return { node: this.parseGroup() };
			return { node: this.parseCharacter(this.lexer.next()) };
		}
		return this.parseCommand(this.lexer.next());
	}

	/** A letter is an identifier, a known symbol an operator, and an ASCII character with no math meaning an error. */
	private parseCharacter(next: Token): MathNode {
		let value = next.value;
		if (DELIMITER_CHARACTERS.has(value)) return token("mo", value, { stretchy: "false" });
		let operator = OPERATOR_CHARACTERS[value];
		if (operator !== undefined) return token("mo", operator);
		if (value === "~") return token("mtext", " ");
		if (/\p{L}/u.test(value)) return token("mi", value);
		if (value.charCodeAt(0) > 127) return token("mo", value);
		throw this.error(`Unexpected character ${value}`, next);
	}

	/** Looks a command up in the symbol tables first, then in the commands that take arguments. */
	private parseCommand(command: Token): Atom {
		let name = command.value;

		let lower = GREEK_LOWER[name];
		if (lower !== undefined) return { node: token("mi", lower) };

		let upper = GREEK_UPPER[name];
		if (upper !== undefined) return { node: token("mi", upper, { mathvariant: "normal" }) };

		let symbol = SYMBOLS[name];
		if (symbol !== undefined) return { node: token(symbol.element, symbol.value) };

		let delimiter = DELIMITER_COMMANDS[name];
		if (delimiter !== undefined) return { node: token("mo", delimiter, { stretchy: "false" }) };

		let operator = BIG_OPERATORS[name];
		if (operator !== undefined)
			return { node: token("mo", operator.value), limits: operator.limits };

		let fn = FUNCTIONS[name];
		if (fn !== undefined)
			return { node: token("mi", name.slice(1)), limits: fn.limits, applies: true };

		let space = SPACES[name];
		if (space !== undefined) return { node: element("mspace", [], { width: space }) };

		let accent = ACCENTS[name];
		if (accent !== undefined) {
			return {
				node: element("mover", [this.parseArgument(), token("mo", accent)], { accent: "true" }),
			};
		}

		let font = FONTS[name];
		if (font !== undefined) return { node: applyVariant(this.parseArgument(), font) };

		return this.parseStructure(command);
	}

	/** The commands with a grammar of their own: fractions, roots, fences, text and environments. */
	private parseStructure(command: Token): Atom {
		switch (command.value) {
			case "\\frac":
			case "\\dfrac":
			case "\\tfrac": {
				let numerator = this.parseArgument();
				return { node: element("mfrac", [numerator, this.parseArgument()]) };
			}

			case "\\binom": {
				let top = this.parseArgument();
				let fraction = element("mfrac", [top, this.parseArgument()], { linethickness: "0" });
				return { node: element("mrow", [fence("(", "prefix"), fraction, fence(")", "postfix")]) };
			}

			case "\\sqrt":
				return { node: this.parseRoot() };

			case "\\left":
				return { node: this.parseFenced() };

			case "\\text":
			case "\\textrm":
			case "\\mbox":
				return { node: token("mtext", textContent(this.lexer.readGroup().value)) };

			case "\\operatorname":
				return { node: token("mi", textContent(this.lexer.readGroup().value)), applies: true };

			case "\\begin":
				return { node: this.parseEnvironment(command) };

			case "\\ ":
				return { node: token("mtext", " ") };

			default:
				throw this.error(`Unknown command ${command.value}`, command);
		}
	}

	/** `\sqrt{x}`, or `\sqrt[n]{x}` with the index read up to the closing bracket. */
	private parseRoot(): MathNode {
		let next = this.lexer.peek();
		if (next.kind !== "character" || next.value !== "[") {
			return element("msqrt", [this.parseArgument()]);
		}

		this.lexer.next();
		let index = row(this.parseExpression(true));
		this.expect("]");
		return element("mroot", [this.parseArgument(), index]);
	}

	/** `\left` … `\right`, whose delimiters stretch to the content between them; `.` draws none. */
	private parseFenced(): MathNode {
		let open = this.parseDelimiter("prefix");
		let content = this.parseExpression(false);
		this.expect("\\right");
		let close = this.parseDelimiter("postfix");

		let nodes = [...(open ? [open] : []), ...content, ...(close ? [close] : [])];
		return element("mrow", nodes);
	}

	/** The delimiter after `\left` or `\right`, or nothing for the empty delimiter `.`. */
	private parseDelimiter(form: "prefix" | "postfix"): MathNode | undefined {
		let next = this.lexer.next();
		if (next.kind === "character" && next.value === ".") return undefined;
		if (next.kind === "number" && next.value.startsWith(".")) {
			throw this.error(`Unknown delimiter ${next.value}`, next);
		}

		let value =
			next.kind === "command"
				? DELIMITER_COMMANDS[next.value]
				: DELIMITER_CHARACTERS.has(next.value) || next.value === "/"
					? next.value
					: undefined;

		if (value === undefined) {
			if (next.kind === "end") throw this.error("Expected a delimiter", next);
			throw this.error(`Unknown delimiter ${next.value}`, next);
		}
		return fence(value, form);
	}

	/**
	 * `\begin{name}` … `\end{name}`: cells split by `&`, rows by `\\`, laid out
	 * as a table. A trailing `\\` leaves an empty last row, which TeX draws as
	 * nothing, so it is dropped.
	 */
	private parseEnvironment(begin: Token): MathNode {
		let name = this.lexer.readGroup().value;
		let environment = ENVIRONMENTS[name];
		if (environment === undefined) throw this.error(`Unknown environment ${name}`, begin);

		let rows: MathNode[][][] = [[]];

		while (true) {
			let cell = this.parseExpression(false);
			(rows.at(-1) as MathNode[][]).push(cell);

			let next = this.lexer.peek();
			if (next.value === "&") {
				this.lexer.next();
				continue;
			}
			if (next.value === "\\\\") {
				this.lexer.next();
				rows.push([]);
				continue;
			}
			if (next.value === "\\end") {
				this.lexer.next();
				let end = this.lexer.readGroup().value;
				if (end !== name) throw this.error(`\\begin{${name}} ended by \\end{${end}}`, next);
				break;
			}
			this.expect("\\end");
		}

		let last = rows.at(-1) as MathNode[][];
		if (rows.length > 1 && last.length === 1 && (last[0] as MathNode[]).length === 0) rows.pop();

		let attributes: Record<string, string> = environment.columnalign
			? { columnalign: environment.columnalign }
			: {};
		let table = element(
			"mtable",
			rows.map((cells) =>
				element(
					"mtr",
					cells.map((cell) => element("mtd", cell)),
				),
			),
			attributes,
		);

		if (!environment.open) return table;
		let nodes = [fence(environment.open, "prefix"), table];
		if (environment.close) nodes.push(fence(environment.close, "postfix"));
		return element("mrow", nodes);
	}

	/**
	 * Consumes the token an enclosing construct expects, or fails naming what
	 * stood there instead; `""` expects the end of the source.
	 */
	private expect(value: string): void {
		let next = this.lexer.peek();
		if (next.kind === "end" ? value === "" : next.value === value) {
			this.lexer.next();
			return;
		}
		if (next.kind === "end") throw this.error(`Expected ${value}`, next);
		if (next.value === "&" || next.value === "\\\\") {
			throw this.error(`${next.value} is only allowed inside an environment`, next);
		}
		throw this.error(`Unexpected ${next.value}`, next);
	}

	/** A positioned error, thrown by the caller so the rule that failed stays on the stack. */
	private error(reason: string, at: Token): MathError {
		return new MathError(reason, this.source, at.index);
	}
}

/** A delimiter stretched to its content, with the form that spaces it as an opening or closing fence. */
function fence(value: string, form: "prefix" | "postfix"): MathNode {
	return token("mo", value, { form, stretchy: "true" });
}

/**
 * The text of a `\text` group: escaped specials become themselves, and the
 * edge spaces MathML would collapse become no-break spaces, so `\text{if }`
 * keeps its gap.
 */
function textContent(raw: string): string {
	return raw
		.replace(/\\([{}$%&_#])/g, "$1")
		.replace(/^ +| +$/g, (spaces) => " ".repeat(spaces.length));
}
