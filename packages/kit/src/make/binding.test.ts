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
import { parseSync } from "oxc-parser";
import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "../doctor/fixture.js";

import { makeBinding, makeDo, makeSecret } from "./binding.js";

afterEach(removeFixtures);

/** A silent stdout for makers under test. */
const CTX = { stdout: () => {} };

/** A stdout that keeps what a maker printed. */
function recorder() {
	let printed: string[] = [];
	return { printed, ctx: { stdout: (text: string) => printed.push(text) } };
}

/** A project holding `config` as its `cloudflare.config.ts`. */
async function project(config = CONFIG) {
	return fixture({
		"cloudflare.config.ts": config,
		".env.example": "SESSION_SECRET=\n",
		"bootstrap/worker.ts": "export default {};\n",
		"package.json": JSON.stringify({ name: "app" }),
	});
}

/** Declares a `kind` binding named `name` in `root` and answers the config it leaves. */
async function declare(
	root: string,
	kind: Parameters<typeof makeBinding>[2]["kind"],
	name: string,
	force = false,
) {
	unwrap(await makeBinding(CTX, root, { kind, name, dryRun: false, force }));
	return readFile(join(root, "cloudflare.config.ts"), "utf8");
}

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

describe("makeBinding's declarations", () => {
	test("name a bucket in kebab case, which R2 accepts", async () => {
		let context = await project();
		expect(await declare(context.root, "r2", "USER_UPLOADS")).toContain(
			'USER_UPLOADS: bindings.r2({ name: "user-uploads" })',
		);
	});

	test("give a database, a queue and a rate limit names of their own", async () => {
		let context = await project(
			CONFIG.replace(
				"SESSION_SECRET: bindings.secret(),",
				'SESSION_SECRET: bindings.secret(),\n\t\t\tRATE_LIMITER: bindings.rateLimit({ namespace: "1001", simple: { limit: 100, period: 60 } }),',
			),
		);
		await declare(context.root, "d1", "SEARCH");
		await declare(context.root, "queue", "EVENTS");
		let config = await declare(context.root, "rateLimit", "LOGINS");

		expect(config).toContain("SEARCH: bindings.d1({ name: `${manifest.name}-search`");
		expect(config).toContain("EVENTS: bindings.queue({ name: `${manifest.name}-events` })");
		expect(config).toContain('LOGINS: bindings.rateLimit({ namespace: "1002"');
	});

	test("write a Durable Object binding that parses", async () => {
		let context = await project();
		let config = await declare(context.root, "durableObject", "SEARCH_INDEX");

		expect(config).toContain(
			'SEARCH_INDEX: bindings.durableObject({ worker: manifest.name, exportName: "SearchIndexDO" })',
		);
		expect(parseSync("cloudflare.config.ts", config).errors).toEqual([]);
	});

	test("--force replaces a declaration where it stands, adding no blank line", async () => {
		let config = CONFIG.replace(
			"SESSION_SECRET: bindings.secret(),",
			'SESSION_SECRET: bindings.secret(),\n\t\t\tCACHE: bindings.kv({ id: "1" }),\n\t\t\tFILES: bindings.r2({ name: "files" }),',
		);
		let context = await project(config);

		await declare(context.root, "r2", "CACHE", true);
		let after = await declare(context.root, "r2", "CACHE", true);

		expect(after).toBe(
			config.replace('CACHE: bindings.kv({ id: "1" })', 'CACHE: bindings.r2({ name: "cache" })'),
		);
	});

	test("prints what it edited as every kind does, and answers it for the formatter", async () => {
		let context = await project();
		let { printed, ctx } = recorder();

		let made = unwrap(
			await makeSecret(ctx, context.root, { name: "API_KEY", dryRun: false, force: false }),
		);

		expect(printed).toEqual(["Edited cloudflare.config.ts\n", "Edited .env.example\n"]);
		expect(made).toEqual({
			changed: ["cloudflare.config.ts", ".env.example"],
			notes: ["Next: sdxc run typegen\n"],
		});
	});
});

describe("makeDo", () => {
	test("strips a trailing do in any case before adding DO once", async () => {
		let context = await project();
		unwrap(
			await makeDo(CTX, context.root, {
				name: "feed-do",
				role: "model",
				dryRun: false,
				force: false,
			}),
		);
		unwrap(
			await makeDo(CTX, context.root, {
				name: "undo",
				role: "service",
				dryRun: false,
				force: false,
			}),
		);

		let config = await readFile(join(context.root, "cloudflare.config.ts"), "utf8");
		expect(await readFile(join(context.root, "app/models/feed-do.ts"), "utf8")).toContain(
			"export class FeedDO ",
		);
		expect(config).toContain(
			'FEED: bindings.durableObject({ worker: manifest.name, exportName: "FeedDO" })',
		);
		expect(config).toContain(
			'UNDO: bindings.durableObject({ worker: manifest.name, exportName: "UndoDO" })',
		);
	});

	test("writes a fetch that overrides the base class and reads no unused argument", async () => {
		let context = await project();
		let { printed, ctx } = recorder();

		let made = unwrap(
			await makeDo(ctx, context.root, { name: "feed", role: "model", dryRun: false, force: false }),
		);

		let stub = await readFile(join(context.root, "app/models/feed.ts"), "utf8");
		expect(stub).toContain("override fetch(): Response {");
		expect(stub).not.toContain("request: Request");
		expect(printed).toEqual([
			"Wrote app/models/feed.ts\n",
			"Edited cloudflare.config.ts\n",
			"Edited bootstrap/worker.ts\n",
		]);
		expect(made.changed).toEqual([
			"app/models/feed.ts",
			"cloudflare.config.ts",
			"bootstrap/worker.ts",
		]);
	});

	test("--force replaces the class and keeps its binding where it stands", async () => {
		let context = await project();
		unwrap(
			await makeDo(CTX, context.root, { name: "feed", role: "model", dryRun: false, force: false }),
		);
		let before = await readFile(join(context.root, "cloudflare.config.ts"), "utf8");
		let { printed, ctx } = recorder();

		unwrap(
			await makeDo(ctx, context.root, { name: "feed", role: "model", dryRun: false, force: true }),
		);

		expect(await readFile(join(context.root, "cloudflare.config.ts"), "utf8")).toBe(before);
		expect(printed[0]).toBe("Replaced app/models/feed.ts\n");
	});

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
			await makeDo(CTX, context.root, {
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
