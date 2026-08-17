/**
 * Repo-wide guard that a migration chain applies cleanly to an empty database, and that no
 * copy step reads a column its source table does not have.
 *
 * Two real bugs motivated this. `@pkg/oidc-provider`'s chain aborted outright on a fresh
 * database — `0001` created a column and `0003` added it again — which meant a newly
 * provisioned tenant Durable Object could not boot. And four Drizzle-generated table rebuilds
 * copy a renamed column by its *new* name out of the old table; with SQLite's double-quoted
 * string literals enabled, as the adapters run, those reads silently yield the column's own
 * name as text instead of failing.
 *
 * Replaying with DQS off is what makes the second class visible. The scanner is exercised
 * against fixtures before it is trusted against the repo, since a chain with no new
 * violations cannot otherwise prove it would catch one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vitest";

import type { MigrationFile } from "./migration-replay";

import { replayMigrations } from "./migration-replay";

/** Repo root, resolved from this file so the scan does not depend on the working directory. */
const ROOT = join(import.meta.dirname, "..");

/**
 * Copy steps that read a renamed column by its new name, left as they were applied.
 *
 * These are historical: every one has already run against production, and the file is the
 * record of what ran. Rewriting them would make the record a fiction while changing nothing
 * observable — the only replays that happen are against empty databases, where the copy moves
 * no rows either way.
 *
 * Two of them have no mechanical correction at all, which is the other reason they stay:
 * `chief_miss_america` turns one `subject_id` into both `team_id` and `author_id`, and
 * `plain_toro` adds four NOT NULL columns to a table that has none of them. Deriving those
 * values is a product decision, not a transcription.
 *
 * The risk they carry is a replay against a database that already has rows, which nothing in
 * this repo does. An entry here is a statement about reality, not a permanent carve-out: the
 * test below fails if one stops failing, so it is removed by whatever change fixes it.
 */
const KNOWN: { file: string; column: string }[] = [
	{ file: "20250520185608_gigantic_wendell_rand.sql", column: "subject_id" },
	{ file: "20250525233829_chief_miss_america.sql", column: "team_id" },
	{ file: "20250526083508_jazzy_sabra.sql", column: "subject_id" },
	{ file: "20250526073731_plain_toro.sql", column: "display_name" },
];

/** Whether a failure is one of the accepted historical ones. */
function isKnown(failure: { file: string; message: string }): boolean {
	return KNOWN.some(
		(known) => known.file === failure.file && failure.message.includes(`"${known.column}"`),
	);
}

/** Every directory of `.sql` migrations under `apps/` and `packages/`, repo-relative. */
function migrationDirectories(): string[] {
	let dirs = new Set<string>();
	for (let area of ["apps", "packages"]) {
		for (let file of globSync("**/migrations/*.sql", { cwd: join(ROOT, area) })) {
			if (file.includes("node_modules")) continue;
			dirs.add(`${area}/${dirname(file)}`);
		}
	}
	return [...dirs].sort();
}

/** Read one directory's migrations in the order they would be applied. */
function migrationsIn(dir: string): MigrationFile[] {
	return globSync("*.sql", { cwd: join(ROOT, dir) })
		.sort()
		.map((name) => ({ name, sql: readFileSync(join(ROOT, dir, name), "utf8") }));
}

describe("migration chains apply to an empty database", () => {
	describe("the scanner itself", () => {
		test("catches a copy step reading a column the source table lacks", () => {
			let failures = replayMigrations([
				{ name: "0001.sql", sql: "CREATE TABLE t (id TEXT, user_id TEXT);" },
				{
					name: "0002.sql",
					sql: 'CREATE TABLE __new_t (id TEXT, subject_id TEXT);--> statement-breakpoint INSERT INTO __new_t("id", "subject_id") SELECT "id", "subject_id" FROM t;',
				},
			]);

			expect(failures).toHaveLength(1);
			expect(failures[0]?.file).toBe("0002.sql");
			expect(failures[0]?.message).toContain('"subject_id"');
		});

		test("catches a column added twice", () => {
			let failures = replayMigrations([
				{ name: "0001.sql", sql: "CREATE TABLE t (id TEXT, note TEXT);" },
				{ name: "0002.sql", sql: "ALTER TABLE t ADD COLUMN note TEXT;" },
			]);

			expect(failures).toHaveLength(1);
			expect(failures[0]?.message).toContain("duplicate column name");
		});

		test("accepts a correct rename copy, and keeps replaying past a failure", () => {
			let failures = replayMigrations([
				{ name: "0001.sql", sql: "CREATE TABLE t (id TEXT, user_id TEXT);" },
				{
					name: "0002.sql",
					sql: 'CREATE TABLE __new_t (id TEXT, subject_id TEXT);--> statement-breakpoint INSERT INTO __new_t("id", "subject_id") SELECT "id", "user_id" FROM t;',
				},
				{ name: "0003.sql", sql: "SELECT nope FROM t;" },
			]);

			// The good copy passes; the deliberate error after it is still reported, which is
			// what proves one failure does not end the replay.
			expect(failures.map((failure) => failure.file)).toEqual(["0003.sql"]);
		});
	});

	test("no migration chain has an unaccepted failure", () => {
		let dirs = migrationDirectories();

		// A scan that silently found no migrations would pass this test forever.
		expect(dirs.length).toBeGreaterThan(4);

		let unexpected: string[] = [];
		for (let dir of dirs) {
			for (let failure of replayMigrations(migrationsIn(dir))) {
				if (isKnown(failure)) continue;
				unexpected.push(`${dir}/${failure.file}: ${failure.message}`);
			}
		}

		expect(unexpected).toEqual([]);
	}, 60_000);

	/**
	 * An accepted failure has to stay a statement about reality. Once one is fixed — or the
	 * migration is deleted — this fails and says which, so the entry cannot outlive its reason
	 * and quietly absorb a new violation in the same file.
	 */
	test("every accepted failure still fails", () => {
		let seen = new Set<string>();
		for (let dir of migrationDirectories()) {
			for (let failure of replayMigrations(migrationsIn(dir))) {
				if (isKnown(failure)) seen.add(failure.file);
			}
		}

		expect([...seen].sort()).toEqual([...new Set(KNOWN.map((known) => known.file))].sort());
	}, 60_000);
});
