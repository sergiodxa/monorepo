/**
 * Verifies the dev-tools export logic: payload schema validation, path-safety
 * enforcement before any disk write, and a real `Bun.write` round-trip into an
 * allow-listed target under a temporary root. Guards that malformed payloads and
 * unsafe paths fail without ever touching disk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, isSuccess } from "@pkg/result";

import { ExportValidationError, runExport } from "./export";
import { PathSafetyError } from "./path-safety";

// runExport writes relative to the app root (src/content, src/assets). Tests
// target a dedicated scratch directory under src/content that is removed after.
let SCRATCH_DIR = "src/content/__export_test__";

afterAll(async () => {
	await rm(join(import.meta.dir, "..", "..", SCRATCH_DIR), {
		recursive: true,
		force: true,
	});
});

describe("runExport rejects invalid payloads", () => {
	let cases: Array<[label: string, payload: unknown]> = [
		["null", null],
		["missing contents", { path: "src/content/x.json" }],
		["missing path", { contents: "hi" }],
		["wrong types", { path: 1, contents: true }],
	];

	for (let [label, payload] of cases) {
		test(label, async () => {
			let result = await runExport(payload);
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(ExportValidationError);
			}
		});
	}
});

test("runExport rejects a well-formed payload with an unsafe path", async () => {
	let result = await runExport({ path: "../escape.txt", contents: "nope" });
	expect(isFailure(result)).toBe(true);
	if (isFailure(result)) {
		expect(result.error).toBeInstanceOf(PathSafetyError);
		expect((result.error as PathSafetyError).violation).toBe("traversal");
	}
});

test("runExport rejects a path outside the allow-list without writing", async () => {
	let result = await runExport({ path: "src/index.ts", contents: "malicious" });
	expect(isFailure(result)).toBe(true);
	if (isFailure(result)) {
		expect(result.error).toBeInstanceOf(PathSafetyError);
		expect((result.error as PathSafetyError).violation).toBe("outside-allowlist");
	}
});

test("runExport writes a valid payload into an allow-listed target", async () => {
	let path = `${SCRATCH_DIR}/probe.json`;
	let contents = JSON.stringify({ ok: true, at: "test" });

	let result = await runExport({ path, contents });
	expect(isSuccess(result)).toBe(true);
	if (isSuccess(result)) {
		expect(result.data.path).toBe(path);
		expect(result.data.bytesWritten).toBe(Buffer.byteLength(contents));
		let written = await Bun.file(result.data.absolutePath).text();
		expect(written).toBe(contents);
	}
});
