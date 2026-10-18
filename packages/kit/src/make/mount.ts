/**
 * Mounts what `make middleware --mount <target>` generates: imports the middleware into a router
 * initializer's `createRouter({ middleware: [...] })` or a `createMiddleware(…)` chain module and
 * calls it last there. The targets are read from the project, each named after its file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join, posix } from "node:path";

import type { ModuleReference } from "@sdxc/codemod";
import type { Result } from "@sdxc/result";

import { usage } from "@sdxc/cli";
import { addElement, findModuleReferences } from "@sdxc/codemod";
import { isFailure, isSuccess, success, wrap } from "@sdxc/result";

import type { Declared } from "./declare.js";
import type { Name } from "./names.js";

import { literal } from "./generate.js";
import { ensureImport, resolvesTo, specifierFor } from "./imports.js";

/** What to mount and where, as the command line asked for it. */
export interface MountRequest {
	name: Name;
	/** The target `--mount` named: a router initializer's or a chain module's name. */
	target: string;
	/** The generated middleware, relative to the project root, without its extension. */
	handler: string;
}

/**
 * A place a middleware can be mounted. A `router` target appends to the `middleware` array the
 * first `callee(…)` call receives; a `chain` target appends to the call's own arguments.
 */
interface Target {
	name: string;
	kind: "router" | "chain";
	path: string;
	source: string;
	references: ModuleReference[];
	/** The local name the file calls `createRouter` or `createMiddleware` by. */
	callee: string;
}

/** Where router initializers live; each one that calls `createRouter` is a target. */
const INITIALIZERS = "app/initializers";

/** Where chain modules live; each one default-exporting `createMiddleware(…)` is a target. */
const CHAINS = "app/http/middleware";

/**
 * Plans the import and the call that mount the middleware on `request.target`. A target the
 * project lacks is a usage failure listing the ones it has; an edit that cannot be placed comes
 * back as `manual`, with the import and the call to add by hand.
 */
export async function mount(request: MountRequest, root: string): Promise<Result<Declared, Error>> {
	let targets = await findTargets(root);
	let target = targets.find((candidate) => candidate.name === request.target);
	if (target === undefined) {
		let names = targets.map((candidate) => candidate.name).join(", ");
		return usage(
			`No middleware chain ${literal(request.target)} to mount on; this project has: ${names === "" ? "none" : names}`,
		);
	}
	let tsconfig = await wrap(() => readFile(join(root, "tsconfig.json"), "utf8"));
	let aliased = isSuccess(tsconfig) && tsconfig.data.includes('"~/app/*"');
	let examples = target.references
		.filter((reference) => reference.kind === "import")
		.map((reference) => reference.specifier);
	let specifier = specifierFor(target.path, request.handler, examples, aliased);
	let local = request.name.key;
	let call = `${local}()`;
	let chain =
		target.kind === "router"
			? `${target.callee}({ middleware: [ …, ${call} ] })`
			: `${target.callee}(…, ${call})`;
	let manual = (reason: string): Declared => ({
		kind: "manual",
		path: target.name,
		reason,
		instructions: [
			`In ${target.path}, import it and call it last in the chain:`,
			`  import ${local} from ${literal(specifier)};`,
			`  ${chain}`,
		].join("\n"),
	});
	let bound = target.references.some(
		(reference) =>
			reference.kind === "import" && reference.names.some((name) => name.local === local),
	);
	if (bound) return success(manual(`${target.path} already binds ${local}`));

	let imported = ensureImport(
		target.path,
		target.source,
		{ kind: "default" },
		(candidate) => resolvesTo(candidate, target.path, request.handler),
		specifier,
		local,
	);
	if (isFailure(imported)) return success(manual(imported.error.message));
	let added = addElement(target.path, imported.data.source, {
		call: target.callee,
		...(target.kind === "router" ? { path: ["middleware"] } : {}),
		value: `${imported.data.local}()`,
	});
	if (isFailure(added)) return success(manual(added.error.message));
	return success({
		kind: "edits",
		path: target.name,
		edits: [{ path: target.path, before: target.source, after: added.data.source }],
	});
}

/**
 * Every target in the project: the router initializers in file order, then the chain modules in
 * path order. A chain named like a router initializer is never reached, since names resolve to
 * the first target that has them.
 */
async function findTargets(root: string): Promise<Target[]> {
	let targets: Target[] = [];
	for (let path of await sources(root, INITIALIZERS, false)) {
		let target = await readTarget(root, path, "createRouter");
		if (target === null || !new RegExp(`\\b${escape(target.callee)}\\s*\\(`).test(target.source))
			continue;
		targets.push({ ...target, name: withoutExtension(path, INITIALIZERS), kind: "router" });
	}
	for (let path of await sources(root, CHAINS, true)) {
		let target = await readTarget(root, path, "createMiddleware");
		if (target === null) continue;
		let exported = new RegExp(`export\\s+default\\s+${escape(target.callee)}\\s*\\(`);
		if (!exported.test(target.source)) continue;
		targets.push({ ...target, name: withoutExtension(path, CHAINS), kind: "chain" });
	}
	return targets;
}

/** The TypeScript modules under `folder`, sorted, leaving out tests and declaration files. */
async function sources(root: string, folder: string, recursive: boolean): Promise<string[]> {
	let entries = await wrap(() => readdir(join(root, folder), { recursive }));
	if (isFailure(entries)) return [];
	return entries.data
		.map((entry) => entry.split("\\").join("/"))
		.filter((entry) => /\.tsx?$/.test(entry) && !/\.(?:test\.tsx?|d\.ts)$/.test(entry))
		.sort()
		.map((entry) => posix.join(folder, entry));
}

/**
 * The file at `path` with the local name it imports `factory` by, as a value; `null` when it
 * cannot be read or scanned, or imports no such factory.
 */
async function readTarget(
	root: string,
	path: string,
	factory: string,
): Promise<Omit<Target, "name" | "kind"> | null> {
	let source = await wrap(() => readFile(join(root, path), "utf8"));
	if (isFailure(source)) return null;
	let references = findModuleReferences(path, source.data);
	if (isFailure(references)) return null;
	for (let reference of references.data) {
		if (reference.kind !== "import" || reference.typeOnly) continue;
		let bound = reference.names.find((name) => name.imported === factory && !name.typeOnly);
		if (bound !== undefined) {
			return { path, source: source.data, references: references.data, callee: bound.local };
		}
	}
	return null;
}

/** A module's name inside `folder`: its path there, without the extension. */
function withoutExtension(path: string, folder: string): string {
	return posix.relative(folder, path).replace(/\.tsx?$/, "");
}

/** `text` with every regular-expression metacharacter escaped. */
function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
