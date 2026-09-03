/**
 * Verifies the dev-tools export logic: payload schema validation, path-safety
 * enforcement ahead of any disk write, and real text, binary, and sprite
 * round-trips into allow-listed targets. Scratch files and the real asset
 * manifest are restored, so the tree ends as it started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isFailure, isSuccess } from "@sdxc/result";
import { afterAll, describe, expect, test } from "vitest";

import {
	APP_ROOT,
	ExportValidationError,
	MANIFEST_PATH,
	runBinaryExport,
	runExport,
	runSpriteExport,
} from "./export";
import { PathSafetyError } from "./path-safety";

/** Scratch target under the allow-listed `src/content` root, removed in `afterAll`. */
let SCRATCH_DIR = "src/content/__export_test__";

/** The sprite test writes into the real asset tree and manifest, then undoes both. */
let SPRITE_NAME = "export-test-sprite";
let SPRITE_ASSET_PATH = `src/assets/${SPRITE_NAME}.png`;
let ONE_PX_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

afterAll(async () => {
	await rm(join(dirname(fileURLToPath(import.meta.url)), "..", "..", SCRATCH_DIR), {
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
		let written = await readFile(result.data.absolutePath, "utf8");
		expect(written).toBe(contents);
	}
});

describe("runBinaryExport", () => {
	test("rejects a non-base64 body without touching disk", async () => {
		let result = await runBinaryExport({
			path: `${SCRATCH_DIR}/x.bin`,
			contentsBase64: "not base64!!",
		});
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(ExportValidationError);
	});

	test("rejects an unsafe path with a path-safety error", async () => {
		let result = await runBinaryExport({ path: "../escape.bin", contentsBase64: "AAAA" });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(PathSafetyError);
	});

	test("decodes base64 and writes the exact bytes into an allow-listed target", async () => {
		let path = `${SCRATCH_DIR}/blob.bin`;
		let bytes = new Uint8Array([0, 1, 2, 255, 128]);
		let contentsBase64 = Buffer.from(bytes).toString("base64");

		let result = await runBinaryExport({ path, contentsBase64 });
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.bytesWritten).toBe(bytes.length);
			let written = new Uint8Array(await readFile(result.data.absolutePath));
			expect(Array.from(written)).toEqual(Array.from(bytes));
		}
	});
});

describe("runSpriteExport", () => {
	test("rejects an invalid sprite name before writing", async () => {
		let result = await runSpriteExport({ name: "Bad Name", pngBase64: ONE_PX_PNG_BASE64 });
		expect(isFailure(result)).toBe(true);
	});

	test("writes the PNG to src/assets and registers it in the manifest", async () => {
		let manifestFile = resolve(APP_ROOT, MANIFEST_PATH);
		let original = existsSync(manifestFile) ? await readFile(manifestFile, "utf8") : null;

		try {
			let result = await runSpriteExport({ name: SPRITE_NAME, pngBase64: ONE_PX_PNG_BASE64 });
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.id).toBe(SPRITE_NAME);
				expect(result.data.path).toBe(SPRITE_ASSET_PATH);
				expect(result.data.url).toBe(`/assets/${SPRITE_NAME}.png`);
				expect(result.data.bytesWritten).toBeGreaterThan(0);

				let pngBytes = new Uint8Array(await readFile(resolve(APP_ROOT, SPRITE_ASSET_PATH)));
				expect(Array.from(pngBytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

				let manifestText = await readFile(resolve(APP_ROOT, MANIFEST_PATH), "utf8");
				let manifest = JSON.parse(manifestText) as { images: Record<string, string> };
				expect(manifest.images[SPRITE_NAME]).toBe(`/assets/${SPRITE_NAME}.png`);
			}
		} finally {
			if (original !== null) await writeFile(resolve(APP_ROOT, MANIFEST_PATH), original);
			await rm(resolve(APP_ROOT, SPRITE_ASSET_PATH), { force: true });
		}
	});
});
