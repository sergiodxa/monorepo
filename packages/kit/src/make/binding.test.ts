/**
 * `make secret` / `make binding` edit `cloudflare.config.ts` and `.env.example`; `make do`
 * writes a Durable Object stub and re-exports it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "../doctor/fixture.js";

import { makeBinding, makeDo, makeSecret } from "./binding.js";

afterEach(removeFixtures);

/** A silent stdout for makers under test. */
const CTX = { stdout: () => {} };

const CONFIG = `import { bindings, defineConfig } from "cf/config";
import manifest from "./package.json" with { type: "json" };
export default defineConfig({
	worker: {
		name: manifest.name,
		entrypoint: "./bootstrap/worker.ts",
		env: {
			SESSION_SECRET: bindings.secret(),
		},
	},
});
`;

describe("makeSecret", () => {
	test("declares the secret and appends .env.example", async () => {
		let context = await fixture({
			"cloudflare.config.ts": CONFIG,
			".env.example": "SESSION_SECRET=\n",
			"package.json": JSON.stringify({ name: "app" }),
		});
		unwrap(await makeSecret(CTX, context.root, { name: "API_KEY", dryRun: false, force: false }));
		let config = await readFile(join(context.root, "cloudflare.config.ts"), "utf8");
		expect(config).toContain("API_KEY: bindings.secret()");
		expect(await readFile(join(context.root, ".env.example"), "utf8")).toContain("API_KEY=");
	});
});

describe("makeBinding", () => {
	test("declares a kv binding without touching .env.example", async () => {
		let context = await fixture({
			"cloudflare.config.ts": CONFIG,
			".env.example": "SESSION_SECRET=\n",
			"package.json": JSON.stringify({ name: "app" }),
		});
		let before = await readFile(join(context.root, ".env.example"), "utf8");
		unwrap(
			await makeBinding(CTX, context.root, {
				kind: "kv",
				name: "CACHE",
				dryRun: false,
				force: false,
			}),
		);
		expect(await readFile(join(context.root, "cloudflare.config.ts"), "utf8")).toContain(
			"CACHE: bindings.kv(",
		);
		expect(await readFile(join(context.root, ".env.example"), "utf8")).toBe(before);
	});
});

describe("makeDo", () => {
	test("writes the class, export and binding", async () => {
		let context = await fixture({
			"cloudflare.config.ts": CONFIG,
			"bootstrap/worker.ts": "export default {};\n",
			"package.json": JSON.stringify({
				name: "app",
				author: "Ada Lovelace (https://ada.dev)",
			}),
		});
		unwrap(
			await makeDo(CTX, context.root, context.root, {
				name: "Feed",
				role: "model",
				dryRun: false,
				force: false,
			}),
		);
		let stub = await readFile(join(context.root, "app/models/feed.ts"), "utf8");
		expect(stub).toContain("export class FeedDO");
		expect(stub).toContain("@author [Ada Lovelace](https://ada.dev)");
		expect(stub).toContain("@copyright Ada Lovelace");
		expect(stub).not.toContain("Sergio");
		expect(await readFile(join(context.root, "bootstrap/worker.ts"), "utf8")).toContain(
			"export { FeedDO }",
		);
		let config = await readFile(join(context.root, "cloudflare.config.ts"), "utf8");
		expect(config).toContain("FeedDO: exports.durableObject");
		expect(config).toContain('exportName: "FeedDO"');
	});
});
