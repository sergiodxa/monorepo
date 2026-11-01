/**
 * Holds the app and root components to the color tokens the theme defines: every
 * `--ui-*` color a role helper (`bg`, `fg`, `border`…) or a fallback-less `var()` reads
 * resolves in light and dark, since an undefined one paints transparent with no error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const ROOT = dirname(fileURLToPath(import.meta.url));

/** The kit's theme followed by the base contract it imports, the two files that declare tokens. */
const THEMES = [
	readFileSync(join(ROOT, "theme.css"), "utf8"),
	readFileSync(join(ROOT, "../../u/src/theme.css"), "utf8"),
];

/** Call-site suffixes the role helpers expand to a variable's property segment. */
const SUFFIX_ALIASES: Record<string, string> = {
	tint: "bg-tint",
	solid: "bg-solid",
	muted: "fg-muted",
	emphasis: "fg-emphasis",
	onSolid: "fg-on-solid",
	strong: "border-strong",
};

/** The tones whose `--ui-<tone>-*` variables the theme contract declares. */
const TONES = new Set(["brand", "neutral", "success", "warning", "danger"]);

/** Theme-owned color variables; component-local ones (`--ui-toast-bg`) are set by their component. */
const COLOR_TOKEN =
	/^--ui-((brand|neutral|success|warning|danger)-.+|surface-.+|chart-\d+|bg|fg|border|ring)$/;

/** Each role helper, the property a bare tone resolves to, and the pattern that finds its value. */
const HELPERS: Array<{ property: string; pattern: RegExp }> = [
	{ property: "", pattern: /\bbg\(\s*"([^"]+)"/g },
	{ property: "", pattern: /\bbg\(\s*\{[^)]*?color:\s*"([^"]+)"/g },
	{ property: "fg", pattern: /\b(?:fg|fill|stroke|caretColor)\(\s*"([^"]+)"/g },
	{ property: "border", pattern: /\b(?:border|divide|scrollbarColor)\([^)]*?"([^"]+)"/g },
	{ property: "border", pattern: /\b(?:border|borderEdge)\([^)]*?color:\s*"([^"]+)"/g },
	{ property: "ring", pattern: /\b(?:outline|outlineColor|ring)\(\s*"([^"]+)"/g },
	{ property: "ring", pattern: /\boutline\(\s*\{[^)]*?color:\s*"([^"]+)"/g },
	{ property: "bg-solid", pattern: /\baccent\(\s*"([^"]+)"/g },
];

/**
 * The variable a helper reads for `value`, or `null` when the value is not a theme tone
 * (a CSS keyword, a raw color, a palette step, a length, a side name).
 */
function resolve(value: string, property: string): string | null {
	let [tone = "", suffix = property] = value.split(".");
	if (!TONES.has(tone) && !["bg", "fg", "border", "ring"].includes(tone)) return null;
	if (!TONES.has(tone)) return `--ui-${tone}`;
	if (!suffix) return null;
	return `--ui-${tone}-${SUFFIX_ALIASES[suffix] ?? suffix}`;
}

/** Every theme color variable read by the non-test modules under `src/app` and `src/components`. */
function readTokens(): Map<string, string> {
	let tokens = new Map<string, string>();
	for (let file of globSync("{app,components}/**/*.{ts,tsx}", { cwd: ROOT })) {
		if (file.includes(".test.")) continue;
		let source = readFileSync(join(ROOT, file), "utf8");
		for (let { property, pattern } of HELPERS) {
			for (let match of source.matchAll(pattern)) {
				let token = resolve(match[1] ?? "", property);
				if (token && !tokens.has(token)) tokens.set(token, file);
			}
		}
		for (let match of source.matchAll(/var\(\s*(--ui-[a-z0-9-]+)\s*\)/g)) {
			let name = match[1] ?? "";
			if (COLOR_TOKEN.test(name) && !tokens.has(name)) tokens.set(name, file);
		}
	}
	return tokens;
}

/**
 * The variables each scheme defines: light takes the unconditional `:root` blocks, and
 * dark inherits those plus the `.dark` / `prefers-color-scheme: dark` blocks. Rules
 * scoped to anything else (a band, high contrast) apply only there, so they count for neither.
 */
function definedTokens(): { light: Set<string>; dark: Set<string> } {
	let light = new Set<string>();
	let dark = new Set<string>();
	for (let css of THEMES) {
		let stack: string[] = [];
		let text = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
		let start = 0;
		for (let index = 0; index < text.length; index++) {
			let char = text[index];
			if (char === "{") {
				stack.push(text.slice(start, index).trim());
				start = index + 1;
			} else if (char === "}") {
				stack.pop();
				start = index + 1;
			} else if (char === ";") {
				let declaration = text.slice(start, index).trim();
				start = index + 1;
				let name = /^(--ui-[a-z0-9-]+)\s*:/.exec(declaration)?.[1];
				if (!name || stack.length === 0) continue;
				let chain = stack.join(" ");
				if (stack.length === 1 && stack[0] === ":root") {
					light.add(name);
					dark.add(name);
				} else if (/\.dark\b|prefers-color-scheme:\s*dark/.test(chain)) {
					if (!/prefers-contrast|data-/.test(chain)) dark.add(name);
				}
			}
		}
	}
	return { light, dark };
}

describe("theme color tokens", () => {
	test("every color token the app and root components read is defined in light and dark", () => {
		let { light, dark } = definedTokens();
		let missing: string[] = [];

		for (let [token, file] of readTokens()) {
			if (!light.has(token)) missing.push(`${token} (light) read by ${file}`);
			if (!dark.has(token)) missing.push(`${token} (dark) read by ${file}`);
		}

		expect(missing).toEqual([]);
	});

	test("the scan finds the surfaces the components paint", () => {
		let tokens = readTokens();

		expect(tokens.has("--ui-neutral-bg-tint")).toBe(true);
		expect(tokens.has("--ui-brand-bg-solid")).toBe(true);
		expect(tokens.has("--ui-neutral-border")).toBe(true);
	});
});
