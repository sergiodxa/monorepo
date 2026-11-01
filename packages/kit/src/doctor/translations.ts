/**
 * The `translations` check: every bundle in `resources/locales/` is read statically, each message
 * is parsed as MessageFormat 2, and every language's keys are compared with the default
 * language's, so a typo or a forgotten key shows up before a reader sees the fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import * as JSONC from "@sdxc/jsonc";
import { parse } from "@sdxc/messageformat";
import { isFailure, wrap } from "@sdxc/result";

import type { Value } from "../routes/modules.js";

import { Project } from "../routes/modules.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { listFiles } from "./files.js";

/** The folder an app keeps one bundle per language in. */
export const LOCALES_FOLDER = "resources/locales";

/** The language every other bundle is compared with, when the app ships it. */
export const DEFAULT_LOCALE = "en";

/** A bundle file directly in the folder, named by its BCP 47 language tag. */
const BUNDLE_FILE = /^([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.(?:[cm]?[jt]s|json)$/;

/** One language's bundle: every message by its dotted key, `null` for a value read as no string. */
interface Bundle {
	locale: string;
	path: string;
	messages: Map<string, string | null>;
}

/**
 * Fails on a message that does not parse as MessageFormat 2, which renders as its key at
 * runtime, and warns on a key one language has and the default language lacks, or the other
 * way round, since a missing key falls back to the default language's copy.
 */
export const translationsCheck: Check = {
	name: "translations",
	async run(context): Promise<CheckResult> {
		let bundles = await readBundles(context.root);
		if (bundles.length === 0) return skipped(`No locale bundles in ${LOCALES_FOLDER}`);
		let reference = bundles.find((bundle) => bundle.locale === DEFAULT_LOCALE) ?? bundles[0];
		if (reference === undefined) return skipped(`No locale bundles in ${LOCALES_FOLDER}`);

		let invalid = bundles.flatMap(invalidMessages);
		let missing: string[] = [];
		let extra: string[] = [];
		for (let bundle of bundles) {
			if (bundle === reference) continue;
			for (let key of reference.messages.keys()) {
				if (!bundle.messages.has(key)) missing.push(`${bundle.path} lacks ${key}`);
			}
			for (let key of bundle.messages.keys()) {
				if (!reference.messages.has(key)) {
					extra.push(`${bundle.path} has ${key}, which ${reference.locale} lacks`);
				}
			}
		}

		if (invalid.length > 0) {
			return {
				status: "fail",
				message: `${count(invalid.length, "message")} not valid MessageFormat 2`,
				findings: [...invalid, ...missing, ...extra],
				fix: "Correct each message's syntax; a literal {, } or \\ is escaped with a backslash",
			};
		}
		if (missing.length > 0 || extra.length > 0) {
			let problems = [
				missing.length === 0 ? null : `${count(missing.length, "key")} missing from a translation`,
				extra.length === 0 ? null : `${count(extra.length, "key")} only in a translation`,
			].filter((problem) => problem !== null);
			return {
				status: "warn",
				message: `Found ${problems.join(" and ")}`,
				findings: [...missing, ...extra],
				fix: `Translate each missing key, and remove or rename each key ${reference.locale} does not have`,
			};
		}
		return passed(
			`${count(bundles.length, "locale")} with ${count(reference.messages.size, "key")}, every message valid`,
		);
	},
};

/** `count` with `noun`, pluralized by an `s` past one. */
function count(amount: number, noun: string): string {
	return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}

/**
 * Every bundle directly in {@link LOCALES_FOLDER}, sorted by path. A module's default export is
 * evaluated without running it, following imported sub-bundles; a file that does not read
 * becomes a bundle with no messages.
 */
async function readBundles(root: string): Promise<Bundle[]> {
	let project = new Project(root);
	let bundles: Bundle[] = [];
	for (let path of await listFiles(root, LOCALES_FOLDER)) {
		let name = path.slice(LOCALES_FOLDER.length + 1);
		let locale = BUNDLE_FILE.exec(name)?.[1];
		if (locale === undefined) continue;
		let messages = new Map<string, string | null>();
		if (path.endsWith(".json")) {
			let text = await wrap(() => readFile(join(root, path), "utf8"));
			let parsed = isFailure(text) ? null : JSONC.parse(text.data);
			if (parsed !== null && !isFailure(parsed)) flattenJSON(parsed.data, "", messages);
		} else {
			let module = await project.load(path);
			if (module !== null) flattenValue(await project.exportValue(module, "default"), "", messages);
		}
		bundles.push({ locale, path, messages });
	}
	return bundles;
}

/** Adds each message under a statically evaluated bundle to `messages` by its dotted key. */
function flattenValue(value: Value, prefix: string, messages: Map<string, string | null>): void {
	if (value.kind !== "map") {
		if (prefix !== "") messages.set(prefix, value.kind === "string" ? value.value : null);
		return;
	}
	for (let [key, entry] of value.entries) {
		flattenValue(entry, prefix === "" ? key : `${prefix}.${key}`, messages);
	}
}

/** Adds each message under a parsed JSON bundle to `messages` by its dotted key. */
function flattenJSON(value: unknown, prefix: string, messages: Map<string, string | null>): void {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		if (prefix !== "") messages.set(prefix, typeof value === "string" ? value : null);
		return;
	}
	for (let [key, entry] of Object.entries(value)) {
		flattenJSON(entry, prefix === "" ? key : `${prefix}.${key}`, messages);
	}
}

/** Each message in `bundle` that does not parse, with the parser's reason and offset. */
function invalidMessages(bundle: Bundle): string[] {
	let found: string[] = [];
	for (let [key, source] of bundle.messages) {
		if (source === null) continue;
		let result = parse(source);
		if (!isFailure(result)) continue;
		let at = result.error.start === undefined ? "" : ` at ${result.error.start}`;
		found.push(`${bundle.path} ${key}: ${result.error.type}${at} (${result.error.message})`);
	}
	return found;
}
