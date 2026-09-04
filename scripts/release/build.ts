/**
 * Builds one package into a staging directory the way npm will see it: `src/` compiled to
 * `dist/` with declarations through the TypeScript compiler API on the package's own
 * tsconfig, the documents and verbatim export targets copied beside it, and the publish
 * manifest written last. Two checks then prove the staged tree is self-contained.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	access,
	copyFile,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";
import ts from "typescript";

import type { Package, PackageManifest } from "./workspace.js";

import { nonTypeScriptTargets } from "./manifest.js";
import { collectExportTargets } from "./workspace.js";

/** Test files under `src/`, left out of the program so nothing test-only reaches `dist/`. */
const TEST_FILE = /\.(?:workers\.)?test\.tsx?$/;

/** The emitted files whose specifiers a consumer's loader resolves. */
const EMITTED_FILE = /\.(?:js|d\.ts)$/;

/** Every position a module specifier takes in emitted output: imports, re-exports, `import()`. */
const SPECIFIER_PATTERNS = [
	/\bfrom\s+["']([^"']+)["']/g,
	/^\s*import\s+["']([^"']+)["']/gm,
	/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

/** Documents npm renders on the package page, copied when the package has them. */
const DOCUMENTS = ["README.md", "LICENSE.md"];

const FORMAT_HOST: ts.FormatDiagnosticsHost = {
	getCanonicalFileName: (fileName) => fileName,
	getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
	getNewLine: () => ts.sys.newLine,
};

/**
 * Stages `pkg` into `stagingDir`, replacing whatever was there: compiles `src/` into `dist/`,
 * copies the documents and the non-TypeScript export targets at their relative paths, writes
 * `manifest` as `package.json`, then checks the result is self-contained.
 */
export async function buildPackage(
	pkg: Package,
	root: string,
	stagingDir: string,
	manifest: PackageManifest,
): Promise<Result<void, Error>> {
	let packageDir = join(root, "packages", pkg.dir);
	let prepared = await wrap(async () => {
		await rm(stagingDir, { recursive: true, force: true });
		await mkdir(stagingDir, { recursive: true });
	});
	if (isFailure(prepared)) return prepared;
	let emitted = emitDist(packageDir, join(stagingDir, "dist"));
	if (isFailure(emitted)) return emitted;
	let copies = await Promise.all([
		...DOCUMENTS.map((document) =>
			copyIfPresent(join(packageDir, document), join(stagingDir, document)),
		),
		...nonTypeScriptTargets(pkg.manifest).map((target) =>
			copyTarget(pkg.name, packageDir, stagingDir, target),
		),
	]);
	for (let copy of copies) {
		if (isFailure(copy)) return copy;
	}
	let written = await wrap(() =>
		writeFile(join(stagingDir, "package.json"), `${JSON.stringify(manifest, null, "\t")}\n`),
	);
	if (isFailure(written)) return written;
	let specifiers = await checkDistSpecifiers(stagingDir);
	if (isFailure(specifiers)) return specifiers;
	return checkExportTargets(stagingDir, manifest);
}

/** A fresh directory under the OS temp dir, so a run never leaves build output inside the repo. */
export async function createStagingRoot(): Promise<Result<string, Error>> {
	return wrap(() => mkdtemp(join(tmpdir(), "sdxc-release-")));
}

/**
 * Fails when an emitted `.js` or `.d.ts` file imports through `/src/` or resolves outside
 * `dist/`, either of which means the build reached into the workspace for what a dependency
 * should provide.
 */
export async function checkDistSpecifiers(stagingDir: string): Promise<Result<void, Error>> {
	let distDir = join(stagingDir, "dist");
	let sources = await wrap(() => emittedSources(distDir));
	if (isFailure(sources)) return sources;
	let offenders: string[] = [];
	for (let [file, source] of sources.data) {
		for (let specifier of specifiersIn(source)) {
			if (escapesDist(specifier, file, distDir)) {
				offenders.push(`${relative(stagingDir, file)}: ${specifier}`);
			}
		}
	}
	if (offenders.length > 0) {
		return failure(new Error(`Emitted files reach outside dist/:\n${offenders.join("\n")}`));
	}
	return success(undefined);
}

/**
 * Fails when a target of the rewritten manifest has no file in the staging tree (for a `*`
 * pattern, no directory before the `*`).
 */
export async function checkExportTargets(
	stagingDir: string,
	manifest: PackageManifest,
): Promise<Result<void, Error>> {
	let targets = collectExportTargets(manifest);
	let present = await Promise.all(
		targets.map((target) => exists(join(stagingDir, patternBase(target)))),
	);
	let missing = targets.filter((_, index) => present[index] !== true);
	if (missing.length > 0) {
		return failure(
			new Error(
				`${manifest.name} exports targets missing from the staged package: ${missing.join(", ")}`,
			),
		);
	}
	return success(undefined);
}

/**
 * Compiles the package through its own tsconfig so the root's `types`, `paths` and `lib`
 * resolve exactly as they do for `bun check`; only the emit-related options are overridden.
 * Every error diagnostic, from reading the config to emitting, is the failure.
 */
function emitDist(packageDir: string, outDir: string): Result<void, Error> {
	let configPath = join(packageDir, "tsconfig.json");
	let unreadable: ts.Diagnostic | undefined;
	let parsed = ts.getParsedCommandLineOfConfigFile(
		configPath,
		{
			noEmit: false,
			declaration: true,
			declarationMap: false,
			sourceMap: false,
			outDir,
			rootDir: join(packageDir, "src"),
			incremental: false,
		},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic(diagnostic) {
				unreadable = diagnostic;
			},
		},
	);
	if (unreadable !== undefined) {
		return failure(
			new Error(ts.flattenDiagnosticMessageText(unreadable.messageText, ts.sys.newLine)),
		);
	}
	if (parsed === undefined) return failure(new Error(`${configPath} could not be read`));
	let program = ts.createProgram({
		rootNames: parsed.fileNames.filter((file) => !TEST_FILE.test(file)),
		options: parsed.options,
		projectReferences: parsed.projectReferences,
		configFileParsingDiagnostics: parsed.errors,
	});
	let diagnostics = [...ts.getPreEmitDiagnostics(program), ...program.emit().diagnostics].filter(
		(diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
	);
	if (diagnostics.length > 0) {
		return failure(new Error(ts.formatDiagnostics(diagnostics, FORMAT_HOST)));
	}
	return success(undefined);
}

/** Every emitted `.js` and `.d.ts` file under `distDir` with its text, keyed by path. */
async function emittedSources(distDir: string): Promise<Map<string, string>> {
	let files = (await walk(distDir)).filter((file) => EMITTED_FILE.test(file));
	let entries = await Promise.all(
		files.map(async (file) => [file, await readFile(file, "utf8")] as const),
	);
	return new Map(entries);
}

async function copyIfPresent(source: string, destination: string): Promise<Result<void, Error>> {
	if (!(await exists(source))) return success(undefined);
	return wrap(() => copyFile(source, destination));
}

/** Copies one verbatim target; a `*` pattern names files the build cannot enumerate, so it is refused. */
async function copyTarget(
	name: string,
	packageDir: string,
	stagingDir: string,
	target: string,
): Promise<Result<void, Error>> {
	if (target.includes("*")) {
		return failure(
			new Error(
				`${name} exports the pattern ${target} to files the build does not compile; list them individually`,
			),
		);
	}
	let destination = join(stagingDir, target);
	return wrap(async () => {
		await mkdir(dirname(destination), { recursive: true });
		await copyFile(join(packageDir, target), destination);
	});
}

async function walk(dir: string): Promise<string[]> {
	let entries = await readdir(dir, { withFileTypes: true });
	let nested = await Promise.all(
		entries.map((entry) =>
			entry.isDirectory() ? walk(join(dir, entry.name)) : Promise.resolve([join(dir, entry.name)]),
		),
	);
	return nested.flat();
}

function specifiersIn(source: string): string[] {
	let specifiers: string[] = [];
	for (let pattern of SPECIFIER_PATTERNS) {
		for (let match of source.matchAll(pattern)) {
			let specifier = match[1];
			if (specifier !== undefined) specifiers.push(specifier);
		}
	}
	return specifiers;
}

/** A specifier that names a source tree, or a relative one that resolves above `dist/`. */
function escapesDist(specifier: string, file: string, distDir: string): boolean {
	if (specifier.includes("/src/")) return true;
	if (!specifier.startsWith(".")) return false;
	return relative(distDir, resolve(dirname(file), specifier)).startsWith("..");
}

function patternBase(target: string): string {
	let star = target.indexOf("*");
	return star === -1 ? target : target.slice(0, star);
}

async function exists(path: string): Promise<boolean> {
	return isSuccess(await wrap(() => access(path)));
}
