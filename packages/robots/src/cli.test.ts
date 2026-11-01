/**
 * Tests for the `sdxc-robots` command line: what `check` and `parse` print on each stream and the
 * exit code they answer for a fetched origin, a file, piped stdin, an origin with no robots.txt
 * and unreadable input, driven through `invoke()` with outbound HTTP mocked by MSW.
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

import type { Robots } from "./index.js";

const ROBOTS = `User-agent: *
Disallow: /private/
Allow: /private/press/

User-agent: GPTBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
`;

/** The robots.txt every fetching test asks for. */
const ROBOTS_URL = "https://example.com/robots.txt";

/** The directory each test runs in, holding `robots.txt`. */
const FIXTURE = { dir: "" };

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-robots-"));
	await writeFile(join(FIXTURE.dir, "robots.txt"), ROBOTS, "utf8");
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-robots` in the fixture directory with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, stdin, interactive: false });
}

/** Serves `ROBOTS` at the origin, recording the user-agent each retrieval sent. */
function serveRobots(): string[] {
	let agents: string[] = [];
	server.use(
		http.get(ROBOTS_URL, ({ request }) => {
			agents.push(request.headers.get("user-agent") ?? "");
			return HttpResponse.text(ROBOTS);
		}),
	);
	return agents;
}

describe("sdxc-robots check", () => {
	test("fetches the origin's file and names the rule that allows a URL", async () => {
		let agents = serveRobots();
		let { code, stdout, stderr } = await run(["check", "https://example.com/private/press/a"]);

		expect(code).toBe(0);
		expect(stdout).toBe(
			`allowed: https://example.com/private/press/a\nrule: Allow: /private/press/\nrobots: ${ROBOTS_URL}\n`,
		);
		expect(stderr).toBe("");
		expect(agents).toEqual(["sdxc-robots"]);
	});

	test("exits 1 for a disallowed URL, sending and evaluating --agent", async () => {
		let agents = serveRobots();
		let { code, stdout } = await run([
			"check",
			"https://example.com/blog",
			"--agent",
			"GPTBot/1.0",
		]);

		expect(code).toBe(1);
		expect(stdout).toContain("disallowed: https://example.com/blog\nrule: Disallow: /\n");
		expect(agents).toEqual(["GPTBot/1.0"]);
	});

	test("says no rule matches an unmatched URL", async () => {
		serveRobots();
		let { code, stdout } = await run(["check", "https://example.com/blog"]);

		expect(code).toBe(0);
		expect(stdout).toContain("allowed: https://example.com/blog\nno rule matches\n");
	});

	test("prints a stable report with --json", async () => {
		serveRobots();
		let { code, stdout } = await run(["check", "https://example.com/private/x", "--json"]);

		expect(code).toBe(1);
		expect(JSON.parse(stdout)).toEqual({
			url: "https://example.com/private/x",
			agent: "*",
			robots: ROBOTS_URL,
			allowed: false,
			rule: { allow: false, pattern: "/private/" },
			status: "parsed",
		});
	});

	test("allows everything when the origin answers 404", async () => {
		server.use(http.get(ROBOTS_URL, () => new HttpResponse(null, { status: 404 })));
		let { code, stdout } = await run(["check", "https://example.com/private/x", "--json"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toMatchObject({
			allowed: true,
			rule: null,
			status: "unavailable",
			httpStatus: 404,
		});
	});

	test("disallows everything when the origin answers 503", async () => {
		server.use(http.get(ROBOTS_URL, () => new HttpResponse(null, { status: 503 })));
		let { code, stdout } = await run(["check", "https://example.com/blog"]);

		expect(code).toBe(1);
		expect(stdout).toContain("robots.txt unreachable (HTTP 503): every path is disallowed\n");
	});

	test("reads --robots from a file and accepts a path", async () => {
		let { code, stdout } = await run(["check", "/private/x", "--robots", "robots.txt"]);

		expect(code).toBe(1);
		expect(stdout).toBe("disallowed: /private/x\nrule: Disallow: /private/\nrobots: robots.txt\n");
	});

	test("reads --robots - from stdin", async () => {
		let { code, stdout } = await run(["check", "/private/press/", "--robots", "-"], ROBOTS);

		expect(code).toBe(0);
		expect(stdout).toContain("robots: <stdin>\n");
	});

	test("exits 2 for a path without --robots, a non-URL or a missing file", async () => {
		let path = await run(["check", "/private/x"]);
		let text = await run(["check", "example.com/x"]);
		let missing = await run(["check", "/x", "--robots", "missing.txt"]);

		expect(path.code).toBe(2);
		expect(path.stderr).toContain("A path needs --robots");
		expect(text.code).toBe(2);
		expect(text.stderr).toContain("Not an http(s) URL or a /-rooted path: example.com/x");
		expect(missing.code).toBe(2);
		expect(missing.stderr).toContain("Cannot read missing.txt");
	});
});

describe("sdxc-robots parse", () => {
	test("prints a file normalized", async () => {
		let { code, stdout } = await run(["parse", "robots.txt"]);

		expect(code).toBe(0);
		expect(stdout).toContain("User-agent: *\nDisallow: /private/\nAllow: /private/press/\n");
		expect(stdout).toContain("Sitemap: https://example.com/sitemap.xml\n");
	});

	test("prints groups, rules and sitemaps with --json, reading stdin when absent", async () => {
		let { code, stdout } = await run(["parse", "--json"], ROBOTS);

		expect(code).toBe(0);
		let document = JSON.parse(stdout) as Robots.Document;
		expect(document.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
		expect(document.groups[1]).toEqual({
			userAgents: ["GPTBot"],
			rules: [{ allow: false, pattern: "/" }],
		});
	});

	test("fetches the robots.txt of any URL on an origin", async () => {
		serveRobots();
		let { code, stdout } = await run(["parse", "https://example.com/some/page", "--json"]);

		expect(code).toBe(0);
		let document = JSON.parse(stdout) as Robots.Document;
		expect(document.groups).toHaveLength(2);
	});

	test("exits 2 when the origin has no robots.txt", async () => {
		server.use(http.get(ROBOTS_URL, () => new HttpResponse(null, { status: 404 })));
		let { code, stdout, stderr } = await run(["parse", "https://example.com"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toContain("robots.txt unavailable (HTTP 404): every path is allowed");
	});

	test("notes on stderr that an empty file allows everything", async () => {
		let { code, stdout, stderr } = await run(["parse", "-"], "<html></html>\n");

		expect(code).toBe(0);
		expect(stdout).toBe("");
		expect(stderr).toBe("<stdin>: no rules, so every path is allowed\n");
	});
});
