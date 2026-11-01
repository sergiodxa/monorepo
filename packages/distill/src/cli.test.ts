/**
 * Tests the `sdxc-distill` command line through `invoke()`: an article read from a file, stdin
 * and a mocked URL in every format, and the exit code for a page without an article, a refused
 * site and an unreadable file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

/** Prose long enough to score as an article. */
const PARAGRAPH =
	"<p>The harbour was quiet that morning, and the boats, tied close together, barely moved against the stone.</p>";

/** A page with a headline, a byline and an article among a template's furniture. */
const PAGE = `<!doctype html><html><head><title>A Headline</title><meta name="author" content="A Writer"></head><body><nav><a href="/">Home</a></nav><article>${PARAGRAPH.repeat(4)}<p><a href="/next">Next</a></p></article></body></html>`;

/** A page whose body a script would have built. */
const SHELL = `<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A file holding `contents` in a fresh directory, answering its path. */
function saved(contents: string): string {
	let path = join(mkdtempSync(join(tmpdir(), "sdxc-distill-")), "page.html");
	writeFileSync(path, contents);
	return path;
}

describe("extract", () => {
	test("prints the sanitized article from a file, resolving links against --url", async () => {
		let run = await invoke(cli, ["extract", saved(PAGE), "--url", "https://example.com/post"]);
		expect(run.code).toBe(0);
		expect(run.stderr).toBe("");
		expect(run.stdout).toContain("The harbour was quiet");
		expect(run.stdout).toContain('href="https://example.com/next"');
		expect(run.stdout).not.toContain("Home");
		expect(run.stdout.endsWith("\n")).toBe(true);
	});

	test("reads stdin when the source is - or absent", async () => {
		let dash = await invoke(cli, ["extract", "-"], { stdin: PAGE });
		let absent = await invoke(cli, ["extract"], { stdin: PAGE });
		expect(dash.code).toBe(0);
		expect(dash.stdout).toContain("The harbour was quiet");
		expect(absent.stdout).toBe(dash.stdout);
	});

	test("prints the title, byline and readable text with --format text", async () => {
		let run = await invoke(cli, ["extract", "--format", "text"], { stdin: PAGE });
		expect(run.code).toBe(0);
		expect(run.stdout.startsWith("A Headline\nA Writer\n\n")).toBe(true);
		expect(run.stdout).toContain("The harbour was quiet");
		expect(run.stdout).not.toContain("<p>");
	});

	test("prints every field with --json", async () => {
		let run = await invoke(cli, ["extract", "--json", "--url", "https://example.com/post"], {
			stdin: PAGE,
		});
		expect(run.code).toBe(0);
		let article = JSON.parse(run.stdout) as Record<string, unknown>;
		expect(article).toMatchObject({
			title: "A Headline",
			byline: "A Writer",
			url: "https://example.com/post",
		});
		expect(article.html).toContain("The harbour was quiet");
	});

	test("retrieves a URL under the named User-Agent", async () => {
		let agent: string | null = null;
		server.use(
			http.get("https://example.com/post", ({ request }) => {
				agent = request.headers.get("user-agent");
				return HttpResponse.html(PAGE);
			}),
		);
		let run = await invoke(cli, [
			"extract",
			"https://example.com/post",
			"--format",
			"json",
			"--user-agent",
			"Tester/1.0",
		]);
		expect(run.code).toBe(0);
		expect(agent).toBe("Tester/1.0");
		expect(JSON.parse(run.stdout)).toMatchObject({ title: "A Headline", mayCache: true });
	});

	test("exits 1 when the page carries no article", async () => {
		let run = await invoke(cli, ["extract"], { stdin: SHELL });
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("empty:");
	});

	test("exits 1 when the site refuses the request", async () => {
		server.use(
			http.get("https://example.com/private", () => new HttpResponse(null, { status: 403 })),
		);
		let run = await invoke(cli, ["extract", "https://example.com/private"]);
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("refused:");
	});

	test("exits 2 when the file cannot be read", async () => {
		let run = await invoke(cli, ["extract", "missing.html"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Cannot read missing.html");
	});

	test("exits 2 for an unknown format", async () => {
		let run = await invoke(cli, ["extract", "--format", "markdown"], { stdin: PAGE });
		expect(run.code).toBe(2);
	});
});
