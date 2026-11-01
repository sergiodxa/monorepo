/**
 * Tests the `sdxc-qr` command line through `invoke()`: the SVG on stdout, stdin as input, the
 * PNG written through `@sdxc/png` and read back by jsQR, and the exit code for every failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { decode } from "@sdxc/png";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { QR } from "./encode.js";
import jsQR from "./jsqr.js";

/** A fresh directory for files a run writes. */
function scratch(): string {
	return mkdtempSync(join(tmpdir(), "sdxc-qr-"));
}

describe("encode", () => {
	test("writes the text's symbol to stdout as an SVG document", async () => {
		let run = await invoke(cli, ["encode", "HELLO"]);
		let { d, size } = unwrap(QR.encode("HELLO")).toSVGPath();
		expect(run.code).toBe(0);
		expect(run.stderr).toBe("");
		expect(run.stdout).toBe(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 8}" height="${size * 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`,
		);
	});

	test("applies the margin and scale to the document", async () => {
		let run = await invoke(cli, ["encode", "HELLO", "--margin", "0", "--scale", "2"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain('viewBox="0 0 21 21" width="42" height="42"');
	});

	test("reads piped text without its trailing newline", async () => {
		let argument = await invoke(cli, ["encode", "https://example.com"]);
		let piped = await invoke(cli, ["encode"], { stdin: "https://example.com\n" });
		let dash = await invoke(cli, ["encode", "-"], { stdin: "https://example.com\r\n" });
		expect(piped.code).toBe(0);
		expect(piped.stdout).toBe(argument.stdout);
		expect(dash.stdout).toBe(argument.stdout);
	});

	test("passes the encoding flags to the encoder", async () => {
		let run = await invoke(cli, [
			"encode",
			"HELLO",
			"--level",
			"L",
			"--no-boost-level",
			"--min-version",
			"2",
			"--mask",
			"3",
		]);
		let { d } = unwrap(
			QR.encode("HELLO", { level: "L", boostLevel: false, minVersion: 2, mask: 3 }),
		).toSVGPath();
		expect(run.code).toBe(0);
		expect(run.stdout).toContain(`d="${d}"`);
	});

	test("writes a PNG a reader decodes back to the text", async () => {
		let cwd = scratch();
		let run = await invoke(
			cli,
			["encode", "PKG-000123", "--png", "-o", "label.png", "--level", "H"],
			{
				cwd,
			},
		);
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("");
		expect(run.stderr).toMatch(/^Wrote label\.png: version \d+-H, mask \d, \d+ modules a side\n$/);

		let image = unwrap(await decode(new Uint8Array(readFileSync(join(cwd, "label.png")))));
		let read = jsQR(image.data, image.width, image.height);
		expect(read?.data).toBe("PKG-000123");
	});

	test("writes an SVG file and reports the symbol on stderr", async () => {
		let cwd = scratch();
		let run = await invoke(cli, ["encode", "HELLO", "--output", "code.svg"], { cwd });
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("");
		let qr = unwrap(QR.encode("HELLO"));
		expect(run.stderr).toBe(
			`Wrote code.svg: version ${qr.version}-${qr.level}, mask ${qr.mask}, ${qr.size} modules a side\n`,
		);
		expect(readFileSync(join(cwd, "code.svg"), "utf8")).toMatch(/^<svg .*<\/svg>\n$/);
	});

	test("exits 1 with the bits needed when the text does not fit", async () => {
		let run = await invoke(cli, ["encode", "x".repeat(40), "--max-version", "1"]);
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toMatch(/The data needs \d+ bits; version 1-M holds 128/);
	});

	test("exits 1 when the file cannot be written", async () => {
		let run = await invoke(cli, ["encode", "HELLO", "-o", "missing/dir/code.svg"], {
			cwd: scratch(),
		});
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Could not write missing/dir/code.svg");
	});

	test.each([
		[["encode", "HELLO", "--png"], "--png writes binary data"],
		[["encode", "HELLO", "--mask", "9"], "mask must be an integer in 0–7"],
		[["encode", "HELLO", "--min-version", "41"], "minVersion and maxVersion"],
		[["encode", "HELLO", "--level", "X"], "--level"],
		[["encode", "HELLO", "--scale", "0"], "--scale"],
		[["encode"], "Pass the text to encode"],
	])("exits 2 on %j", async (argv, message) => {
		let run = await invoke(cli, argv);
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain(message);
	});
});
