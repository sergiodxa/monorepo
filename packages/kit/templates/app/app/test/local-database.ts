/**
 * A temporary project for a command test: its own migration chain and local database file,
 * installed in place of the project's own, so `db fresh`, `db seed` and `db prepare` run for
 * real and leave the rows `bun dev` serves untouched.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { vi } from "vitest";

/** Where the temporary project keeps its database, and the project's root. */
export interface TemporaryProject {
	root: string;
	databaseFile: string;
}

/**
 * Replaces `~/app/initializers/local-database` with one rooted in a new temporary folder that
 * holds `migrations`. Call it before importing the command line, which reads the replacement.
 *
 * @param migrations Each migration's SQL by file name, as `database/migrations/` would hold it.
 * @example let project = useTemporaryProject({ "0001_CreatePosts.sql": "CREATE TABLE posts (id TEXT)" });
 */
export function useTemporaryProject(
	migrations: Readonly<Record<string, string>>,
): TemporaryProject {
	let root = mkdtempSync(join(tmpdir(), "app-"));
	let directory = join(root, "database/migrations");
	mkdirSync(directory, { recursive: true });
	for (let [name, sql] of Object.entries(migrations)) writeFileSync(join(directory, name), sql);
	let databaseFile = join(root, "local.sqlite");

	vi.doMock("~/app/initializers/local-database", async (importOriginal) => {
		let original = await importOriginal<typeof import("~/app/initializers/local-database")>();
		return {
			...original,
			PROJECT_ROOT: root,
			LOCAL_DATABASE_FILE: databaseFile,
			openLocalDatabase: (filename = databaseFile) => original.openLocalDatabase(filename),
		};
	});
	return { root, databaseFile };
}
