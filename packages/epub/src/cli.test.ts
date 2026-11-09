/**
 * Tests for the `sdxc-epub` command line: what `build` and `check` print on each stream, the
 * files they write and the exit code they answer for a file, a book folder, stdin, a broken
 * book and downloads, driven through `invoke()` with the web answered by MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { unzipSync } from "fflate";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

/** A one-pixel PNG, enough for an image reference to resolve. */
const PIXEL = await readFile(join(import.meta.dirname, "fixtures/media/EPUB/images/pixel.png"));

/** A small TrueType font whose license allows embedding. */
const FONT = join(
	import.meta.dirname,
	"../../font/src/fixtures/RobotoSerif/RobotoSerif-Subset.ttf",
);

/** Answers downloads; every test adds the handlers it needs. */
const SERVER = setupServer();

/** The directory each test runs in. */
const FIXTURE = { dir: "" };

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => SERVER.resetHandlers());
afterAll(() => SERVER.close());

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-epub-"));
	await writeFile(join(FIXTURE.dir, "post.md"), "# Post\n\n## One\n\n![dot](dot.png)\n", "utf8");
	await writeFile(join(FIXTURE.dir, "dot.png"), PIXEL);
	await mkdir(join(FIXTURE.dir, "book/img"), { recursive: true });
	await writeFile(join(FIXTURE.dir, "book/index.md"), "---\nauthor: Ana\n---\n# Book\n", "utf8");
	await writeFile(join(FIXTURE.dir, "book/ch1.md"), "## One\n\n![dot](img/dot.png)\n", "utf8");
	await writeFile(join(FIXTURE.dir, "book/ch10.md"), "## Ten\n", "utf8");
	await writeFile(join(FIXTURE.dir, "book/ch2.md"), "## Two\n", "utf8");
	await writeFile(join(FIXTURE.dir, "book/styles.css"), "body { color: #222; }\n", "utf8");
	await writeFile(join(FIXTURE.dir, "book/img/dot.png"), PIXEL);
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** The `--json` report of a successful `build`, as far as the tests read it. */
interface BuildReport {
	output: string;
	chapters: { id: string }[];
	files: string[];
	fonts: unknown[];
	downloads: unknown[];
}

/** The `--json` report of a failed command. */
interface FailureReport {
	valid?: boolean;
	error: unknown;
}

/** Runs `sdxc-epub` in the fixture directory with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, {
		cwd: FIXTURE.dir,
		stdin,
		interactive: false,
		env: { SOURCE_DATE_EPOCH: "1790000000" },
	});
}

/** The files of an EPUB written in the fixture directory. */
async function entries(file: string): Promise<string[]> {
	return Object.keys(unzipSync(new Uint8Array(await readFile(join(FIXTURE.dir, file)))));
}

describe("sdxc-epub build", () => {
	test("writes a file's EPUB beside it and reports each step on stderr", async () => {
		let { code, stdout, stderr } = await run(["build", "post.md"]);

		expect(code).toBe(0);
		expect(stdout).toBe("");
		expect(stderr).toContain("✓ Reading images, stylesheets and fonts 1/1");
		expect(stderr).toContain("✓ Wrote post.epub: 2 pages");
		expect(await entries("post.epub")).toContain("EPUB/dot.png");
	});

	test("reads a folder's index.md, chapters in numeric order and styles.css", async () => {
		let { code, stdout, stderr } = await run(["build", "book", "--json"]);

		let report = JSON.parse(stdout) as BuildReport;
		expect(code).toBe(0);
		expect(stderr).toContain("✓ Reading book 5/5");
		expect(report.chapters.map((chapter) => chapter.id)).toEqual([
			"title-page",
			"one",
			"two",
			"ten",
		]);
		expect(report.files).toEqual(["_book/book.css", "styles.css", "img/dot.png"]);
		expect(await entries("book.epub")).toContain("EPUB/text/ten.xhtml");
	});

	test("embeds --font files and declares them", async () => {
		let { code, stdout } = await run([
			"build",
			"post.md",
			"--font",
			FONT,
			"--json",
			"-o",
			"out/post.epub",
		]);

		let report = JSON.parse(stdout) as BuildReport;
		expect(code).toBe(0);
		expect(report.output).toBe(join(FIXTURE.dir, "out/post.epub"));
		expect(report.fonts).toEqual([
			expect.objectContaining({
				family: "Roboto Serif Condensed",
				path: "_book/fonts/RobotoSerif-Subset.ttf",
			}),
		]);
	});

	test("writes the same bytes twice under SOURCE_DATE_EPOCH", async () => {
		await run(["build", "post.md", "-o", "a.epub"]);
		await run(["build", "post.md", "-o", "b.epub"]);

		expect(await readFile(join(FIXTURE.dir, "a.epub"))).toEqual(
			await readFile(join(FIXTURE.dir, "b.epub")),
		);
	});

	test("reads stdin, but needs --output to know where to write", async () => {
		let missing = await run(["build"], "# Piped\n\n## One\n");
		let given = await run(["build", "-", "-o", "piped.epub"], "# Piped\n\n## One\n");

		expect(missing.code).toBe(2);
		expect(missing.stderr).toContain("Pass --output when the book comes from stdin");
		expect(given.code).toBe(0);
		expect(await entries("piped.epub")).toContain("EPUB/text/one.xhtml");
	});

	test("exits 2 naming the file to fix, as JSON on stdout too", async () => {
		await writeFile(join(FIXTURE.dir, "broken.md"), "# B\n\n## One\n\n![x](gone.png)\n", "utf8");

		let { code, stdout, stderr } = await run(["build", "broken.md", "--json"]);

		expect(code).toBe(2);
		expect((JSON.parse(stdout) as FailureReport).error).toEqual({
			code: "missing-resource",
			path: "gone.png",
			message: '"gone.png", referenced by "broken.md", does not exist',
		});
		expect(stderr).toContain("✗ Reading images, stylesheets and fonts");
	});

	test("refuses web images unless --allow-remote, and says how to allow them", async () => {
		await writeFile(
			join(FIXTURE.dir, "web.md"),
			"# W\n\n## One\n\n![x](https://cdn.sdxc-test.com/x.png)\n",
			"utf8",
		);

		let { code, stderr } = await run(["build", "web.md"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Pass --allow-remote to download it into the book, at your own risk.");
	});

	test("downloads web images with --allow-remote, counting them as they finish", async () => {
		SERVER.use(
			http.get("https://cdn.sdxc-test.com/:name", () =>
				HttpResponse.arrayBuffer(new Uint8Array(PIXEL).buffer, {
					headers: { "content-type": "image/png" },
				}),
			),
		);
		await writeFile(
			join(FIXTURE.dir, "web.md"),
			"# W\n\n## One\n\n![x](https://cdn.sdxc-test.com/x.png)\n\n![y](https://cdn.sdxc-test.com/y)\n",
			"utf8",
		);

		let { code, stdout, stderr } = await run(["build", "web.md", "--allow-remote", "--json"]);

		expect(code).toBe(0);
		expect(stderr).toContain("✓ Downloading remote files 2/2");
		expect((JSON.parse(stdout) as BuildReport).downloads).toEqual([
			{
				url: "https://cdn.sdxc-test.com/x.png",
				path: expect.stringMatching(/^remote\/[0-9a-f]{16}\.png$/u),
				bytes: PIXEL.byteLength,
			},
			{
				url: "https://cdn.sdxc-test.com/y",
				path: expect.stringMatching(/^remote\/[0-9a-f]{16}\.png$/u),
				bytes: PIXEL.byteLength,
			},
		]);
	});

	test("exits 2 when a download fails, naming the URL", async () => {
		SERVER.use(
			http.get("https://cdn.sdxc-test.com/:name", () => new HttpResponse(null, { status: 404 })),
		);
		await writeFile(
			join(FIXTURE.dir, "web.md"),
			"# W\n\n## One\n\n![x](https://cdn.sdxc-test.com/x.png)\n",
			"utf8",
		);

		let { code, stderr } = await run(["build", "web.md", "--allow-remote"]);

		expect(code).toBe(2);
		expect(stderr).toContain("✗ Downloading remote files");
		expect(stderr).toContain(
			'Cannot read "https://cdn.sdxc-test.com/x.png": the server answered 404',
		);
	});
});

describe("sdxc-epub check", () => {
	test("reports a valid book and writes nothing", async () => {
		let { code, stderr } = await run(["check", "book"]);

		expect(code).toBe(0);
		expect(stderr).toContain("book builds a valid EPUB of 4 pages");
		await expect(readFile(join(FIXTURE.dir, "book.epub"))).rejects.toThrow();
	});

	test("exits 1 with the problem", async () => {
		await writeFile(join(FIXTURE.dir, "book/ch3.md"), "Stray text.\n\n## Three\n", "utf8");

		let { code, stdout } = await run(["check", "book", "--json"]);

		expect(code).toBe(1);
		expect(JSON.parse(stdout)).toEqual({
			valid: false,
			error: {
				code: "invalid-content",
				path: "ch3.md",
				message: '"ch3.md" has text before its first "##" chapter heading',
			},
		});
	});

	test("exits 2 for a path that does not exist", async () => {
		let { code, stderr } = await run(["check", "nowhere.md"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Cannot read nowhere.md");
	});
});
