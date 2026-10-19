/**
 * The `emails` check: every email `app/emails/index.ts` declares is mapped onto a template in
 * `app/initializers/mail.ts`, each mapped template has a test beside it, and each has a
 * `preview()`. An unmapped email fails every send, so that finding fails the run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, stat } from "node:fs/promises";
import { join, posix } from "node:path";

import { findModuleReferences, tokenize } from "@sdxc/codemod";
import { isFailure, isSuccess, wrap } from "@sdxc/result";

import type { Node } from "../routes/parse.js";

import { Reader } from "../routes/parse.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/** The module that declares every email, which `sdxc make email` adds each one to. */
export const EMAILS_INDEX = "app/emails/index.ts";

/** The initializer that maps each declared email onto its template. */
export const MAIL_INITIALIZER = "app/initializers/mail.ts";

/** The extensions a template specifier without one may resolve to. */
const EXTENSIONS = [".tsx", ".ts", "/index.tsx", "/index.ts"];

/**
 * A `preview` property or method opening a line of the options' source, for the members the
 * reader leaves out of an object: methods, and entries after a body it could not read.
 */
const PREVIEW_MEMBER = /^\s*(?:async\s+)?preview\s*[:(]/m;

/** One file a module reads, tokenized, with the local names its imports bind. */
interface ReadModule {
	reader: Reader;
	imports: Map<string, { specifier: string; imported: string }>;
}

/**
 * Fails on a declared email no template is mapped for, and warns on a mapped template without
 * a test beside it or without `preview()`.
 */
export const emailsCheck: Check = {
	name: "emails",
	async run(context): Promise<CheckResult> {
		let index = await readModule(context.root, EMAILS_INDEX);
		if (index === null) return skipped(`No ${EMAILS_INDEX} in the project`);
		let declared = declaredEmails(index);
		if (declared === null) return skipped(`${EMAILS_INDEX} declares no emails({ … })`);
		let initializer = await readModule(context.root, MAIL_INITIALIZER);
		let mapped = initializer === null ? new Map<string, string | null>() : mappings(initializer);

		let unmapped: string[] = [];
		let untested: string[] = [];
		let unpreviewed: string[] = [];
		for (let name of declared) {
			if (!mapped.has(name)) {
				unmapped.push(`${name} is declared in ${EMAILS_INDEX} and mapped by no template`);
				continue;
			}
			let template = await resolveTemplate(context.root, mapped.get(name) ?? null);
			if (template === null) continue;
			if (!(await hasTest(context.root, template))) {
				untested.push(`${template} has no test beside it`);
			}
			let module = await readModule(context.root, template);
			if (module !== null && !hasPreview(module)) {
				unpreviewed.push(`${template} has no preview()`);
			}
		}

		if (unmapped.length > 0) {
			return {
				status: "fail",
				message: `${MAIL_INITIALIZER} maps no template for ${count(unmapped.length, "declared email")}`,
				findings: [...unmapped, ...untested, ...unpreviewed],
				fix: `Map each in ${MAIL_INITIALIZER} as mail.map(emails.<name>, lazy(() => import("~/app/emails/<file>"))); sdxc make email writes and maps one`,
			};
		}
		if (untested.length > 0 || unpreviewed.length > 0) {
			let problems = [
				untested.length === 0 ? null : `${count(untested.length, "template")} without a test`,
				unpreviewed.length === 0
					? null
					: `${count(unpreviewed.length, "template")} without preview()`,
			].filter((problem) => problem !== null);
			return {
				status: "warn",
				message: `Found ${problems.join(" and ")}`,
				findings: [...untested, ...unpreviewed],
				fix: "Write <template>.test.tsx rendering it through mail.render(), and give createEmail() a preview: () => ({ … }) of sample props",
			};
		}
		return passed(`${count(declared.length, "declared email")} mapped, tested and previewable`);
	},
};

/** `count` with `noun`, pluralized by an `s` past one. */
function count(amount: number, noun: string): string {
	return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}

/** The module at `path` tokenized with its imports, or `null` when it is missing or unreadable. */
async function readModule(root: string, path: string): Promise<ReadModule | null> {
	let source = await wrap(() => readFile(join(root, path), "utf8"));
	if (isFailure(source)) return null;
	let tokens = tokenize(path, source.data);
	let references = findModuleReferences(path, source.data);
	if (isFailure(tokens) || isFailure(references)) return null;
	let imports = new Map<string, { specifier: string; imported: string }>();
	for (let reference of references.data) {
		if (reference.kind !== "import") continue;
		for (let bound of reference.names) {
			imports.set(bound.local, { specifier: reference.specifier, imported: bound.imported });
		}
	}
	return { reader: new Reader(tokens.data, source.data), imports };
}

/**
 * Every email name the default-exported `emails({ … })` declares, by its path through the
 * groups (`teams.invite`), or `null` when the module exports no such call.
 */
function declaredEmails(module: ReadModule): string[] | null {
	let declarations = module.reader.declarations();
	let exported = declarations.defaultExport;
	if (exported?.kind === "identifier") exported = declarations.locals.get(exported.name) ?? null;
	if (exported?.kind !== "call" || !isImportOf(module, exported.callee, "emails")) return null;
	let tree = exported.args[0]?.node;
	if (tree?.kind !== "object") return null;
	return leaves(module, tree, []);
}

/** The names of the `email(…)` leaves under a group, nested groups as objects or `emails()` calls. */
function leaves(module: ReadModule, node: Node, path: readonly string[]): string[] {
	if (node.kind === "call" && isImportOf(module, node.callee, "email")) return [path.join(".")];
	let group = node;
	if (node.kind === "call" && isImportOf(module, node.callee, "emails")) {
		group = node.args[0]?.node ?? node;
	}
	if (group.kind !== "object") return [];
	return group.entries.flatMap((entry) =>
		"key" in entry ? leaves(module, entry.value, [...path, entry.key]) : [],
	);
}

/** Whether `callee` is a local bound to the `imported` export of some module. */
function isImportOf(module: ReadModule, callee: Node, imported: string): boolean {
	return callee.kind === "identifier" && module.imports.get(callee.name)?.imported === imported;
}

/**
 * Every `<registry>.map(emails.<name>, template)` in the initializer, by email name, with the
 * specifier its template is imported from, through `lazy(() => import(…))` or a static import;
 * `null` when the template is written some other way.
 */
function mappings(module: ReadModule): Map<string, string | null> {
	let reader = module.reader;
	let found = new Map<string, string | null>();
	for (let index = 0; index < reader.tokens.length; index += 1) {
		if (!reader.is(index, ".") || !reader.isWord(index + 1, "map") || !reader.is(index + 2, "(")) {
			continue;
		}
		let start = index - 1;
		let call = reader.expression(start, reader.tokens.length).node;
		if (call.kind !== "call") continue;
		let [target, template] = call.args;
		let name = target === undefined ? null : emailName(target.node);
		if (name === null) continue;
		found.set(name, template === undefined ? null : templateSpecifier(module, template.node));
	}
	return found;
}

/** The dotted name a member chain such as `emails.teams.invite` names, its root left out. */
function emailName(node: Node): string | null {
	let path: string[] = [];
	let current = node;
	while (current.kind === "member") {
		path.unshift(current.property);
		current = current.object;
	}
	return current.kind === "identifier" && path.length > 0 ? path.join(".") : null;
}

/** The specifier a mapped template is loaded from. */
function templateSpecifier(module: ReadModule, node: Node): string | null {
	if (node.kind === "identifier") return module.imports.get(node.name)?.specifier ?? null;
	if (node.kind !== "call") return null;
	let loader = node.args[0]?.node;
	if (loader?.kind !== "function") return null;
	return loader.body?.kind === "import" ? loader.body.specifier : null;
}

/**
 * Whether the options of the template's `createEmail(email, { … })` call carry a `preview`, as
 * a property or a method; a template written any other way counts as having one.
 */
function hasPreview(module: ReadModule): boolean {
	let reader = module.reader;
	for (let index = 0; index < reader.tokens.length; index += 1) {
		let token = reader.tokens[index];
		if (
			token?.type !== "identifier" ||
			module.imports.get(token.value)?.imported !== "createEmail"
		) {
			continue;
		}
		if (!reader.is(index + 1, "(")) continue;
		let call = reader.expression(index, reader.tokens.length).node;
		let options = call.kind === "call" ? call.args[1]?.node : undefined;
		if (options?.kind !== "object") return true;
		if (options.entries.some((entry) => "key" in entry && entry.key === "preview")) return true;
		return PREVIEW_MEMBER.test(reader.source.slice(options.start, options.end));
	}
	return true;
}

/** The project file a template specifier names, from the initializer; `null` for a package. */
async function resolveTemplate(root: string, specifier: string | null): Promise<string | null> {
	if (specifier === null) return null;
	let base: string;
	if (specifier.startsWith("~/")) base = specifier.slice(2);
	else if (specifier.startsWith(".")) {
		base = posix.normalize(posix.join(posix.dirname(MAIL_INITIALIZER), specifier));
	} else return null;
	let candidates = /\.[cm]?[jt]sx?$/.test(base)
		? [base.replace(/\.js$/, ".tsx"), base.replace(/\.js$/, ".ts"), base]
		: EXTENSIONS.map((extension) => `${base}${extension}`);
	for (let candidate of candidates) {
		if (await isFile(root, candidate)) return candidate;
	}
	return null;
}

/** Whether a test sits beside `template`, as `<name>.test.tsx` or `<name>.test.ts`. */
async function hasTest(root: string, template: string): Promise<boolean> {
	let bare = template.replace(/\.[cm]?[jt]sx?$/, "");
	for (let extension of [".tsx", ".ts"]) {
		if (await isFile(root, `${bare}.test${extension}`)) return true;
	}
	return false;
}

/** Whether `path` is a file under `root`. */
async function isFile(root: string, path: string): Promise<boolean> {
	let found = await wrap(() => stat(join(root, path)));
	return isSuccess(found) && found.data.isFile();
}
