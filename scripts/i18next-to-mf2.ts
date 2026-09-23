/**
 * One-off codemod rewriting an app's locale modules from i18next syntax to Unicode
 * MessageFormat 2: interpolations, plural key groups, and `Trans` tags. Only string leaves
 * change, edited in place through the TypeScript AST so comments and formatting survive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/// <reference types="bun" />

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import ts from "typescript";

/** i18next plural suffixes in the order their variants are emitted. */
const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"] as const;

/** Splits an i18next plural key into its base and CLDR category. */
const PLURAL_KEY = /^(.+)_(zero|one|two|few|many|other)$/;

const ROOT_DIR = resolve(import.meta.dirname, "..");

/** A problem the codemod reports for a human to settle. */
export interface Issue {
	key: string;
	message: string;
}

/** Tallies a conversion produces, summed per file and per app. */
export interface Counts {
	leavesChanged: number;
	interpolations: number;
	pluralGroups: number;
	tags: number;
	escapes: number;
}

/** A converted pattern plus what the conversion did to it. */
export interface PatternResult {
	pattern: string;
	counts: Counts;
	issues: string[];
}

/** Starts a zeroed tally. */
export function emptyCounts(): Counts {
	return { leavesChanged: 0, interpolations: 0, pluralGroups: 0, tags: 0, escapes: 0 };
}

/** Adds `b` into `a` in place and returns `a`. */
export function addCounts(a: Counts, b: Counts): Counts {
	a.leavesChanged += b.leavesChanged;
	a.interpolations += b.interpolations;
	a.pluralGroups += b.pluralGroups;
	a.tags += b.tags;
	a.escapes += b.escapes;
	return a;
}

/**
 * Converts i18next text to the body of an MF2 pattern: `{{name}}` becomes `{$name}`, and
 * `{`, `}`, `\` in literal text are backslash-escaped. With `tags`, `<b>…</b>` and `<br/>`
 * become MF2 markup; otherwise `<` stays literal text, which MF2 allows unescaped.
 * @param source The i18next string.
 * @param tags Whether the key renders through `Trans`.
 */
export function convertPattern(source: string, tags: boolean): PatternResult {
	let counts = emptyCounts();
	let issues: string[] = [];
	let token = tags
		? /\{\{(-?)\s*([^{}]*?)\s*\}\}|<(\/?)([A-Za-z][\w-]*)\s*(\/?)>/g
		: /\{\{(-?)\s*([^{}]*?)\s*\}\}/g;
	let out = "";
	let last = 0;
	for (let match of source.matchAll(token)) {
		out += escapeText(source.slice(last, match.index), counts);
		last = match.index + match[0].length;
		if (match[4] !== undefined) {
			counts.tags++;
			let sigil = match[3] === "/" ? "/" : "#";
			out += `{${sigil}${match[4]}${match[5] === "/" ? " /" : ""}}`;
			continue;
		}
		let name = match[2] ?? "";
		if (match[1] === "-")
			issues.push(`unescaped interpolation {{- ${name}}} converted as a plain one`);
		if (name.includes(",")) {
			issues.push(`formatted interpolation {{${name}}} needs a hand-written MF2 function`);
			out += escapeText(match[0], counts);
			continue;
		}
		if (!/^[A-Za-z_][\w.-]*$/.test(name)) {
			issues.push(`interpolation {{${name}}} is not a valid MF2 variable name`);
			out += escapeText(match[0], counts);
			continue;
		}
		if (name.includes(".")) issues.push(`dotted interpolation {{${name}}} became {$${name}}`);
		counts.interpolations++;
		out += `{$${name}}`;
	}
	out += escapeText(source.slice(last), counts);
	return { pattern: out, counts, issues };
}

/** Backslash-escapes the three characters MF2 text reserves, counting each. */
function escapeText(text: string, counts: Counts): string {
	return text.replace(/[\\{}]/g, (char) => {
		counts.escapes++;
		return `\\${char}`;
	});
}

/**
 * Converts one i18next string to a complete MF2 simple message. A pattern that would start
 * with `.` or whitespace opens with a quoted literal, since MF2 reads a leading `.` as a
 * declaration and cannot backslash-escape it.
 */
export function convertSimple(source: string, tags: boolean): PatternResult {
	let result = convertPattern(source, tags);
	let lead = /^[.\s]+/.exec(result.pattern)?.[0];
	if (lead) {
		result.counts.escapes++;
		result.pattern = `{|${lead.replace(/[\\|]/g, "\\$&")}|}${result.pattern.slice(lead.length)}`;
	}
	return result;
}

/**
 * Collapses an i18next plural group into one MF2 `.match` message on `$count`. `_zero` maps to
 * the exact key `0`, matching i18next's count-of-zero rule in every language, and `_other`
 * becomes the `*` fallback, so the group must carry one.
 * @param forms Suffix to i18next string, e.g. `{ one: "…", other: "…" }`.
 */
export function convertPlural(
	forms: Partial<Record<(typeof PLURAL_SUFFIXES)[number], string>>,
	tags: boolean,
): PatternResult {
	let counts = emptyCounts();
	let issues: string[] = [];
	let lines = [".input {$count :number}", ".match $count"];
	for (let suffix of PLURAL_SUFFIXES) {
		let form = forms[suffix];
		if (form === undefined) continue;
		let result = convertPattern(form, tags);
		addCounts(counts, result.counts);
		issues.push(...result.issues);
		let key = suffix === "zero" ? "0" : suffix === "other" ? "*" : suffix;
		lines.push(`${key} {{${result.pattern}}}`);
	}
	counts.pluralGroups = 1;
	return { pattern: lines.join("\n"), counts, issues };
}

/** One locale file's rewrite. */
export interface FileResult {
	output: string;
	counts: Counts;
	issues: Issue[];
	/** Keys whose strings contain `<` but render outside `Trans`, left as literal text. */
	angleBrackets: string[];
}

/** A source span replacement, applied back to front so earlier offsets stay valid. */
interface Edit {
	start: number;
	end: number;
	text: string;
}

/**
 * Rewrites every string leaf of a locale module's object literals. Keys in `transKeys`
 * (dotted paths; a plural group matches on its base key) get tag conversion.
 */
export function convertLocaleSource(source: string, transKeys: ReadonlySet<string>): FileResult {
	let file = ts.createSourceFile("locale.ts", source, ts.ScriptTarget.Latest, true);
	let edits: Edit[] = [];
	let counts = emptyCounts();
	let issues: Issue[] = [];
	let angleBrackets: string[] = [];

	let lineOf = (node: ts.Node) => file.getLineAndCharacterOfPosition(node.getStart()).line + 1;

	let replaceLiteral = (node: ts.Expression, text: string) => {
		if (text === (node as ts.StringLiteralLike).text) return false;
		edits.push({ start: node.getStart(), end: node.getEnd(), text: quote(text, node) });
		return true;
	};

	let visitObject = (object: ts.ObjectLiteralExpression, path: string[]) => {
		let groups = new Map<string, Map<string, ts.PropertyAssignment>>();
		let names = new Set<string>();
		for (let property of object.properties) {
			if (!ts.isPropertyAssignment(property)) continue;
			let name = propertyName(property.name);
			if (name === undefined) continue;
			names.add(name);
			let plural = PLURAL_KEY.exec(name);
			if (plural && isStringLiteral(property.initializer)) {
				let group = groups.get(plural[1]!) ?? new Map();
				group.set(plural[2]!, property);
				groups.set(plural[1]!, group);
			}
		}

		let grouped = new Set<ts.PropertyAssignment>();
		for (let [base, group] of groups) {
			let key = [...path, base].join(".");
			if (!group.has("other")) {
				issues.push({
					key,
					message: `plural group without _other (line ${lineOf(object)}), left as-is`,
				});
				continue;
			}
			if (names.has(base)) {
				issues.push({ key, message: `bare key sits beside its plural group, group left as-is` });
				continue;
			}
			let forms: Record<string, string> = {};
			for (let [suffix, property] of group) {
				forms[suffix] = (property.initializer as ts.StringLiteralLike).text;
				grouped.add(property);
			}
			let result = convertPlural(forms, transKeys.has(key));
			addCounts(counts, result.counts);
			counts.leavesChanged++;
			for (let message of result.issues) issues.push({ key, message });
			let members = PLURAL_SUFFIXES.flatMap((suffix) => group.get(suffix) ?? []).sort(
				(a, b) => a.getStart() - b.getStart(),
			);
			let [first, ...rest] = members;
			edits.push({
				start: first!.getStart(),
				end: first!.getEnd(),
				text: `${formatKey(base)}: ${JSON.stringify(result.pattern)}`,
			});
			for (let property of rest) edits.push(removal(property, object, source));
		}

		for (let property of object.properties) {
			if (!ts.isPropertyAssignment(property) || grouped.has(property)) continue;
			let name = propertyName(property.name);
			if (name === undefined) continue;
			let value = unwrap(property.initializer);
			let key = [...path, name].join(".");
			if (ts.isObjectLiteralExpression(value)) {
				visitObject(value, [...path, name]);
				continue;
			}
			if (!isStringLiteral(value)) continue;
			let tags = transKeys.has(key);
			if (!tags && value.text.includes("<")) angleBrackets.push(key);
			let result = convertSimple(value.text, tags);
			for (let message of result.issues) issues.push({ key, message });
			if (replaceLiteral(value, result.pattern)) {
				counts.leavesChanged++;
				addCounts(counts, result.counts);
			}
		}
	};

	let visit = (node: ts.Node) => {
		if (ts.isExportAssignment(node) || ts.isVariableDeclaration(node)) {
			let value = ts.isExportAssignment(node) ? node.expression : node.initializer;
			if (value && ts.isObjectLiteralExpression(unwrap(value))) {
				visitObject(unwrap(value) as ts.ObjectLiteralExpression, []);
				return;
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(file);

	let output = source;
	for (let edit of edits.sort((a, b) => b.start - a.start)) {
		output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
	}
	return { output, counts, issues, angleBrackets };
}

/** Strips `satisfies`, `as`, and parentheses to reach the value expression. */
function unwrap(node: ts.Expression): ts.Expression {
	while (
		ts.isSatisfiesExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isParenthesizedExpression(node)
	) {
		node = node.expression;
	}
	return node;
}

/** Template literals without substitutions count, since they hold plain text too. */
function isStringLiteral(node: ts.Node): node is ts.StringLiteralLike {
	return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/** Computed keys yield `undefined`, so their values stay untouched. */
function propertyName(name: ts.PropertyName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
		return name.text;
	return undefined;
}

/** Quotes a collapsed plural key only when it is not a valid identifier. */
function formatKey(name: string): string {
	return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

/** Re-quotes `text` in the literal's own quote style, so untouched formatting stays stable. */
function quote(text: string, node: ts.Node): string {
	let original = node.getText();
	if (original.startsWith("'") && !text.includes("'")) {
		return `'${JSON.stringify(text).slice(1, -1).replace(/\\"/g, '"')}'`;
	}
	if (original.startsWith("`")) return `\`${text.replace(/[\\`$]/g, "\\$&")}\``;
	return JSON.stringify(text);
}

/** Deletes a property with its leading trivia and the comma that follows it. */
function removal(
	property: ts.PropertyAssignment,
	object: ts.ObjectLiteralExpression,
	source: string,
): Edit {
	let start = property.getFullStart();
	let end = property.getEnd();
	let index = object.properties.indexOf(property);
	if (index < object.properties.length - 1 || object.properties.hasTrailingComma) {
		let comma = source.indexOf(",", end);
		if (comma !== -1) end = comma + 1;
	}
	return { start, end, text: "" };
}

/** Summary of scanning an app's source for `Trans` usage. */
export interface TransScan {
	keys: Set<string>;
	dynamic: string[];
}

/** Collects the literal `i18nKey="…"` values under `apps/<app>/app`, outside `locales/`. */
async function scanTransKeys(appDir: string): Promise<TransScan> {
	let keys = new Set<string>();
	let dynamic: string[] = [];
	for (let path of await listFiles(join(appDir, "app"))) {
		if (!/\.(tsx?|jsx?)$/.test(path) || path.includes("/locales/")) continue;
		let text = await readFile(path, "utf8");
		for (let match of text.matchAll(/i18nKey=(\{\s*)?(["'`])?([^"'`}\s]*)/g)) {
			if (match[2] && !match[3]!.includes("${")) keys.add(match[3]!);
			else dynamic.push(`${relative(ROOT_DIR, path)}: ${match[0]}`);
		}
	}
	return { keys, dynamic };
}

/** Every file below `dir`, recursively, as absolute paths. */
async function listFiles(dir: string): Promise<string[]> {
	let entries = await readdir(dir, { withFileTypes: true, recursive: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name));
}

/** Runs the codemod for one app, writing files unless `dryRun`. */
async function main(argv: string[]) {
	let dryRun = argv.includes("--dry-run");
	let app = argv.find((arg) => !arg.startsWith("--"));
	if (!app) {
		process.stderr.write("Usage: bun scripts/i18next-to-mf2.ts <app> [--dry-run]\n");
		process.exitCode = 1;
		return;
	}
	let appDir = join(ROOT_DIR, "apps", app);
	let localesDir = join(appDir, "app", "locales");
	let trans = await scanTransKeys(appDir);
	let files = (await readdir(localesDir))
		.filter((name) => name.endsWith(".ts") && !name.includes(".test."))
		.sort();
	let total = emptyCounts();
	let write = (line = "") => process.stdout.write(`${line}\n`);

	write(
		`${app}: ${files.length} locale file(s), Trans keys: ${[...trans.keys].join(", ") || "none"}`,
	);
	for (let entry of trans.dynamic) write(`  dynamic i18nKey (not converted): ${entry}`);
	for (let name of files) {
		let path = join(localesDir, name);
		let result = convertLocaleSource(await readFile(path, "utf8"), trans.keys);
		addCounts(total, result.counts);
		let c = result.counts;
		write(
			`  ${name}: ${c.leavesChanged} messages changed, ${c.interpolations} interpolations, ` +
				`${c.pluralGroups} plural groups, ${c.tags} tags, ${c.escapes} escapes`,
		);
		for (let issue of result.issues) write(`    ! ${issue.key}: ${issue.message}`);
		for (let key of result.angleBrackets)
			write(`    < ${key}: contains "<" outside Trans, kept as text`);
		if (!dryRun) await writeFile(path, result.output);
	}
	write(
		`  total: ${total.leavesChanged} messages, ${total.interpolations} interpolations, ` +
			`${total.pluralGroups} plural groups, ${total.tags} tags, ${total.escapes} escapes` +
			(dryRun ? " (dry run, nothing written)" : ""),
	);
}

if (import.meta.main) await main(process.argv.slice(2));
