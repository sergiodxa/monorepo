/**
 * Enforces the "Component Purity" rule from this package's `AGENTS.md`:
 * every module under `src/components/` (aside from the barrel and test
 * files) may import `css`, `attrs`, and types from `remix/ui` — never `on`,
 * `ref`, or `createMixin`, the three bindings that carry behavior. Those
 * belong in a mixin (`src/mixins/`) or behavior class (`src/behaviors/`)
 * the consumer attaches explicitly, never inside a component module itself.
 *
 * The check regex-scans each real file's own `import ... from "remix/ui"`
 * statements rather than trusting convention, so it fails the moment a
 * future component reaches for a behavior-carrying import. A handful of
 * fixture-based cases exercise the scanner itself first, since a codebase
 * with zero current violations can't otherwise prove the scanner would
 * catch one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Glob } from "bun";

/** Bindings from `remix/ui` that carry behavior and may never appear in a component module. */
const BANNED_BINDINGS = ["on", "ref", "createMixin"];

/** One binding a `remix/ui` import statement pulls in, kept alongside the statement it came from for error messages. */
interface RemixUiBinding {
	name: string;
	statement: string;
}

/**
 * Regex-scans `source` for every `import ... from "remix/ui"` statement —
 * single- or multi-line, `import type {...}` or plain, aliased with `as` or
 * not — and returns the individual bindings it names. A namespace import
 * (`import * as X from "remix/ui"`) reports back as a single `"*"` entry,
 * since whatever it accesses afterward (`X.on(...)`) can't be verified
 * statically and is treated as a violation on its own.
 */
function extractRemixUiBindings(source: string): RemixUiBinding[] {
	let bindings: RemixUiBinding[] = [];

	let namespacePattern = /import\s+\*\s+as\s+[\w$]+\s+from\s*["']remix\/ui["'];?/g;
	for (let match of source.matchAll(namespacePattern)) {
		bindings.push({ name: "*", statement: match[0].trim() });
	}

	let namedPattern = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s*from\s*["']remix\/ui["'];?/g;
	for (let match of source.matchAll(namedPattern)) {
		let statement = match[0].trim();
		// Strip comments trivia can place inside the specifier list before splitting on commas.
		let body = (match[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

		for (let rawEntry of body.split(",")) {
			let entry = rawEntry.trim();
			if (entry === "") continue;

			// Matches an optional per-specifier `type` modifier, then the imported
			// name — the binding `as`-aliased locally, not the alias itself.
			let entryMatch = entry.match(/^(?:type\s+)?([A-Za-z_$][\w$]*)/);
			let name = entryMatch?.[1];
			if (name === undefined) continue;

			bindings.push({ name, statement });
		}
	}

	return bindings;
}

/** Reduces a scan's bindings down to the ones that violate the purity rule, as human-readable strings for assertion failures. */
function findPurityViolations(source: string): string[] {
	return extractRemixUiBindings(source)
		.filter((binding) => binding.name === "*" || BANNED_BINDINGS.includes(binding.name))
		.map((binding) => `imports \`${binding.name}\` via: ${binding.statement}`);
}

describe("findPurityViolations (scanner self-check)", () => {
	test("passes a clean component-style import", () => {
		let source = `
			import type { Handle, Props as TagProps } from "remix/ui";

			import { attrs, css } from "remix/ui";
		`;

		expect(findPurityViolations(source)).toEqual([]);
	});

	test("passes a file with no remix/ui import at all", () => {
		expect(findPurityViolations('import { Button } from "./button";')).toEqual([]);
	});

	test.each(BANNED_BINDINGS)("flags a bare %s import", (banned) => {
		let source = `import { css, ${banned} } from "remix/ui";`;

		expect(findPurityViolations(source)).toEqual([`imports \`${banned}\` via: ${source}`]);
	});

	test("flags a banned import even when locally aliased", () => {
		let source = 'import { on as onMixin } from "remix/ui";';

		expect(findPurityViolations(source)).toEqual([`imports \`on\` via: ${source}`]);
	});

	test("flags a banned import inside a multi-line import block", () => {
		let source = ["import {", "\tattrs,", "\tref,", "\tcss,", '} from "remix/ui";'].join("\n");

		expect(findPurityViolations(source)).toEqual([`imports \`ref\` via: ${source}`]);
	});

	test("flags a banned import written as a per-specifier `type` import", () => {
		let source = 'import { type Handle, createMixin } from "remix/ui";';

		expect(findPurityViolations(source)).toEqual([`imports \`createMixin\` via: ${source}`]);
	});

	test("flags a namespace import as unverifiable regardless of what it accesses", () => {
		let source = 'import * as UI from "remix/ui";';

		expect(findPurityViolations(source)).toEqual([`imports \`*\` via: ${source}`]);
	});

	test("does not mistake a same-prefixed identifier for a banned binding", () => {
		// `RefObject`/`onSomething`-shaped names must not match `ref`/`on` by substring.
		let source = 'import { type RefObject, onSomethingElse } from "remix/ui";';

		expect(findPurityViolations(source)).toEqual([]);
	});

	test("reports every violation in a statement that has more than one", () => {
		let source = 'import { on, ref, css } from "remix/ui";';

		expect(findPurityViolations(source)).toEqual([
			`imports \`on\` via: ${source}`,
			`imports \`ref\` via: ${source}`,
		]);
	});
});

/** Component modules covered by the purity rule: every `.ts`/`.tsx` file under `src/components/` except the barrel and test files. */
function listComponentModules(): string[] {
	let glob = new Glob("**/*.{ts,tsx}");
	let files: string[] = [];

	for (let relative of glob.scanSync({ cwd: import.meta.dir })) {
		if (/^index\.tsx?$/.test(relative)) continue;
		if (relative.endsWith(".test.ts") || relative.endsWith(".test.tsx")) continue;
		files.push(relative);
	}

	return files.sort();
}

describe("component purity (src/components/**)", () => {
	let modules = listComponentModules();

	// Guards against the glob pattern or exclusion rules silently matching
	// nothing, which would otherwise make every test below vacuously pass.
	test("scanned the real component catalog, not an empty or filtered-out directory", () => {
		expect(modules.length).toBeGreaterThan(50);
		expect(modules).not.toContain("index.ts");
		expect(modules).not.toContain("purity.test.ts");
	});

	for (let relative of modules) {
		test(`${relative} imports only css/attrs/types from remix/ui`, () => {
			let source = readFileSync(join(import.meta.dir, relative), "utf8");

			expect(findPurityViolations(source)).toEqual([]);
		});
	}
});
