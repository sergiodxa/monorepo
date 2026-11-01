/**
 * Tests for the `sdxc-html` command line: what `query` and `outline` print on each stream and
 * the exit code they answer for a file, piped stdin, a served page, a miss and unreadable
 * input, with pages served through MSW and driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

const PAGE = `<!doctype html><html><head><title>Pricing</title></head><body>
<header><nav aria-label="Primary"><a href="/">Home</a></nav></header>
<main>
<h1>Pricing</h1>
<section aria-labelledby="plans"><h2 id="plans">Plans</h2>
<button type="submit">Sign in</button><button>Buy</button><button hidden>Secret</button>
</section>
</main>
<footer>Fine print</footer>
</body></html>`;

const URL_PAGE = "https://pages.sergiodxa.com/pricing";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The directory each test runs in, holding `page.html`. */
const FIXTURE = { dir: "" };

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-html-"));
	await writeFile(join(FIXTURE.dir, "page.html"), PAGE, "utf8");
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-html` in the fixture directory with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, stdin, interactive: false });
}

describe("sdxc-html query", () => {
	test("lists every element with the role", async () => {
		let { code, stdout, stderr } = await run(["query", "page.html", "--role", "button"]);

		expect(code).toBe(0);
		expect(stdout).toBe('#1 <button> button "Sign in"\n#2 <button> button "Buy"\n');
		expect(stderr).toBe("");
	});

	test("narrows by name and prints JSON", async () => {
		let { code, stdout } = await run([
			"query",
			"page.html",
			"--role",
			"button",
			"--name",
			"Sign in",
			"--json",
		]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual([
			{
				tag: "button",
				role: "button",
				name: "Sign in",
				text: "Sign in",
				attributes: { type: "submit" },
				disabled: false,
				position: 1,
			},
		]);
	});

	test("matches hidden elements with --include-hidden", async () => {
		let { stdout } = await run(["query", "page.html", "--role", "button", "--include-hidden"]);

		expect(stdout).toContain("#3 <button> button\n");
	});

	test("exits 1 naming what the page carries when nothing matches", async () => {
		let { code, stdout, stderr } = await run([
			"query",
			"page.html",
			"--role",
			"button",
			"--name",
			"Pay",
		]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain('No a button named "Pay" in the document. Present: Sign in, Buy.');
	});

	test("prints [] under --json when nothing matches", async () => {
		let { code, stdout } = await run(["query", "page.html", "--role", "checkbox", "--json"]);

		expect(code).toBe(1);
		expect(stdout).toBe("[]\n");
	});

	test("reads stdin when the source is absent or -", async () => {
		let absent = await run(["query", "--role", "heading"], PAGE);
		let dash = await run(["query", "-", "--role", "heading"], PAGE);

		expect(absent.code).toBe(0);
		expect(absent.stdout).toBe('#1 <h1> heading "Pricing"\n#2 <h2> heading "Plans"\n');
		expect(dash.stdout).toBe(absent.stdout);
	});

	test("fetches an http(s) URL", async () => {
		server.use(
			http.get(
				URL_PAGE,
				() => new HttpResponse(PAGE, { headers: { "content-type": "text/html" } }),
			),
		);

		let { code, stdout } = await run(["query", URL_PAGE, "--role", "link", "--name", "Home"]);

		expect(code).toBe(0);
		expect(stdout).toBe('#1 <a> link "Home"\n');
	});

	test("exits 2 when the URL answers something other than HTML", async () => {
		server.use(http.get(URL_PAGE, () => HttpResponse.json({ error: "nope" })));

		let { code, stderr } = await run(["query", URL_PAGE, "--role", "link"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Expected a text/html response");
	});

	test("exits 2 when the file cannot be read", async () => {
		let { code, stderr } = await run(["query", "missing.html", "--role", "button"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Cannot read missing.html");
	});

	test("exits 2 without --role", async () => {
		let { code } = await run(["query", "page.html"]);

		expect(code).toBe(2);
	});
});

describe("sdxc-html outline", () => {
	test("lists landmarks and headings in document order", async () => {
		let { code, stdout } = await run(["outline", "page.html"]);

		expect(code).toBe(0);
		expect(stdout).toBe(
			[
				"[banner]",
				'[navigation] "Primary"',
				"[main]",
				"h1 Pricing",
				'[region] "Plans"',
				"  h2 Plans",
				"[contentinfo]",
				"",
			].join("\n"),
		);
	});

	test("prints the entries as JSON", async () => {
		let { code, stdout } = await run(["outline", "page.html", "--json"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toContainEqual({
			kind: "heading",
			role: "heading",
			tag: "h2",
			name: "Plans",
			level: 2,
		});
	});
});
