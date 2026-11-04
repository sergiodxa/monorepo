import { mkdtemp, writeFile } from "node:fs/promises";
/**
 * Tests for the `sdxc-bench` command line: weigh output and HTTP sampling
 * against a local server, driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

describe("weigh", () => {
	test("prints minified and gzipped bytes for a tiny entry", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-bench-cli-"));
		let entry = join(root, "index.ts");
		await writeFile(entry, "export const value = 1;\n");

		let run = await invoke(cli, ["weigh", entry, "--root", root, "--json"]);
		expect(run.code).toBe(0);
		let body = JSON.parse(run.stdout) as {
			ok: boolean;
			weight: { minified: number; gzipped: number };
		};
		expect(body.ok).toBe(true);
		expect(body.weight.gzipped).toBeGreaterThan(0);
	});

	test("exits 1 when the gzipped budget is missed", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-bench-cli-"));
		let entry = join(root, "index.ts");
		await writeFile(entry, "export const value = 1;\n");

		let run = await invoke(cli, ["weigh", entry, "--root", root, "--max-gzipped", "1"]);
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("gzipped");
	});
});

describe("http", () => {
	let base = "";
	let server: ReturnType<typeof createServer>;

	beforeAll(async () => {
		server = createServer((_req, res) => {
			res.writeHead(200, { "content-type": "text/plain" });
			res.end("ok");
		});
		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", () => resolve());
		});
		let address = server.address();
		if (address === null || typeof address === "string") throw new Error("no port");
		base = `http://127.0.0.1:${address.port}/`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});

	test("samples a local URL and prints a summary", async () => {
		let run = await invoke(cli, [
			"http",
			base,
			"--requests",
			"5",
			"--concurrency",
			"2",
			"--timeout",
			"2s",
		]);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain("ok 5");
		expect(run.stdout).toContain("p95");
	});

	test("accepts a bare millisecond budget and exits 1 when it is missed", async () => {
		let run = await invoke(cli, ["http", base, "--requests", "3", "--p50", "0", "--json"]);
		expect(run.code).toBe(1);
		let body = JSON.parse(run.stdout) as { ok: boolean; error: string };
		expect(body.ok).toBe(false);
		expect(body.error).toContain("p50");
	});

	test("exits 2 for an invalid duration flag", async () => {
		let run = await invoke(cli, ["http", base, "--timeout", "fast"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Invalid duration");
	});
});
