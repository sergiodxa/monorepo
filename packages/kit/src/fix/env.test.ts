/**
 * `sdxc fix env` appends missing secret keys to `.env.example` and writes nothing under
 * `--dry-run`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "../doctor/fixture.js";

import { fixEnv } from "./env.js";

afterEach(removeFixtures);

describe("fixEnv", () => {
	test("appends missing secrets", async () => {
		let context = await fixture({
			"cloudflare.config.ts": `export default { worker: { env: { API_KEY: bindings.secret(), OTHER: bindings.kv({ id: "1" }) } } };`,
			".env.example": "SESSION_SECRET=\n",
		});
		let fixed = unwrap(await fixEnv(context.root, { dryRun: false }));
		expect(fixed.missing).toEqual(["API_KEY"]);
		expect(await readFile(join(context.root, ".env.example"), "utf8")).toContain("API_KEY=");
	});

	test("dry-run writes nothing", async () => {
		let context = await fixture({
			"cloudflare.config.ts": `export default { worker: { env: { API_KEY: bindings.secret() } } };`,
			".env.example": "",
		});
		let before = await readFile(join(context.root, ".env.example"), "utf8");
		let fixed = unwrap(await fixEnv(context.root, { dryRun: true }));
		expect(fixed.missing).toEqual(["API_KEY"]);
		expect(fixed.diff).toContain("API_KEY=");
		expect(await readFile(join(context.root, ".env.example"), "utf8")).toBe(before);
	});

	test("fails without cloudflare.config.ts", async () => {
		let context = await fixture({ ".env.example": "" });
		expect(isFailure(await fixEnv(context.root, { dryRun: false }))).toBe(true);
	});
});
