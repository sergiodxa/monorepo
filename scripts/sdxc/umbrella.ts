/**
 * Generates the `sdxc` umbrella package from the workspace: one re-export module per export
 * subpath of every exposed `@sdxc/*` package, the `exports` map pointing at them, the dependency
 * list, `config.schema.json` and `lock.schema.json`. Pure over the files it reads, so the drift test and the
 * writer share one definition of what the committed package must hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join, posix, relative } from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import ts from "typescript";

import type { ExportTarget, Package, PackageManifest } from "../release/workspace.js";

import { configJSONSchema } from "../../packages/sdxc/src/cli/config.js";
import { lockJSONSchema } from "../../packages/sdxc/src/cli/lock.js";
import { WORKSPACE_SCOPE, readPackages } from "../release/workspace.js";

/** The umbrella's directory under `packages/`, which is also its unscoped name. */
export const UMBRELLA_DIR = "sdxc";

/**
 * Packages the umbrella neither exposes nor depends on: test doubles, a test runner with its
 * own binary, and a package whose required `typescript` peer would install a toolchain into
 * every consumer.
 */
export const EXCLUDED_PACKAGES: ReadonlySet<string> = new Set([
	"@sdxc/cloudflare-mocks",
	"@sdxc/jsdoc",
	"@sdxc/spec",
]);

/**
 * Entries directly under the umbrella's `src/` that hold its handwritten command line. The
 * generator owns everything else there, and a package whose directory takes one of these names
 * is refused.
 */
export const HANDWRITTEN_SOURCES: ReadonlySet<string> = new Set(["cli", "cli.ts"]);

/** The command that rewrites the umbrella, as every generated header and failure names it. */
export const GENERATE_COMMAND = "bun run sdxc:generate";

/** Export target extensions the generator writes a re-export module for. */
const TYPESCRIPT_TARGET = /\.tsx?$/;

/** Test files and declarations, which a wildcard never exposes because no build publishes them. */
const UNPUBLISHED_FILE = /(?:\.(?:workers\.)?test\.tsx?|\.d\.ts)$/;

/** The header every generated module opens with, after the module it stands for. */
const AUTHOR_TAGS = [
	" *",
	" * @author [Sergio Xalambrí](https://sergiodxa.com)",
	" * @copyright Sergio Xalambrí 2026",
	" */",
];

/** Everything the committed umbrella derives from the workspace. */
export interface Umbrella {
	/** File contents keyed by path relative to `packages/sdxc`, sources and the schema alike. */
	files: Map<string, string>;
	/** The package's whole `exports` map. */
	exports: Record<string, ExportTarget>;
	/** Every exposed package, sorted, each a `workspace:*` dependency. */
	dependencies: string[];
}

/**
 * The umbrella for the workspace at `root`. Fails on a package directory that collides with the
 * handwritten sources, a target the generator cannot forward (a fallback array, a wildcard under
 * conditions, a file that is neither TypeScript nor CSS), and two subpaths that would write
 * different content to one file.
 */
export async function generateUmbrella(root: string): Promise<Result<Umbrella, Error>> {
	let workspace = await readPackages(root);
	if (isFailure(workspace)) return workspace;
	let exposed = workspace.data.filter(isExposed);
	let files = new Map<string, string>();
	let exports: Record<string, ExportTarget> = {};
	for (let pkg of exposed) {
		if (HANDWRITTEN_SOURCES.has(pkg.dir)) {
			return failure(
				new Error(`${pkg.name} would write over the handwritten src/${pkg.dir}; rename one`),
			);
		}
		let entries = await packageEntries(root, pkg);
		if (isFailure(entries)) return entries;
		for (let entry of entries.data) {
			for (let [path, content] of entry.files) {
				let previous = files.get(path);
				if (previous !== undefined && previous !== content) {
					return failure(new Error(`Two subpaths of ${pkg.name} would both write ${path}`));
				}
				files.set(path, content);
			}
			exports[entry.key] = entry.target;
		}
	}
	let schema = configJSONSchema();
	if (isFailure(schema)) return schema;
	files.set("config.schema.json", `${JSON.stringify(schema.data, null, "\t")}\n`);
	exports["./config.schema.json"] = "./config.schema.json";
	let lockSchema = lockJSONSchema();
	if (isFailure(lockSchema)) return lockSchema;
	files.set("lock.schema.json", `${JSON.stringify(lockSchema.data, null, "\t")}\n`);
	exports["./lock.schema.json"] = "./lock.schema.json";
	return success({ files, exports, dependencies: exposed.map((pkg) => pkg.name).sort() });
}

/**
 * The umbrella's manifest with the generated `exports` and dependencies in place. Dependencies
 * outside the scope keep their ranges; scoped ones are exactly the exposed packages.
 */
export function umbrellaManifest(manifest: PackageManifest, umbrella: Umbrella): PackageManifest {
	let dependencies: Record<string, string> = {};
	for (let [name, range] of Object.entries(manifest.dependencies ?? {})) {
		if (!name.startsWith(WORKSPACE_SCOPE)) dependencies[name] = range;
	}
	for (let name of umbrella.dependencies) dependencies[name] = "workspace:*";
	let sorted = Object.fromEntries(
		Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)),
	);
	return { ...manifest, exports: umbrella.exports, dependencies: sorted };
}

/**
 * Every way the committed umbrella in `packages/sdxc` differs from what the workspace at `root`
 * generates, one sorted line per file or manifest field, so the drift test names exactly what a
 * regeneration would change. JSON files compare by value, since the formatter owns their layout.
 */
export async function umbrellaDrift(root: string): Promise<Result<string[], Error>> {
	let umbrella = await generateUmbrella(root);
	if (isFailure(umbrella)) return umbrella;
	let packageDir = join(root, "packages", UMBRELLA_DIR);
	let problems: string[] = [];
	for (let [path, expected] of umbrella.data.files) {
		let committed = await wrap(() => readFile(join(packageDir, path), "utf8"));
		if (isFailure(committed)) {
			problems.push(`${path} is missing`);
			continue;
		}
		let same = path.endsWith(".json")
			? isDeepStrictEqual(JSON.parse(committed.data), JSON.parse(expected))
			: committed.data === expected;
		if (!same) problems.push(`${path} is out of date`);
	}
	let sources = await wrap(() => umbrellaSources(packageDir));
	if (isFailure(sources)) return sources;
	for (let path of sources.data) {
		if (!umbrella.data.files.has(path)) problems.push(`${path} backs no export subpath`);
	}
	let manifest = await wrap(
		async () =>
			JSON.parse(await readFile(join(packageDir, "package.json"), "utf8")) as PackageManifest,
	);
	if (isFailure(manifest)) return manifest;
	let expected = umbrellaManifest(manifest.data, umbrella.data);
	if (!isDeepStrictEqual(manifest.data.exports, expected.exports)) {
		problems.push("package.json exports are out of date");
	}
	if (!isDeepStrictEqual(manifest.data.dependencies, expected.dependencies)) {
		problems.push("package.json dependencies are out of date");
	}
	return success(problems.sort());
}

/**
 * Every generated file under the umbrella's `src/`, relative to `packageDir`: everything there
 * outside {@link HANDWRITTEN_SOURCES}, whether or not a subpath still backs it.
 */
export async function umbrellaSources(packageDir: string): Promise<string[]> {
	let srcDir = join(packageDir, "src");
	let entries = await readdir(srcDir, { withFileTypes: true }).catch(() => []);
	let files: string[] = [];
	for (let entry of entries) {
		if (HANDWRITTEN_SOURCES.has(entry.name)) continue;
		let path = join(srcDir, entry.name);
		files.push(...(entry.isDirectory() ? await listFiles(path) : [path]));
	}
	return files.map((file) => relative(packageDir, file).split("\\").join("/")).sort();
}

/** Whether the umbrella exposes `pkg`: public, in the scope, and off the exclusion list. */
function isExposed(pkg: Package): boolean {
	return (
		!pkg.isPrivate &&
		pkg.dir !== UMBRELLA_DIR &&
		pkg.name.startsWith(WORKSPACE_SCOPE) &&
		!EXCLUDED_PACKAGES.has(pkg.name)
	);
}

/** One `exports` entry of the umbrella with the files that back it. */
interface Entry {
	key: string;
	target: ExportTarget;
	files: Map<string, string>;
}

/** The umbrella entries for every subpath `pkg` exports, in the order its manifest lists them. */
async function packageEntries(root: string, pkg: Package): Promise<Result<Entry[], Error>> {
	let source = pkg.manifest.exports;
	if (source === undefined) return success([]);
	let subpaths: Record<string, ExportTarget> =
		typeof source === "string" || source === null || Array.isArray(source)
			? { ".": source }
			: source;
	let entries: Entry[] = [];
	for (let [subpath, target] of Object.entries(subpaths)) {
		let entry = subpath.includes("*")
			? await wildcardEntry(root, pkg, subpath, target)
			: await subpathEntry(root, pkg, subpath, target);
		if (isFailure(entry)) return entry;
		if (entry.data !== null) entries.push(entry.data);
	}
	return success(entries);
}

/**
 * A plain subpath: one module per string target, conditions kept, so `./sqlite` with `bun` and
 * `default` targets becomes `sqlite.bun.ts` and `sqlite.default.ts` under the same conditions.
 */
async function subpathEntry(
	root: string,
	pkg: Package,
	subpath: string,
	target: ExportTarget,
): Promise<Result<Entry, Error>> {
	let files = new Map<string, string>();
	let specifier = `${pkg.name}${subpath.slice(1)}`;
	let base = `src/${pkg.dir}${subpath.slice(1)}`;

	/** The umbrella target standing for `target`, reached through `conditions`. */
	async function forward(
		target: ExportTarget,
		conditions: string[],
	): Promise<Result<ExportTarget, Error>> {
		if (target === null) return success(null);
		if (Array.isArray(target)) {
			return failure(new Error(`${specifier} exports a fallback array, which sdxc cannot forward`));
		}
		if (typeof target === "object") {
			let mapped: Record<string, ExportTarget> = {};
			for (let [condition, nested] of Object.entries(target)) {
				let forwarded = await forward(nested, [...conditions, condition]);
				if (isFailure(forwarded)) return forwarded;
				mapped[condition] = forwarded.data;
			}
			return success(mapped);
		}
		let suffix = conditions.map((condition) => `.${condition}`).join("");
		if (target.endsWith(".css")) {
			let path = `${base.endsWith(".css") ? base.slice(0, -4) : base}${suffix}.css`;
			files.set(path, stylesheet(specifier));
			return success(`./${path}`);
		}
		if (TYPESCRIPT_TARGET.test(target)) {
			let hasDefault = await hasDefaultExport(join(root, "packages", pkg.dir, target));
			if (isFailure(hasDefault)) return hasDefault;
			let path = `${base}${suffix}.ts`;
			files.set(path, reexport(specifier, hasDefault.data));
			return success(`./${path}`);
		}
		return failure(
			new Error(`${specifier} exports ${target}, which is neither TypeScript nor CSS`),
		);
	}

	let forwarded = await forward(target, []);
	if (isFailure(forwarded)) return forwarded;
	return success({ key: `./${pkg.dir}${subpath.slice(1)}`, target: forwarded.data, files });
}

/**
 * A wildcard subpath, expanded against the files its target pattern matches in the package:
 * one module per match, and the pattern mapped onto them. A pattern that matches nothing has
 * no entry, since the published package would carry no file behind it.
 */
async function wildcardEntry(
	root: string,
	pkg: Package,
	subpath: string,
	target: ExportTarget,
): Promise<Result<Entry | null, Error>> {
	if (typeof target !== "string" || !TYPESCRIPT_TARGET.test(target)) {
		return failure(
			new Error(
				`${pkg.name}${subpath.slice(1)} is a wildcard over ${JSON.stringify(target)}; sdxc forwards a wildcard only to one TypeScript pattern`,
			),
		);
	}
	let star = target.indexOf("*");
	let prefix = target.slice(0, star);
	let suffix = target.slice(star + 1);
	let packageDir = join(root, "packages", pkg.dir);
	let candidates = await wrap(() => listFiles(join(packageDir, posix.dirname(`${prefix}x`))));
	if (isFailure(candidates)) return candidates;
	let files = new Map<string, string>();
	let pattern = `src/${pkg.dir}${subpath.slice(1)}`;
	for (let file of candidates.data) {
		let relative = `./${posix.relative(packageDir, file).split("\\").join("/")}`;
		if (!relative.startsWith(prefix) || !relative.endsWith(suffix)) continue;
		if (UNPUBLISHED_FILE.test(relative)) continue;
		let match = relative.slice(prefix.length, relative.length - suffix.length);
		if (match === "") continue;
		let hasDefault = await hasDefaultExport(file);
		if (isFailure(hasDefault)) return hasDefault;
		let specifier = `${pkg.name}${subpath.slice(1).replace("*", match)}`;
		files.set(`${pattern.replace("*", match)}.ts`, reexport(specifier, hasDefault.data));
	}
	if (files.size === 0) return success(null);
	return success({ key: `./${pkg.dir}${subpath.slice(1)}`, target: `./${pattern}.ts`, files });
}

/** The module standing for `specifier`, forwarding its default export when it has one. */
function reexport(specifier: string, hasDefault: boolean): string {
	let lines = [
		"/**",
		` * \`${umbrellaSpecifier(specifier)}\`, the same module as \`${specifier}\`. Generated by`,
		` * \`${GENERATE_COMMAND}\` from that package's export map.`,
		...AUTHOR_TAGS,
		"",
		`export * from "${specifier}";`,
	];
	if (hasDefault) lines.push(`export { default } from "${specifier}";`);
	return `${lines.join("\n")}\n`;
}

/** The stylesheet standing for `specifier`: one `@import` of it. */
function stylesheet(specifier: string): string {
	let lines = [
		"/**",
		` * \`${umbrellaSpecifier(specifier)}\`, the same stylesheet as \`${specifier}\`. Generated by`,
		` * \`${GENERATE_COMMAND}\` from that package's export map.`,
		...AUTHOR_TAGS,
		"",
		`@import "${specifier}";`,
	];
	return `${lines.join("\n")}\n`;
}

/** `@sdxc/<dir>/<rest>` as the umbrella spells it, `sdxc/<dir>/<rest>`. */
function umbrellaSpecifier(specifier: string): string {
	return `${UMBRELLA_DIR}/${specifier.slice(WORKSPACE_SCOPE.length)}`;
}

/**
 * Whether the module at `path` has a default export: `export default`, a declaration marked
 * `default`, or `default` named in an export clause. Read syntactically, so the answer costs one
 * parse and no type check.
 */
async function hasDefaultExport(path: string): Promise<Result<boolean, Error>> {
	let text = await wrap(() => readFile(path, "utf8"));
	if (isFailure(text)) return failure(new Error(`${path}: ${text.error.message}`));
	let source = ts.createSourceFile(path, text.data, ts.ScriptTarget.Latest, false);
	for (let statement of source.statements) {
		if (ts.isExportAssignment(statement) && statement.isExportEquals !== true) return success(true);
		if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined) {
			let clause = statement.exportClause;
			if (ts.isNamespaceExport(clause) && clause.name.text === "default") return success(true);
			if (ts.isNamedExports(clause)) {
				if (clause.elements.some((element) => element.name.text === "default"))
					return success(true);
			}
		}
		let modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
		let kinds = new Set(modifiers?.map((modifier) => modifier.kind));
		if (kinds.has(ts.SyntaxKind.ExportKeyword) && kinds.has(ts.SyntaxKind.DefaultKeyword)) {
			return success(true);
		}
	}
	return success(false);
}

/** Every file under `dir`, recursively, as absolute paths; an absent directory holds none. */
async function listFiles(dir: string): Promise<string[]> {
	let entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
	let nested = await Promise.all(
		entries.map((entry) =>
			entry.isDirectory()
				? listFiles(join(dir, entry.name))
				: Promise.resolve([join(dir, entry.name)]),
		),
	);
	return nested.flat().sort();
}
