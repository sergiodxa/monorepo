/**
 * Tests the Bash grammar against the shapes the fences here actually hold: a
 * `curl` split over lines, a `for` loop, and an expansion inside a string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { bash } from "./bash";

describe("bash", () => {
	test("paints a comment from the `#` to the end of the line", () => {
		expect(scan("bun install # dependencies\n", bash)).toEqual([
			{ type: "function", value: "bun" },
			{ type: "plain", value: " install " },
			{ type: "comment", value: "# dependencies" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("keeps a `#` inside a word part of the word", () => {
		expect(scan("curl https://example.com/docs#usage", bash)).toEqual([
			{ type: "function", value: "curl" },
			{ type: "plain", value: " https://example.com/docs#usage" },
		]);
	});

	test("paints a single-quoted string, newlines included", () => {
		expect(scan("echo '{\n  \"a\": 1\n}'", bash)).toEqual([
			{ type: "function", value: "echo" },
			{ type: "plain", value: " " },
			{ type: "string", value: "'{\n  \"a\": 1\n}'" },
		]);
	});

	test("leaves an expansion inside a double-quoted string a variable", () => {
		expect(scan('echo "Bearer $TOKEN"', bash)).toEqual([
			{ type: "function", value: "echo" },
			{ type: "plain", value: " " },
			{ type: "string", value: '"Bearer ' },
			{ type: "variable", value: "$TOKEN" },
			{ type: "string", value: '"' },
		]);
	});

	test("paints every form of expansion", () => {
		expect(scan('export NAME="${a}$(date)$b$1"', bash)).toEqual([
			{ type: "keyword", value: "export" },
			{ type: "plain", value: " NAME=" },
			{ type: "string", value: '"' },
			{ type: "variable", value: "${a}$(date)$b$1" },
			{ type: "string", value: '"' },
		]);
	});

	test("paints the words that structure a script", () => {
		expect(
			scan("if true; then\n  return\nfi", bash).filter((token) => token.type === "keyword"),
		).toEqual([
			{ type: "keyword", value: "if" },
			{ type: "keyword", value: "then" },
			{ type: "keyword", value: "return" },
			{ type: "keyword", value: "fi" },
		]);
	});

	test("paints a flag, and leaves the `-` inside a name alone", () => {
		expect(scan("bunx vp test run --reporter=dot remix-test", bash)).toEqual([
			{ type: "function", value: "bunx" },
			{ type: "plain", value: " vp test run " },
			{ type: "attr-name", value: "--reporter" },
			{ type: "plain", value: "=dot remix-test" },
		]);
	});

	test("paints pipes, redirections and separators", () => {
		expect(
			scan("ls | grep a > out; cat out && echo done", bash).filter(
				(token) => token.type === "operator",
			),
		).toEqual([
			{ type: "operator", value: "|" },
			{ type: "operator", value: ">" },
			{ type: "operator", value: ";" },
			{ type: "operator", value: "&&" },
		]);
	});

	test("leaves a `<name>` placeholder in a path alone", () => {
		expect(scan("cd apps/<name>", bash)).toEqual([
			{ type: "function", value: "cd" },
			{ type: "plain", value: " apps/<name>" },
		]);
	});

	test("paints a number that stands alone, and leaves the digits inside a word", () => {
		expect(scan("docker run -p 8080 cron_abc123 127.0.0.1:5432/db", bash)).toEqual([
			{ type: "function", value: "docker" },
			{ type: "plain", value: " run " },
			{ type: "attr-name", value: "-p" },
			{ type: "plain", value: " " },
			{ type: "number", value: "8080" },
			{ type: "plain", value: " cron_abc123 127.0.0.1:5432/db" },
		]);
	});

	/**
	 * From `apps/auth-saas/DEPLOYMENT.md`, which is every construct a shell fence
	 * here uses at once: a loop, a line continuation, and a quoted expansion.
	 */
	test("scans a real multi-line script, covering it exactly", () => {
		let code = [
			"cd apps/auth-saas",
			"for name in INTERNAL_SECRET SESSION_SECRET \\",
			"  CF_API_TOKEN CF_ZONE_ID CF_ACCOUNT_ID \\",
			"  POLAR_ACCESS_TOKEN POLAR_PRODUCT_ID POLAR_WEBHOOK_SECRET; do",
			'  bunx wrangler secret put "$name"',
			"done",
			"",
		].join("\n");

		let tokens = scan(code, bash);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens.filter((token) => token.type === "keyword")).toEqual([
			{ type: "keyword", value: "for" },
			{ type: "keyword", value: "in" },
			{ type: "keyword", value: "do" },
			{ type: "keyword", value: "done" },
		]);
		expect(tokens.filter((token) => token.type === "function")).toEqual([
			{ type: "function", value: "cd" },
			{ type: "function", value: "bunx" },
			{ type: "function", value: "wrangler" },
		]);
		expect(tokens).toContainEqual({ type: "variable", value: "$name" });
		expect(tokens.filter((token) => token.type === "operator")).toEqual([
			{ type: "operator", value: "\\" },
			{ type: "operator", value: "\\" },
			{ type: "operator", value: ";" },
		]);
	});

	/**
	 * From `apps/uptime/resources/docs/api/resources/cron-jobs.md`, the shape
	 * every API example takes: flags, continuations, and a JSON payload.
	 */
	test("scans a multi-line curl, covering it exactly", () => {
		let code = [
			"curl -X PUT https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123 \\",
			'  -H "Authorization: Bearer uptime_your_api_key" \\',
			"  -d '{",
			'    "gracePeriodSeconds": 900',
			"  }'",
			"",
		].join("\n");

		let tokens = scan(code, bash);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens[0]).toEqual({ type: "function", value: "curl" });
		expect(tokens.filter((token) => token.type === "attr-name")).toEqual([
			{ type: "attr-name", value: "-X" },
			{ type: "attr-name", value: "-H" },
			{ type: "attr-name", value: "-d" },
		]);
		expect(tokens).toContainEqual({
			type: "string",
			value: "'{\n    \"gracePeriodSeconds\": 900\n  }'",
		});
	});
});
