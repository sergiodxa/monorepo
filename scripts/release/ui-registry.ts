/**
 * The component registry `sdxc ui` copies from: one `registry/ui/<name>.json` per `@sdxc/ui`
 * component in the `@sdxc/kit` tarball, its source and test with every relative import already
 * pointed at `@sdxc/ui/*`, so a copy imports only what `@sdxc/ui` publishes and needs no network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";

import type { ModuleReference } from "@sdxc/codemod";
import type { Result } from "@sdxc/result";

import { findModuleReferences, rewriteSpecifiers } from "@sdxc/codemod";
import { failure, isFailure, success, wrap } from "@sdxc/result";
import ts from "typescript";

import { run } from "./command.js";
import { HISTORY_PACKAGE } from "./plan.js";

/** The package whose tarball carries the registry, beside the CLI that reads it. */
export const UI_REGISTRY_PACKAGE = HISTORY_PACKAGE;

/** Where the entries go inside the staged package. */
export const UI_REGISTRY_DIR = "registry/ui";

/** The components' package directory, relative to the repo root. */
export const UI_PACKAGE_DIR = "packages/ui";

/** Helper folders a component imports from; each is published as `@sdxc/ui/<folder>`. */
const HELPER_FOLDERS: ReadonlySet<string> = new Set([
	"animations",
	"behaviors",
	"mixins",
	"styles",
	"utils",
]);

/** A component module: a `.tsx` file in `src/components/` other than a test. */
const COMPONENT_FILE = /^([a-z0-9][a-z0-9-]*)\.tsx$/;

/** A release tag, `v` plus the dated version. */
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** One file of a registry entry, named as the copy is named in the app. */
export interface UIRegistryFile {
	path: string;
	content: string;
}

/** One `registry/ui/<name>.json`; keys are written in this order. */
export interface UIRegistryEntry {
	/** The component's file name without its extension, as `@sdxc/ui/<name>` imports it. */
	name: string;
	/** The latest release whose commits touched the component or its test. */
	changedIn: string;
	/** The other components it imports, which `--with-deps` copies along. */
	dependencies: string[];
	/** Every name the module exports, values and types alike, in source order. */
	exports: string[];
	source: UIRegistryFile;
	test: UIRegistryFile | null;
}

/** A component as `@sdxc/ui` holds it, before any rewrite. */
export interface ComponentSource {
	name: string;
	source: UIRegistryFile;
	test: UIRegistryFile | null;
}

/**
 * Every component in `packageDir/src/components`, sorted by name, each with its test when a
 * `<name>.test.tsx`, `<name>.test.ts`, or their `.browser.test` forms sit beside it. Tests that
 * cover no single component stay out.
 */
export async function readComponents(
	packageDir: string,
): Promise<Result<ComponentSource[], Error>> {
	let dir = join(packageDir, "src/components");
	let files = await wrap(() => readdir(dir));
	if (isFailure(files)) return files;
	let names = new Set(files.data);
	let components: ComponentSource[] = [];
	for (let file of [...names].sort((a, b) => a.localeCompare(b))) {
		let name = COMPONENT_FILE.exec(file)?.[1];
		if (name === undefined) continue;
		let source = await wrap(() => readFile(join(dir, file), "utf8"));
		if (isFailure(source)) return source;
		let testFile = [
			`${name}.test.tsx`,
			`${name}.test.ts`,
			`${name}.browser.test.tsx`,
			`${name}.browser.test.ts`,
		].find((candidate) => names.has(candidate));
		let test: UIRegistryFile | null = null;
		if (testFile !== undefined) {
			let content = await wrap(() => readFile(join(dir, testFile), "utf8"));
			if (isFailure(content)) return content;
			test = { path: testFile, content: content.data };
		}
		components.push({ name, source: { path: file, content: source.data }, test });
	}
	return success(components);
}

/**
 * The modules each helper folder's barrel re-exports, as `<folder>/<file>.js`, so a component
 * import that its folder's `@sdxc/ui/<folder>` would not provide is caught at build time.
 */
export async function readBarrels(packageDir: string): Promise<Result<Set<string>, Error>> {
	let exported = new Set<string>();
	for (let folder of HELPER_FOLDERS) {
		let file = join(packageDir, "src", folder, "index.ts");
		let source = await wrap(() => readFile(file, "utf8"));
		if (isFailure(source)) return source;
		let references = findModuleReferences(file, source.data);
		if (isFailure(references)) return references;
		for (let reference of references.data) {
			if (reference.kind === "export" && reference.specifier.startsWith("./")) {
				exported.add(posix.join(folder, reference.specifier));
			}
		}
	}
	return success(exported);
}

/**
 * The registry entry for `component`: its source and test with a sibling component pointed at
 * `@sdxc/ui/<name>` and a helper at its folder's `@sdxc/ui/<folder>`, package imports kept. A
 * relative import that neither covers is a failure naming the file and specifier.
 *
 * @param barrels - What {@link readBarrels} found, to prove each helper is importable.
 * @param components - Every component name, to tell a sibling component from anything else.
 */
export function registryEntry(
	component: ComponentSource,
	options: { barrels: Set<string>; components: Set<string>; changedIn: string },
): Result<UIRegistryEntry, Error> {
	let dependencies = new Set<string>();
	let source = rewriteFile(component.source, options, dependencies);
	if (isFailure(source)) return source;
	let test: UIRegistryFile | null = null;
	if (component.test !== null) {
		let rewritten = rewriteFile(component.test, options, new Set());
		if (isFailure(rewritten)) return rewritten;
		test = rewritten.data;
	}
	dependencies.delete(component.name);
	return success({
		name: component.name,
		changedIn: options.changedIn,
		dependencies: [...dependencies].sort((a, b) => a.localeCompare(b)),
		exports: exportedNames(component.source.path, component.source.content),
		source: source.data,
		test,
	});
}

/**
 * The names `source` exports at its top level, declarations and `export { … }` lists alike, in
 * source order without repeats, so a function and the namespace merged into it count once.
 */
export function exportedNames(filename: string, source: string): string[] {
	let file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, false);
	let names: string[] = [];
	let add = (name: string) => {
		if (!names.includes(name)) names.push(name);
	};
	for (let statement of file.statements) {
		if (ts.isExportDeclaration(statement)) {
			if (statement.moduleSpecifier !== undefined) continue;
			let clause = statement.exportClause;
			if (clause !== undefined && ts.isNamedExports(clause)) {
				for (let element of clause.elements) add(element.name.text);
			}
			continue;
		}
		if (ts.isExportAssignment(statement)) {
			add("default");
			continue;
		}
		let modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
		if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
		if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
			add("default");
		} else if (ts.isVariableStatement(statement)) {
			for (let declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) add(declaration.name.text);
			}
		} else if (
			(ts.isFunctionDeclaration(statement) ||
				ts.isClassDeclaration(statement) ||
				ts.isInterfaceDeclaration(statement) ||
				ts.isTypeAliasDeclaration(statement) ||
				ts.isEnumDeclaration(statement) ||
				ts.isModuleDeclaration(statement)) &&
			statement.name !== undefined &&
			ts.isIdentifier(statement.name)
		) {
			add(statement.name.text);
		}
	}
	return names;
}

/**
 * For each list of repo-relative paths, the release that shipped the latest commit touching any
 * of them: the earliest `v*` tag containing that commit, or `version` (the release being built)
 * when no tag does yet or the paths have never been committed.
 */
export async function releasesTouching(
	root: string,
	groups: string[][],
	version: string,
): Promise<Result<string[], Error>> {
	let directories = [...new Set(groups.flat().map((path) => posix.dirname(path)))];
	let log = await run(
		"git",
		["log", "--no-renames", "--format=%x00%H", "--name-only", "--", ...directories],
		{ cwd: root, maxBuffer: 64 * 1024 * 1024 },
	);
	if (isFailure(log)) return log;
	let latest = latestCommits(log.data.stdout);
	let releases = new Map<string, string | null>();
	let answers: string[] = [];
	for (let paths of groups) {
		let newest = newestCommit(paths, latest);
		if (newest === null) {
			answers.push(version);
			continue;
		}
		let release = releases.get(newest);
		if (release === undefined) {
			let tags = await run("git", ["tag", "--contains", newest, "--list", "v*"], { cwd: root });
			if (isFailure(tags)) return tags;
			release = earliestRelease(tags.data.stdout.split("\n"));
			releases.set(newest, release);
		}
		answers.push(release ?? version);
	}
	return success(answers);
}

/**
 * The latest commit touching each path in `git log --format=%x00%H --name-only` output, newest
 * first as git prints it, with each commit's position so two paths' commits can be compared.
 */
export function latestCommits(log: string): Map<string, { sha: string; age: number }> {
	let latest = new Map<string, { sha: string; age: number }>();
	let age = 0;
	for (let block of log.split("\0").slice(1)) {
		let [sha = "", ...paths] = block.split("\n");
		for (let path of paths) {
			if (path !== "" && !latest.has(path)) latest.set(path, { sha, age });
		}
		age += 1;
	}
	return latest;
}

/** The newest of the latest commits touching `paths`, or `null` when none was ever committed. */
function newestCommit(
	paths: string[],
	latest: Map<string, { sha: string; age: number }>,
): string | null {
	let newest: { sha: string; age: number } | null = null;
	for (let path of paths) {
		let commit = latest.get(path);
		if (commit !== undefined && (newest === null || commit.age < newest.age)) newest = commit;
	}
	return newest?.sha ?? null;
}

/** The earliest dated version among `tags`, ignoring anything that is not a release tag. */
export function earliestRelease(tags: string[]): string | null {
	let versions = tags
		.map((tag) => RELEASE_TAG.exec(tag.trim()))
		.filter((parts) => parts !== null)
		.map((parts) => [Number(parts[1]), Number(parts[2]), Number(parts[3])] as const)
		.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
	let first = versions[0];
	return first === undefined ? null : first.join(".");
}

/**
 * Every registry entry for the `@sdxc/ui` in the repo at `root`, `changedIn` read from its git
 * history against the release `version` being built.
 */
export async function buildUIRegistry(
	root: string,
	version: string,
): Promise<Result<UIRegistryEntry[], Error>> {
	let packageDir = join(root, UI_PACKAGE_DIR);
	let components = await readComponents(packageDir);
	if (isFailure(components)) return components;
	let barrels = await readBarrels(packageDir);
	if (isFailure(barrels)) return barrels;
	let groups = components.data.map((component) =>
		[component.source, component.test]
			.filter((file) => file !== null)
			.map((file) => posix.join(UI_PACKAGE_DIR, "src/components", file.path)),
	);
	let changed = await releasesTouching(root, groups, version);
	if (isFailure(changed)) return changed;
	let names = new Set(components.data.map((component) => component.name));
	let entries: UIRegistryEntry[] = [];
	for (let [index, component] of components.data.entries()) {
		let entry = registryEntry(component, {
			barrels: barrels.data,
			components: names,
			changedIn: changed.data[index] ?? version,
		});
		if (isFailure(entry)) return entry;
		entries.push(entry.data);
	}
	return success(entries);
}

/** Builds the registry and writes one JSON file per component under the staged package. */
export async function writeUIRegistry(
	stagingDir: string,
	options: { root: string; version: string },
): Promise<Result<void, Error>> {
	let entries = await buildUIRegistry(options.root, options.version);
	if (isFailure(entries)) return entries;
	let dir = join(stagingDir, UI_REGISTRY_DIR);
	return wrap(async () => {
		await mkdir(dir, { recursive: true });
		for (let entry of entries.data) {
			await writeFile(join(dir, `${entry.name}.json`), `${JSON.stringify(entry, null, "\t")}\n`);
		}
	});
}

/** One file with its relative imports pointed at `@sdxc/ui/*`, collecting the sibling components it reaches. */
function rewriteFile(
	file: UIRegistryFile,
	options: { barrels: Set<string>; components: Set<string> },
	dependencies: Set<string>,
): Result<UIRegistryFile, Error> {
	let unmapped: string[] = [];
	let rewritten = rewriteSpecifiers(file.path, file.content, (reference: ModuleReference) => {
		let target = publishedSpecifier(reference.specifier, options);
		if (target === undefined) unmapped.push(reference.specifier);
		else if (target !== null && target.component !== null) dependencies.add(target.component);
		return target?.specifier ?? null;
	});
	if (isFailure(rewritten)) return rewritten;
	if (unmapped.length > 0) {
		return failure(
			new Error(
				`${file.path} imports what @sdxc/ui does not publish: ${unmapped.join(", ")}; export it from its folder's index.ts`,
			),
		);
	}
	return success({ path: file.path, content: rewritten.data.source });
}

/**
 * Where a specifier in a component points once copied: `null` keeps it, `undefined` means
 * nothing `@sdxc/ui` publishes provides it.
 */
function publishedSpecifier(
	specifier: string,
	options: { barrels: Set<string>; components: Set<string> },
): { specifier: string; component: string | null } | null | undefined {
	if (!specifier.startsWith(".")) return null;
	let sibling = /^\.\/([a-z0-9-]+)\.js$/.exec(specifier)?.[1];
	if (sibling !== undefined && options.components.has(sibling)) {
		return { specifier: `@sdxc/ui/${sibling}`, component: sibling };
	}
	let helper = /^\.\.\/([a-z]+)\/([a-z0-9-]+\.js)$/.exec(specifier);
	if (helper !== null) {
		let [, folder = "", module = ""] = helper;
		if (HELPER_FOLDERS.has(folder) && options.barrels.has(`${folder}/${module}`)) {
			return { specifier: `@sdxc/ui/${folder}`, component: null };
		}
	}
	return undefined;
}
