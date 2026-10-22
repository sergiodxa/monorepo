/**
 * Repo-wide guard that only `@sdxc/uuid/v4` calls `crypto.randomUUID()`, across code, tests
 * and documentation in every app and package, so identifiers come from `@sdxc/uuid` and
 * secrets from `@sdxc/crypto`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { ALLOWED_FILES, findRandomUUIDReferences } from "./random-uuid";

/** Repo root, resolved from this file so the scan targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/**
 * Source and documentation in every workspace and in the repo's own agent skills. The
 * Cloudflare runtime types `cf typegen` writes declare the platform API, so they stay out.
 */
function scannedFiles(): string[] {
	return globSync("{apps,packages}/**/*.{ts,tsx,js,mjs,md,mdx}", { cwd: ROOT })
		.concat(globSync(".agents/skills/sdxc-*/**/*.md", { cwd: ROOT }))
		.filter((path) => !path.includes("/node_modules/") && !path.includes("/dist/"))
		.filter((path) => !path.endsWith("worker-configuration.d.ts"))
		.filter((path) => !ALLOWED_FILES.has(path));
}

describe("only @sdxc/uuid/v4 calls crypto.randomUUID()", () => {
	describe("the scanner itself", () => {
		test("reports calls, references and examples with their line", () => {
			let source = [
				"let id = crypto.randomUUID();",
				"",
				"let { randomUUID } = crypto;",
				" * @example crypto.randomUUID()",
			].join("\n");

			expect(findRandomUUIDReferences(source).map((found) => found.line)).toEqual([1, 3, 4]);
		});

		test("accepts the sanctioned generators", () => {
			let source = [
				'import { generateUUID } from "@sdxc/uuid/v4";',
				'import { randomToken } from "@sdxc/crypto";',
				"let id = generateUUID();",
				"let secret = randomToken();",
			].join("\n");

			expect(findRandomUUIDReferences(source)).toEqual([]);
		});
	});

	test("every app, package and repo skill passes", () => {
		let offenders: string[] = [];

		for (let file of scannedFiles()) {
			let source = readFileSync(join(ROOT, file), "utf8");
			for (let found of findRandomUUIDReferences(source)) {
				offenders.push(`${file}:${found.line} ${found.text}`);
			}
		}

		expect(offenders, "randomUUID outside @sdxc/uuid/v4").toEqual([]);
	});
});
