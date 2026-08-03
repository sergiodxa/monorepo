/**
 * Scanner behind the ARIA-token rule: given a module's source, it reports every place
 * a boolean reaches an ARIA attribute whose value is a token.
 *
 * It lives at the repo root, and is imported by both the repo-wide guard beside it and
 * `packages/r3-ui`'s own package-scoped one, so the rule has a single definition. The
 * full account of the failure mode is in the "ARIA values are tokens, never flags"
 * section of `packages/r3-ui/AGENTS.md`; the short version is that these attributes
 * take text, the renderer writes a `true` prop as the bare attribute name, and the
 * empty value that produces is none of the tokens ARIA defines — so the attribute
 * falls back to its default and the state goes unannounced.
 *
 * A plain module rather than a test file: importing a test file to reuse a function
 * out of it registers that file's suites too, and they then run once per importer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * ARIA attributes whose value is a token rather than a flag.
 *
 * Every one of them accepts text — `"true"`, `"false"`, `"mixed"`, `"page"`,
 * `"menu"`, `"polite"` — and none of them is an HTML boolean attribute, which
 * is the whole distinction this rule turns on. `aria-label` and friends are
 * absent because nobody passes a boolean to a string.
 */
const TOKEN_ATTRIBUTES = [
	"aria-hidden",
	"aria-invalid",
	"aria-busy",
	"aria-pressed",
	"aria-checked",
	"aria-expanded",
	"aria-selected",
	"aria-current",
	"aria-disabled",
	"aria-modal",
	"aria-required",
	"aria-readonly",
	"aria-atomic",
	"aria-multiselectable",
	"aria-haspopup",
	"aria-live",
];

/** One offending occurrence, kept with the line it came from for the failure message. */
export interface AriaViolation {
	file: string;
	line: number;
	source: string;
	reason: string;
}

/**
 * Every `const NAME = true;`/`= false;` in `source`, which is what an
 * `attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN })` may be hiding behind.
 */
function booleanConstants(source: string): Set<string> {
	let names = new Set<string>();
	for (let match of source.matchAll(
		/const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(true|false)\s*;/g,
	)) {
		if (match[1]) names.add(match[1]);
	}
	return names;
}

/**
 * Blanks every comment in `source`, keeping the text the same length and every
 * newline in place so offsets and line numbers still line up.
 *
 * A docblock has to be free to name the mistake — this file's own prose would
 * otherwise trip the scanner — and so does a trailing `// note` on a real line
 * of code. Strings are tracked while walking so a `//` inside one (a URL) is
 * not mistaken for the start of a comment, which would blank the rest of a line
 * that might hold the very thing being looked for.
 */
function withoutComments(source: string): string {
	let out = "";
	let index = 0;
	/** What the walk is currently inside of, which decides what ends it. */
	let state: "code" | "line" | "block" | "'" | '"' | "`" = "code";

	while (index < source.length) {
		let char = source[index] ?? "";
		let next = source[index + 1] ?? "";

		if (state === "code") {
			if (char === "/" && next === "/") {
				state = "line";
				out += "  ";
				index += 2;
				continue;
			}
			if (char === "/" && next === "*") {
				state = "block";
				out += "  ";
				index += 2;
				continue;
			}
			if (char === "'" || char === '"' || char === "`") state = char;
			out += char;
			index += 1;
			continue;
		}

		if (state === "line") {
			if (char === "\n") state = "code";
			out += char === "\n" ? char : " ";
			index += 1;
			continue;
		}

		if (state === "block") {
			if (char === "*" && next === "/") {
				state = "code";
				out += "  ";
				index += 2;
				continue;
			}
			out += char === "\n" ? char : " ";
			index += 1;
			continue;
		}

		// Inside a string: an escape consumes the next character, whatever it is.
		if (char === "\\") {
			out += source.slice(index, index + 2);
			index += 2;
			continue;
		}
		if (char === state) state = "code";
		out += char;
		index += 1;
	}

	return out;
}

/**
 * Scans one module's text for booleans reaching a token-valued ARIA attribute.
 *
 * The whole file is scanned at once rather than line by line, which is not a
 * detail: JSX puts one attribute per line as soon as an element has a few, so
 * `aria-hidden` is very often the last thing on its line with the `>` several
 * lines below it. A per-line scan cannot see that far and silently passed eight
 * such sites across this repo.
 */
export function findAriaViolations(file: string, source: string): AriaViolation[] {
	let violations: AriaViolation[] = [];
	let booleans = booleanConstants(source);
	let attributes = TOKEN_ATTRIBUTES.join("|");
	let scanned = withoutComments(source);

	/** JSX shorthand: `aria-hidden` with no value at all, which means `true`. */
	let shorthand = new RegExp(`(?<![\\w-])(${attributes})(?=\\s*(?:/?>|[a-zA-Z{]))`, "g");
	/** An explicit expression: `aria-hidden={true}` or `aria-hidden={SOME_CONST}`. */
	let expression = new RegExp(`(?<![\\w-])(${attributes})=\\{([^}]*)\\}`, "g");
	/** An object or `attrs()` entry: `"aria-hidden": true`. */
	let entry = new RegExp(`["'](${attributes})["']\\s*:\\s*([^,}\\n]+)`, "g");

	let lines = source.split("\n");

	/** The 1-based line an offset into the scanned text falls on. */
	let lineAt = (offset: number) => scanned.slice(0, offset).split("\n").length;

	let report = (offset: number, attribute: string, reason: string) => {
		let line = lineAt(offset);
		violations.push({
			file,
			line,
			source: (lines[line - 1] ?? "").trim(),
			reason: `${attribute} ${reason}`,
		});
	};

	for (let match of scanned.matchAll(shorthand)) {
		report(
			match.index,
			match[1] ?? "",
			"is written as a valueless JSX shorthand, which renders as an empty value",
		);
	}

	for (let match of scanned.matchAll(expression)) {
		let value = (match[2] ?? "").trim();
		if (value === "true" || value === "false")
			report(match.index, match[1] ?? "", `is given the boolean ${value}`);
		else if (booleans.has(value))
			report(match.index, match[1] ?? "", `is given ${value}, declared as a boolean`);
	}

	for (let match of scanned.matchAll(entry)) {
		let value = (match[2] ?? "").trim();
		if (value === "true" || value === "false")
			report(match.index, match[1] ?? "", `is given the boolean ${value}`);
		else if (booleans.has(value))
			report(match.index, match[1] ?? "", `is given ${value}, declared as a boolean`);
	}

	return violations.sort((left, right) => left.line - right.line);
}
