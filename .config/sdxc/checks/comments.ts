/**
 * Fails on comments that point outside the code they sit in: an ADR citation in any workspace, and
 * a package naming an app or importing from one. A comment states its reason in place, and a
 * package published to npm reads the same to a consumer who has never seen this repository.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineCheck } from "@sdxc/kit/doctor";

import { isNode, lineAt, parseModule, walk } from "../../../packages/kit/src/doctor/syntax.js";

/** Folders scanned at the monorepo root. */
const FOLDERS = ["apps", "packages", "cli", "scripts", "test", ".config"] as const;

/** A module, tests included; declaration and generated files left out. */
const MODULE = /\.[cm]?[jt]sx?$/;

/** Generated or vendored files, which no one edits by hand. */
const GENERATED = /\/(?:node_modules|dist|\.cloudflare)\/|\.d\.[cm]?ts$|\/mockServiceWorker\.js$/;

/** The number an architecture decision record is cited by. */
const ADR = /\bADR-\d+/;

/** A path into the apps folder, as a comment or import names one. */
const APP_PATH = /(?:^|[^\w-])apps\//;

/** What one module of a package or app breaks. */
interface Finding {
	line: number;
	message: string;
}

/** Each comment of `source` citing an ADR and, for a package, naming an app or importing one. */
export function inspect(file: string, source: string): Finding[] {
	let parsed = parseModule(file, source);
	if (parsed === null) return [];
	let inPackage = file.startsWith("packages/") && !file.startsWith("packages/kit/templates/");
	let findings: Finding[] = [];
	for (let comment of parsed.comments) {
		let line = lineAt(source, comment.start);
		if (ADR.test(comment.value)) findings.push({ line, message: "cites an ADR" });
		if (inPackage && APP_PATH.test(comment.value)) findings.push({ line, message: "names an app" });
	}
	if (!inPackage) return findings;
	walk(parsed.program, (node) => {
		if (!isNode(node.source) || typeof node.source.value !== "string") return;
		let specifier = node.source.value;
		if (!APP_PATH.test(specifier) && !specifier.startsWith("~/")) return;
		findings.push({
			line: lineAt(source, node.start),
			message: `imports ${specifier} from an app`,
		});
	});
	return findings;
}

export default defineCheck({
	name: "monorepo-comments",
	async run(ctx) {
		let findings: string[] = [];
		for (let folder of FOLDERS) {
			for (let file of await ctx.files(folder)) {
				if (!MODULE.test(file) || GENERATED.test(`/${file}`)) continue;
				let text = await ctx.readFile(file);
				if (text === null) continue;
				for (let found of inspect(file, text))
					findings.push(`${file}:${found.line}: ${found.message}`);
			}
		}
		if (findings.length === 0) {
			return {
				status: "pass",
				message: "Comments state their reasons, and packages stand apart from apps",
			};
		}
		return {
			status: "fail",
			message: `Found ${findings.length} ${findings.length === 1 ? "comment or import" : "comments or imports"} pointing outside the code`,
			findings,
			fix: "State the reason the ADR records in the comment itself, and describe a package's code without naming an app",
		};
	},
});
