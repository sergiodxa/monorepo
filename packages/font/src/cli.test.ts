/**
 * Tests for the `sdxc-font` command line: what `inspect` and `subset` print on each stream, the
 * files they write and the exit code they answer for TrueType, WOFF2, collection, variable and
 * color fonts, and for missing files, bad flags and a font whose license forbids subsetting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { parseFont } from "./parse-font.js";

/** The part of `inspect --json` the tests read. */
interface InspectReport {
	file: string;
	fonts: { postscriptName: string }[];
}

/** Fixture fonts copied into each test's directory, by the name the tests use. */
const FONTS = {
	"inter.ttf": "fixtures/inter-regular.ttf",
	"mada.woff2": "fixtures/Mada/Mada-VF.woff2",
	"mada.ttf": "fixtures/Mada/Mada-VF.ttf",
	"emoji.ttf": "fixtures/ss-emoji/ss-emoji-microsoft.ttf",
	"noto.ttc": "fixtures/NotoSans/NotoSans.ttc",
};

/** The directory each test runs in, holding the fonts above. */
const FIXTURE = { dir: "" };

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-font-"));
	for (let [name, source] of Object.entries(FONTS)) {
		await copyFile(new URL(source, import.meta.url), join(FIXTURE.dir, name));
	}
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-font` in the fixture directory with no terminal attached. */
function run(argv: string[]) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, interactive: false });
}

/** The font a subset command wrote to `name` in the fixture directory. */
async function written(name: string) {
	return unwrap(parseFont(await readFile(join(FIXTURE.dir, name))));
}

/**
 * Writes a copy of Inter whose `OS/2.fsType` forbids subsetting, by setting bit 8 in place.
 */
async function writeNoSubsetFont(name: string): Promise<void> {
	let bytes = new Uint8Array(await readFile(join(FIXTURE.dir, "inter.ttf")));
	let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let tables = view.getUint16(4);
	for (let index = 0; index < tables; index++) {
		let record = 12 + index * 16;
		let tag = String.fromCharCode(...bytes.subarray(record, record + 4));
		if (tag === "OS/2") view.setUint16(view.getUint32(record + 8) + 8, 0x0100);
	}
	await writeFile(join(FIXTURE.dir, name), bytes);
}

describe("sdxc-font inspect", () => {
	test("prints a font's names, metrics and glyph count", async () => {
		let { code, stdout, stderr } = await run(["inspect", "inter.ttf"]);

		expect(code).toBe(0);
		expect(stdout).toMatch(/^Inter Regular \(Inter-Regular\)\n/);
		expect(stdout).toContain("  Outlines      TrueType\n");
		expect(stdout).toContain("  Glyphs        2926\n");
		expect(stdout).toContain("  Units per em  2048\n");
		expect(stdout).toContain("  Embedding     installable\n");
		expect(stdout).not.toContain("Axes");
		expect(stderr).toBe("");
	});

	test("reports a WOFF2 variable font's axes and named instances", async () => {
		let { code, stdout } = await run(["inspect", "mada.woff2"]);

		expect(code).toBe(0);
		expect(stdout).toContain("  Axes          wght 100–1000 (default 520)\n");
		expect(stdout).toContain("  Instances     Light, Regular, SemiBold, Bold, Black\n");
	});

	test("prints the report as JSON with --json", async () => {
		let { code, stdout } = await run(["inspect", "emoji.ttf", "--json"]);
		let report = JSON.parse(stdout) as InspectReport;

		expect(code).toBe(0);
		expect(report.file).toBe("emoji.ttf");
		expect(report.fonts).toHaveLength(1);
		expect(report.fonts[0]).toMatchObject({
			postscriptName: "SSEmoji-Beta",
			outlines: "truetype",
			glyphCount: 324,
			embedding: { allowed: "preview-and-print", subsetting: true, bitmapOnly: false },
			axes: [],
			color: { tables: ["COLR", "CPAL"], palettes: 1 },
		});
	});

	test("reports every font of a collection", async () => {
		let { code, stdout } = await run(["inspect", "noto.ttc", "--json"]);
		let report = JSON.parse(stdout) as InspectReport;

		expect(code).toBe(0);
		expect(report.fonts.length).toBeGreaterThan(1);
		expect(report.fonts.map((font: { postscriptName: string }) => font.postscriptName)).toContain(
			"NotoSans-Bold",
		);
	});

	test("exits 2 for a missing file", async () => {
		let { code, stdout, stderr } = await run(["inspect", "missing.ttf"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toContain("Cannot read missing.ttf");
	});

	test("exits 2 for a file that is no font", async () => {
		await writeFile(join(FIXTURE.dir, "notes.txt"), "not a font at all", "utf8");
		let { code, stderr } = await run(["inspect", "notes.txt"]);

		expect(code).toBe(2);
		expect(stderr).toContain("notes.txt: ");
	});
});

describe("sdxc-font subset", () => {
	test("writes the glyphs of --text to --output", async () => {
		let { code, stdout, stderr } = await run([
			"subset",
			"inter.ttf",
			"--text",
			"Hello",
			"-o",
			"out.ttf",
		]);
		let font = await written("out.ttf");

		expect(code).toBe(0);
		expect(stdout).toBe("");
		expect(stderr).toMatch(/^Wrote out\.ttf: 5 glyphs, \d+ bytes\n$/);
		expect(font.glyphCount).toBe(5);
		expect(font.characterSet).toEqual([]);
	});

	test("reads --text-file, skipping line breaks and warning about characters the font lacks", async () => {
		await writeFile(join(FIXTURE.dir, "page.txt"), "Hi😀\nHi\n", "utf8");
		let { code, stderr } = await run([
			"subset",
			"inter.ttf",
			"--text-file",
			"page.txt",
			"-o",
			"out.ttf",
		]);

		expect(code).toBe(0);
		expect(stderr).toContain("No glyph for 😀 (U+1F600)\n");
		expect(stderr).toContain("Wrote out.ttf: 5 glyphs");
	});

	test("prints the glyph id mapping with --json", async () => {
		let { code, stdout } = await run([
			"subset",
			"inter.ttf",
			"--text",
			"Hi😀",
			"-o",
			"out.ttf",
			"--json",
		]);
		let report = JSON.parse(stdout) as { bytes: number };

		expect(code).toBe(0);
		expect(report).toMatchObject({
			output: "out.ttf",
			glyphCount: 5,
			characters: [
				{ character: "H", codePoint: 72, subsetGlyph: 1 },
				{ character: "i", codePoint: 105, subsetGlyph: 2 },
			],
			missing: [{ character: "😀", codePoint: 0x1f600 }],
		});
		expect(report.bytes).toBe((await readFile(join(FIXTURE.dir, "out.ttf"))).byteLength);
	});

	test("fixes a variable font at a named instance or axis values first", async () => {
		let named = await run([
			"subset",
			"mada.ttf",
			"--text",
			"Hi",
			"--instance",
			"Bold",
			"-o",
			"bold.ttf",
		]);
		let axes = await run([
			"subset",
			"mada.ttf",
			"--text",
			"Hi",
			"--instance",
			"wght=700",
			"-o",
			"w700.ttf",
		]);

		expect(named.code).toBe(0);
		expect(axes.code).toBe(0);
		expect((await written("bold.ttf")).table("gvar")).toBeNull();
		expect((await written("w700.ttf")).glyphCount).toBe(3);
	});

	test("picks a collection's font by --name", async () => {
		let { code } = await run([
			"subset",
			"noto.ttc",
			"--text",
			"Hi",
			"--name",
			"NotoSans-Bold",
			"-o",
			"out.ttf",
		]);

		expect(code).toBe(0);
		expect((await written("out.ttf")).postscriptName).toBe("NotoSans-Bold");
	});

	test("exits 2 for a --name the collection lacks", async () => {
		let { code, stderr } = await run([
			"subset",
			"noto.ttc",
			"--text",
			"Hi",
			"--name",
			"Nope",
			"-o",
			"out.ttf",
		]);

		expect(code).toBe(2);
		expect(stderr).toContain("noto.ttc holds no font named Nope");
	});

	test("exits 2 for a malformed or unknown --instance", async () => {
		let malformed = await run([
			"subset",
			"mada.ttf",
			"--text",
			"Hi",
			"--instance",
			"wght=bold",
			"-o",
			"x.ttf",
		]);
		let unknown = await run([
			"subset",
			"mada.ttf",
			"--text",
			"Hi",
			"--instance",
			"Wide",
			"-o",
			"x.ttf",
		]);

		expect(malformed.code).toBe(2);
		expect(malformed.stderr).toContain(
			'--instance expects axis=value pairs such as wght=700; got "wght=bold"',
		);
		expect(unknown.code).toBe(2);
		expect(unknown.stderr).toContain("mada.ttf: ");
	});

	test("exits 2 unless exactly one of --text and --text-file is given", async () => {
		let neither = await run(["subset", "inter.ttf", "-o", "out.ttf"]);
		let both = await run([
			"subset",
			"inter.ttf",
			"--text",
			"a",
			"--text-file",
			"a.txt",
			"-o",
			"out.ttf",
		]);

		expect(neither.code).toBe(2);
		expect(neither.stderr).toContain("exactly one of --text or --text-file");
		expect(both.code).toBe(2);
	});

	test("exits 2 for --json without --output", async () => {
		let { code, stderr } = await run(["subset", "inter.ttf", "--text", "Hi", "--json"]);

		expect(code).toBe(2);
		expect(stderr).toContain("--json needs --output");
	});

	test("exits 1 when the font's license forbids subsetting", async () => {
		await writeNoSubsetFont("locked.ttf");
		let { code, stderr } = await run(["subset", "locked.ttf", "--text", "Hi", "-o", "out.ttf"]);

		expect(code).toBe(1);
		expect(stderr).toContain("forbids subsetting");
	});
});
