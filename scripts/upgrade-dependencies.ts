/**
 * Upgrades outdated dependencies across workspace apps and packages.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { $ } from "bun";

interface WorkspaceResult {
	directory: string;
	dependencies: Array<string>;
}

interface PackageManifest {
	name?: string;
}

let DRY_RUN = process.argv.includes("--dry-run");
let WORKSPACE_FILTERS = getWorkspaceFilters();

/**
 * Finds outdated dependencies in each workspace and upgrades them in place.
 */
async function main() {
	let rootDir = resolve(import.meta.dir, "..");
	let workspaceDirs = await getWorkspaceDirs(rootDir, WORKSPACE_FILTERS);

	process.stdout.write(`Checking ${workspaceDirs.length} workspaces\n`);

	let results = await Promise.all(workspaceDirs.map(async (directory) => scanWorkspace(directory)));
	let targets = results.filter(
		(result): result is WorkspaceResult => result.dependencies.length > 0,
	);

	if (targets.length === 0) {
		process.stdout.write("No dependencies to upgrade\n");
		return;
	}

	for (let target of targets) {
		let manifest = await readManifest(join(target.directory, "package.json"));
		let packageName = manifest.name ?? target.directory;
		let dependencies = target.dependencies.map((dependency) =>
			stripDependencyAnnotation(dependency),
		);
		process.stdout.write(
			`${DRY_RUN ? "Would upgrade" : "Upgrading"} ${dependencies.length} dependencies in ${packageName}\n`,
		);

		if (DRY_RUN) continue;

		await $`bun add ${dependencies}`.quiet().cwd(target.directory);
	}

	process.stdout.write("Done\n");
}

/**
 * Lists app and package directories that contain a package manifest.
 */
async function getWorkspaceDirs(rootDir: string, workspaceFilters: Array<string>) {
	let workspaces: Array<string> = [];

	for (let folder of ["apps", "packages"]) {
		if (workspaceFilters.length > 0 && !workspaceFilters.includes(folder)) continue;

		let directory = join(rootDir, folder);
		let entries = await readdir(directory, { withFileTypes: true });

		for (let entry of entries) {
			if (!entry.isDirectory()) continue;

			let workspace = join(directory, entry.name);
			if (!(await hasManifest(workspace))) continue;

			workspaces.push(workspace);
		}
	}

	return workspaces.sort();
}

/**
 * Reports whether a directory is a workspace.
 *
 * `bun outdated` resolves upward when a directory holds no manifest of its own, so a
 * folder like a bare design doc would otherwise report the root's outdated packages
 * and take `bun add` with it.
 */
async function hasManifest(directory: string) {
	try {
		await stat(join(directory, "package.json"));
		return true;
	} catch {
		return false;
	}
}

/**
 * Reads the requested workspace scopes from the CLI.
 */
function getWorkspaceFilters() {
	let filters: Array<string> = [];
	let args = process.argv.slice(2);

	for (let index = 0; index < args.length; index += 1) {
		if (args[index] !== "--workspace") continue;

		let value = args[index + 1];
		if (!value) continue;
		if (value === "apps" || value === "packages") filters.push(value);
	}

	return filters;
}

/**
 * Runs `bun outdated` inside a workspace and extracts upgrade targets.
 */
async function scanWorkspace(directory: string): Promise<WorkspaceResult> {
	let output = await $`bun outdated --no-progress --no-summary`
		.quiet()
		.nothrow()
		.cwd(directory)
		.text();
	let dependencies = parseOutdatedDependencies(output);

	return { directory, dependencies };
}

/**
 * Parses `bun outdated` output into a list of package names.
 */
function parseOutdatedDependencies(output: string) {
	let dependencies: Array<string> = [];
	let lines = output.split("\n");

	for (let line of lines) {
		let trimmed = line.trim();
		if (!trimmed) continue;
		let match = trimmed.match(
			/^\|\s*(?<name>[^|]+?)\s*\|\s*(?<current>[^|]+?)\s*\|\s*(?<update>[^|]+?)\s*\|\s*(?<latest>[^|]+?)\s*\|$/,
		);
		if (!match?.groups) continue;

		let packageName = match.groups.name.trim();
		let currentVersion = match.groups.current.trim();
		let updateVersion = match.groups.update.trim();
		if (packageName === "Package") continue;
		if (currentVersion === updateVersion) continue;

		dependencies.push(packageName);
	}

	return dependencies;
}

/**
 * Removes workspace annotations like `(dev)` and `(peer)` from package names.
 */
function stripDependencyAnnotation(dependency: string) {
	return dependency.replace(/ \([^)]*\)$/, "");
}

/**
 * Reads the workspace package manifest.
 */
async function readManifest(filePath: string) {
	let content = await readFile(filePath, "utf8");
	return JSON.parse(content) as PackageManifest;
}

await main();
