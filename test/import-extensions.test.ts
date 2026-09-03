/**
 * Repo-wide guard that every relative import inside `packages/*​/src` carries its `.js`
 * extension, tests included. Emitted JavaScript keeps specifiers verbatim, so an
 * extensionless one only fails once a published package runs under Node.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { findExtensionlessSpecifiers, hasExtension, isRelative } from "./import-extensions";

/** Repo root, resolved from this file so the scan targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/** Every TypeScript source under a package's `src/`, skipping installed dependencies. */
function packageSourceFiles(): string[] {
	return globSync("packages/*/src/**/*.{ts,tsx}", { cwd: ROOT }).filter(
		(path) => !path.includes("/node_modules/"),
	);
}

describe("relative imports inside packages carry a .js extension", () => {
	describe("the scanner itself", () => {
		test("reports static, re-exported, dynamic, side-effect and mocked specifiers", () => {
			let source = [
				'import { a } from "./a";',
				'export * from "../b";',
				'export { c } from "./c/index";',
				'import "./d";',
				'let e = await import("./e");',
				'vi.mock("./f", () => ({}));',
			].join("\n");

			expect(findExtensionlessSpecifiers(source).map((found) => found.specifier)).toEqual([
				"./a",
				"../b",
				"./c/index",
				"./d",
				"./e",
				"./f",
			]);
		});

		test("accepts extensions, queries on extensions, and package specifiers", () => {
			let source = [
				'import { a } from "./a.js";',
				'import raw from "../schema.sql?raw";',
				'import styles from "./theme.css";',
				'import { b } from "@sdxc/result";',
				'import { c } from "remix/ui";',
				'import { d } from "node:fs";',
			].join("\n");

			expect(findExtensionlessSpecifiers(source)).toEqual([]);
		});

		test("skips comment lines, where an example quotes a specifier", () => {
			let source = [
				"/**",
				" * @example",
				' * import { a } from "./a";',
				" */",
				'// from "./b"',
			].join("\n");

			expect(findExtensionlessSpecifiers(source)).toEqual([]);
		});

		test("reports the line each specifier sits on", () => {
			let source = ['import { a } from "./a.js";', "", 'import { b } from "./b";'].join("\n");

			expect(findExtensionlessSpecifiers(source)).toEqual([{ line: 3, specifier: "./b" }]);
		});

		test("classifies relative specifiers and extensions", () => {
			expect(isRelative("./a")).toBe(true);
			expect(isRelative("../a")).toBe(true);
			expect(isRelative("..")).toBe(true);
			expect(isRelative("remix/ui")).toBe(false);
			expect(hasExtension("./a.js")).toBe(true);
			expect(hasExtension("./a.d.ts")).toBe(true);
			expect(hasExtension("./a")).toBe(false);
			expect(hasExtension("./a.b/c")).toBe(false);
			expect(hasExtension("..")).toBe(false);
		});
	});

	test("every package source file passes", () => {
		let offenders: string[] = [];

		for (let file of packageSourceFiles()) {
			let source = readFileSync(join(ROOT, file), "utf8");
			for (let found of findExtensionlessSpecifiers(source)) {
				offenders.push(`${file}:${found.line} ${found.specifier}`);
			}
		}

		expect(offenders, "relative specifiers without a .js extension").toEqual([]);
	});
});
