/**
 * Verifies the dev-tools path-safety guard that gates every export disk write:
 * the accept path for allow-listed `src/content`/`src/assets` targets, and every
 * rejection reason (empty, absolute, traversal, backslash, non-normalized,
 * outside-allowlist) that keeps an accepted write inside the allow-list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { ALLOWED_WRITE_PREFIXES, PathSafetyError, validateWritePath } from "./path-safety";

describe("validateWritePath accepts allow-listed relative paths", () => {
	let cases = [
		"src/content/species/alpha.json",
		"src/content/moves.json",
		"src/assets/sprites/hero.png",
		"src/assets/hero.png",
		"src/assets/nested/deep/file.bin",
	];

	for (let path of cases) {
		test(path, () => {
			let result = validateWritePath(path);
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) expect(result.data).toBe(path);
		});
	}
});

describe("validateWritePath rejects unsafe paths with a reason", () => {
	let cases: Array<[label: string, path: string, violation: PathSafetyError["violation"]]> = [
		["empty string", "", "empty"],
		["posix absolute", "/etc/passwd", "absolute"],
		["absolute inside src", "/src/content/x.json", "absolute"],
		["windows drive", "C:/Windows/System32", "absolute"],
		["parent traversal", "src/content/../../secret.txt", "traversal"],
		["leading traversal", "../src/content/x.json", "traversal"],
		["backslash traversal", "src\\content\\x.json", "backslash"],
		["current dir segment", "src/content/./x.json", "not-normalized"],
		["double slash", "src/content//x.json", "not-normalized"],
		["trailing slash", "src/content/", "not-normalized"],
		["outside allow-list", "src/game/engine.ts", "outside-allowlist"],
		["src root file", "src/index.ts", "outside-allowlist"],
		["sibling prefix trick", "src/contents/x.json", "outside-allowlist"],
	];

	for (let [label, path, violation] of cases) {
		test(`${label} -> ${violation}`, () => {
			let result = validateWritePath(path);
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(PathSafetyError);
				expect(result.error.violation).toBe(violation);
			}
		});
	}
});

test("ALLOWED_WRITE_PREFIXES all end with a trailing slash to avoid prefix aliasing", () => {
	for (let prefix of ALLOWED_WRITE_PREFIXES) {
		expect(prefix.endsWith("/")).toBe(true);
	}
});
