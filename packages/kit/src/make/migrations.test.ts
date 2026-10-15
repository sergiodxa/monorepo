/**
 * Migration naming: the convention a chain's files share, and the next file following it, so a
 * generated migration sorts last and reads like the ones beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { DEFAULT_CONVENTION, inferConvention, nextMigrationFile } from "./migrations.js";
import { parseName } from "./names.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project whose `database/migrations` holds an empty file per name in `files`. */
async function chain(files: string[]): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-migrations-"));
	DIRECTORIES.push(root);
	await mkdir(join(root, "database/migrations"), { recursive: true });
	await Promise.all(files.map((file) => writeFile(join(root, "database/migrations", file), "")));
	return root;
}

/** The next migration named `name` in the chain holding `files`, written at `now`. */
async function next(files: string[], name = "add-index", now = new Date()): Promise<string> {
	let root = await chain(files);
	return unwrap(await nextMigrationFile(root, "database/migrations", unwrap(parseName(name)), now));
}

describe("nextMigrationFile", () => {
	test("follows a zero-padded sequence with hyphens and kebab-case", async () => {
		expect(await next(["0001-init.sql", "0002-websub.sql", "0004-websub-lease.sql"])).toBe(
			"0005-add-index",
		);
	});

	test("follows UTC timestamps with underscores and snake_case", async () => {
		let files = ["20250520024428_brave_ser_duncan.sql", "20261008100000_domain_registration.sql"];

		let result = await next(files, "AddIndex", new Date("2026-10-15T09:08:07.006Z"));

		expect(result).toBe("20261015090807_add_index");
	});

	test("numbers a timestamp past the newest file when the clock reads earlier", async () => {
		let files = ["20261008100000_domain_registration.sql"];

		let result = await next(files, "add-index", new Date("2026-01-01T00:00:00Z"));

		expect(result).toBe("20261008100001_add_index");
	});

	test("follows a sequence with underscores and PascalCase, keeping its width", async () => {
		expect(await next(["0000_CreateTables.sql", "0014_ReleaseTopic.sql"])).toBe("0015_AddIndex");
		expect(await next(["01_Init.sql"])).toBe("02_AddIndex");
	});

	test("writes 0001_PascalCase in a missing or empty chain", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-migrations-"));
		DIRECTORIES.push(root);

		let result = await nextMigrationFile(
			root,
			"database/migrations",
			unwrap(parseName("add-index")),
		);

		expect(unwrap(result)).toBe("0001_AddIndex");
		expect(await next([])).toBe("0001_AddIndex");
	});
});

describe("inferConvention", () => {
	test("takes an undecided one-word name's case from an older file, else its separator", () => {
		expect(inferConvention(["0001-add-feeds.sql", "0002-billing.sql"]).case).toBe("kebab");
		expect(inferConvention(["0001-init.sql"]).case).toBe("kebab");
		expect(inferConvention(["0001_init.sql"]).case).toBe("snake");
	});

	test("reads the newest file's spelling and skips anything but numbered SQL files", () => {
		let files = ["README.md", "0001_Init.sql", "0002-add-tags.sql", "0003-seed.ts"];

		expect(inferConvention(files)).toEqual({
			numbering: "sequence",
			width: 4,
			separator: "-",
			case: "kebab",
		});
		expect(inferConvention(["README.md"])).toEqual(DEFAULT_CONVENTION);
	});
});
