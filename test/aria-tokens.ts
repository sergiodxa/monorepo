/**
 * Scanner behind the ARIA-token rule: reports every place a boolean reaches
 * an ARIA attribute whose value is a token instead of a flag, since such an
 * attribute renders a boolean as an empty value and falls back to its
 * default, leaving the state unannounced. A plain module, not a test file,
 * since importing a test file to reuse a function registers its suites too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * ARIA attributes whose value is a token rather than a flag: each accepts
 * text such as `"true"`, `"mixed"`, or `"polite"` and none is an HTML
 * boolean attribute, which is why passing a bare boolean into one is wrong.
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
 * Blanks every comment in `source`, preserving length and newlines so
 * offsets and lines still line up despite this file's own comments. Inside
 * a tracked string, an escaped character and any `//` are left alone.
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
 * Scans one module's text for booleans reaching a token-valued ARIA
 * attribute, scanning the whole file at once since JSX often places an
 * attribute several lines above the element's closing `>`.
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
