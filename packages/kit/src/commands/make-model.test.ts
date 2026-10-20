/**
 * `sdxc make model` and `sdxc make migration` with fields, end to end in the app template: the
 * columns land in the model, its migration and its factory alike, and `make migration` reads a
 * Rails-style name and its fields into the statements it spells, formatted as the template says.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke as invokeCLI } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
import { REGISTRY } from "../releases.js";
import { linkDependencies, materialize, projectExec, registryDocument } from "../testing.js";

/** The npm registry `create` pins `@sdxc/*` packages from: every one at 2026.10.14. */
const SERVER = setupServer(
	http.get(`${REGISTRY}/*`, ({ request }) =>
		HttpResponse.json(registryDocument(new URL(request.url).pathname.slice(1), ["2026.10.14"])),
	),
);

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterAll(() => SERVER.close());

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Runs `sdxc make <argv>` in `cwd`, without a terminal. */
function make(argv: string[], cwd: string, options: InvokeOptions = {}) {
	return invokeCLI(createSDXC(), ["make", ...argv], { cwd, interactive: false, ...options });
}

/** The one migration in the template's default chain whose name ends in `suffix`, as text. */
async function migration(root: string, suffix: string): Promise<string> {
	let folder = join(root, "database/migrations");
	let [file] = (await readdir(folder)).filter((name) => name.endsWith(suffix));
	return readFile(join(folder, file ?? ""), "utf8");
}

describe("make model with fields", () => {
	test(
		"writes each field's column, and --from-model turns them into the table",
		{ timeout: 120_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));
			let options = { exec: projectExec(root), env: { PATH: process.env.PATH ?? "" } };

			let model = await make(
				["model", "post", "title", "published_at", "bio?", "author_id", "--skip", "migration"],
				root,
				options,
			);
			unwrap(await linkDependencies(root));
			let fromModel = await make(
				["migration", "create-posts", "--from-model", "post"],
				root,
				options,
			);

			expect(model.code).toBe(0);
			let source = await readFile(join(root, "app/models/post.ts"), "utf8");
			expect(source).toContain("title: c.text(),");
			expect(source).toContain("published_at: c.integer(),");
			expect(source).toContain("bio: c.text().nullable(),");
			expect(source).toContain(
				'author_id: c.text().references("authors", "posts_author_id_fkey"),',
			);
			expect(source).not.toContain("TODO");
			expect(fromModel.stderr).toContain("✓ Formatting 1 file\n");
			expect(fromModel.code).toBe(0);
			let sql = await migration(root, "_CreatePosts.sql");
			expect(sql).toContain('"title" TEXT NOT NULL');
			expect(sql).toContain('"published_at" INTEGER NOT NULL');
			expect(sql).toContain('"bio" TEXT,');
			expect(sql).toContain(
				'CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors" ("id")',
			);
		},
	);

	test("writes the migration and the factory from the same fields as the model", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));
		await writeFile(
			join(root, "app/models/author.ts"),
			'export const authorTable = table({ name: "people", columns: { id: c.integer().primaryKey() } });\n',
		);

		let result = await make(
			["model", "post", "title", "views_count", "is_draft", "author_id", "editor_id?", "--no-test"],
			root,
			{ exec: projectExec(root) },
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Wrote database/migrations/0001_CreatePosts.sql\n");
		expect(result.stdout).toContain(
			"database/factories/post.ts leaves author_id out, since only a test knows which row it points at",
		);
		let model = await readFile(join(root, "app/models/post.ts"), "utf8");
		let sql = await migration(root, "_CreatePosts.sql");
		let factory = await readFile(join(root, "database/factories/post.ts"), "utf8");
		expect(model).toContain('name: "posts",');
		expect(model).toContain('author_id: c.integer().references("people", "posts_author_id_fkey"),');
		expect(sql).toMatch(/^-- CreatePosts: creates the posts table\.\n\nCREATE TABLE "posts" \(/);
		expect(sql).toContain('"views_count" INTEGER NOT NULL,');
		expect(sql).toContain('"is_draft" INTEGER NOT NULL,');
		expect(sql).toContain('"author_id" INTEGER NOT NULL,');
		expect(sql).toContain('"editor_id" TEXT,');
		expect(sql).toContain(
			'CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "people" ("id")',
		);
		expect(sql).toContain('"created_at" INTEGER NOT NULL,\n  "updated_at" INTEGER NOT NULL,');
		expect(factory).toContain("title: ({ sequence }) => `Title ${sequence}`,");
		expect(factory).toContain("views_count: ({ sequence }) => sequence,");
		expect(factory).toContain("is_draft: false,");
		expect(factory).toContain("editor_id: null,");
		expect(factory).not.toContain("author_id");
	});

	test("--dry-run prints the model, migration and factory and writes none", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));

		let result = await make(["model", "post", "title", "--dry-run", "--no-test"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Would write app/models/post.ts:");
		expect(result.stdout).toContain("Would write database/migrations/0001_CreatePosts.sql:");
		expect(result.stdout).toContain("Would write database/factories/post.ts:");
		expect(await readdir(join(root, "app/models"))).not.toContain("post.ts");
	});

	test("refuses a migration for a table the chain already creates, writing nothing", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));
		await writeFile(
			join(root, "database/migrations/0001_CreatePosts.sql"),
			'CREATE TABLE "posts" ("id" TEXT PRIMARY KEY);\n',
		);

		let result = await make(["model", "post", "title"], root);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('table "posts" already exists');
		expect(await readdir(join(root, "app/models"))).not.toContain("post.ts");
	});

	test("without fields, leaves the reminder to add the columns", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));

		let result = await make(["model", "post", "--dry-run", "--no-test"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("// TODO: add the columns the migration creates");
	});

	test("refuses fields when the project's model stub has nowhere to put them", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-make-model-"));
		DIRECTORIES.push(root);
		await writeFile(join(root, "package.json"), '{ "name": "blog" }\n');
		await mkdir(join(root, ".config/sdxc/stubs"), { recursive: true });
		await writeFile(join(root, ".config/sdxc/stubs/model.stub"), "export const {{Name}} = {};\n");

		let result = await make(["model", "post", "title", "--no-test"], root);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("has no {{columns}} placeholder");
		expect(await readdir(root)).not.toContain("app");
	});

	test("refuses a field it cannot write, writing nothing", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));

		let result = await make(["model", "user", "email", "password"], root);

		expect(result.code).not.toBe(0);
		expect(result.stderr).toContain("store only its hash");
		expect(await readdir(join(root, "app/models"))).not.toContain("user.ts");
	});
});
