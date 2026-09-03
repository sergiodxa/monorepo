/**
 * Tests for files and paths: that names carry an extension from the list they
 * were promised, that a path is absolute, and that a cron expression has five
 * fields each inside its own range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { en } from "../data/en";
import { createRandom } from "../random";

import { createSystemModule } from "./system";

function module(seed: string) {
	return createSystemModule(createRandom(seed), en);
}

describe("files", () => {
	test("draws extensions and types from the dataset", () => {
		let system = module("files");

		expect(en.commonFileExtensions).toContain(system.commonFileExt());
		expect(en.commonFileTypes).toContain(system.commonFileType());
		expect(en.fileExtensions).toContain(system.fileExt());
		expect(en.mimeTypes).toContain(system.mimeType());
	});

	test("names a file with an extension", () => {
		let system = module("names");

		for (let count = 0; count < 50; count++) {
			expect(system.fileName()).toMatch(/^[a-z]+_[a-z]+\.[a-z0-9]+$/);
		}
	});

	test("uses the extension it is given", () => {
		expect(module("names").commonFileName({ extension: "csv" }).endsWith(".csv")).toBe(true);
	});

	test("reads a file type off the mime type", () => {
		let system = module("types");

		for (let count = 0; count < 50; count++) {
			expect(system.fileType()).toMatch(/^[a-z]+$/);
		}
	});
});

describe("paths", () => {
	test("returns an absolute directory from the dataset", () => {
		expect(en.directoryPaths).toContain(module("paths").directoryPath());
	});

	test("joins a directory and a file name", () => {
		let path = module("paths").filePath();

		expect(path.startsWith("/")).toBe(true);
		expect(path).toMatch(/\/[a-z]+_[a-z]+\.[a-z0-9]+$/);
	});
});

describe("machine identifiers", () => {
	test("names a network interface by its schema", () => {
		let system = module("interfaces");

		expect(system.networkInterface({ type: "en", schema: "index" })).toMatch(/^eno\d$/);
		expect(system.networkInterface({ type: "wl", schema: "slot" })).toMatch(/^wls\df\d$/);
		expect(system.networkInterface({ type: "ww", schema: "pci" })).toMatch(/^wwp\ds\d$/);
		expect(system.networkInterface({ type: "en", schema: "mac" })).toMatch(/^enx[0-9a-f]{12}$/);
	});

	test("writes a three-part version", () => {
		let system = module("versions");

		for (let count = 0; count < 50; count++) {
			expect(system.semver()).toMatch(/^\d+\.\d+\.\d+$/);
		}
	});

	test("writes five cron fields, each in range", () => {
		let system = module("cron");
		let limits = [59, 23, 28, 12, 6];

		for (let count = 0; count < 100; count++) {
			let fields = system.cron().split(" ");
			expect(fields).toHaveLength(5);
			fields.forEach((field, index) => {
				if (field === "*") return;
				expect(Number(field)).toBeLessThanOrEqual(limits[index] as number);
			});
		}
	});
});
