/**
 * Downloads pinned OSS emoji sources, merges them into one inverted catalog,
 * writes conflicts, and emits `src/data/emojis.data.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const CACHE = path.join(ROOT, "scripts/cache");
const SOURCES = JSON.parse(
	await readFile(path.join(ROOT, "scripts/sources.json"), "utf8"),
) as Record<string, { url: string; license: string; role: string }>;

const CATEGORY_MAP: Record<string, string> = {
	"Smileys & Emotion": "smileys-emotion",
	"People & Body": "people-body",
	"Animals & Nature": "animals-nature",
	"Food & Drink": "food-drink",
	"Travel & Places": "travel-places",
	Activities: "activities",
	Objects: "objects",
	Symbols: "symbols",
	Flags: "flags",
	// gemoji / older labels
	"Smileys & People": "smileys-emotion",
	"Food & Drink ": "food-drink",
};

interface GemojiRow {
	emoji: string;
	category: string;
	aliases: string[];
	tags?: string[];
}

interface IamcalRow {
	unified: string;
	short_name: string;
	short_names: string[];
	texts?: string[] | null;
	category: string;
	added_in?: string;
}

interface Entry {
	emoji: string;
	shortcodes: string[];
	category: string;
	tags?: string[];
	emoticons?: string[];
}

interface Conflict {
	shortcode: string;
	kept: string;
	dropped: string;
	source: string;
}

await mkdir(CACHE, { recursive: true });

let gemoji = (await loadJson("gemoji")) as GemojiRow[];
let iamcal = (await loadJson("iamcal")) as IamcalRow[];
let emojibaseData = (await loadJson("emojibaseData")) as { hexcode: string; emoji?: string }[];
let emojibaseGithub = (await loadJson("emojibaseGithub")) as Record<string, string | string[]>;

let byEmoji = new Map<string, Entry>();
let shortcodeOwner = new Map<string, string>();
let conflicts: Conflict[] = [];

for (let row of gemoji) {
	let category = CATEGORY_MAP[row.category];
	if (!category) continue;
	let emoji = normalizeEmoji(row.emoji);
	absorb(emoji, category, row.aliases, row.tags ?? [], [], "gemoji");
}

for (let [hex, names] of Object.entries(emojibaseGithub)) {
	let emoji = emojiFromHex(hex, emojibaseData);
	if (!emoji) continue;
	let list = Array.isArray(names) ? names : [names];
	let existing = byEmoji.get(normalizeEmoji(emoji));
	if (!existing) continue;
	absorb(existing.emoji, existing.category, list, [], [], "emojibase-github");
}

for (let row of iamcal) {
	let emoji = unifiedToEmoji(row.unified);
	if (!emoji) continue;
	let category = CATEGORY_MAP[row.category] ?? byEmoji.get(normalizeEmoji(emoji))?.category;
	if (!category || category === "custom") continue;
	let names = unique([row.short_name, ...row.short_names]);
	let emoticons = (row.texts ?? []).filter((text): text is string => typeof text === "string");
	absorb(normalizeEmoji(emoji), category, names, [], emoticons, "iamcal");
}

let entries = [...byEmoji.values()].sort((a, b) => {
	let cat = a.category.localeCompare(b.category);
	if (cat !== 0) return cat;
	return (a.shortcodes[0] ?? "").localeCompare(b.shortcodes[0] ?? "");
});

await writeFile(path.join(ROOT, "scripts/conflicts.md"), formatConflicts(conflicts), "utf8");
await writeFile(path.join(ROOT, "SOURCES.md"), formatSources(), "utf8");
await writeDataModule(entries);

console.log(`Wrote ${entries.length} emoji, ${conflicts.length} shortcode conflicts`);

function absorb(
	emoji: string,
	category: string,
	shortcodes: string[],
	tags: string[],
	emoticons: string[],
	source: string,
) {
	let key = normalizeEmoji(emoji);
	let entry = byEmoji.get(key);
	if (!entry) {
		entry = {
			emoji: key,
			category,
			shortcodes: [],
			tags: [],
			emoticons: [],
		};
		byEmoji.set(key, entry);
	}

	for (let raw of shortcodes) {
		let name = raw.toLowerCase();
		if (name === "") continue;
		let owner = shortcodeOwner.get(name);
		if (owner && owner !== key) {
			conflicts.push({ shortcode: name, kept: owner, dropped: key, source });
			continue;
		}
		shortcodeOwner.set(name, key);
		if (!entry.shortcodes.includes(name)) entry.shortcodes.push(name);
	}

	for (let tag of tags) {
		if (!entry.tags) entry.tags = [];
		if (!entry.tags.includes(tag)) entry.tags.push(tag);
	}
	for (let emoticon of emoticons) {
		if (!entry.emoticons) entry.emoticons = [];
		if (!entry.emoticons.includes(emoticon)) entry.emoticons.push(emoticon);
	}
}

function normalizeEmoji(emoji: string): string {
	return emoji.replaceAll("\uFE0F", "");
}

function unifiedToEmoji(unified: string): string | undefined {
	try {
		return String.fromCodePoint(...unified.split("-").map((part) => Number.parseInt(part, 16)));
	} catch {
		return undefined;
	}
}

function emojiFromHex(
	hex: string,
	data: { hexcode: string; emoji?: string }[],
): string | undefined {
	let row = data.find(
		(item) => item.hexcode === hex || item.hexcode.replaceAll("-FE0F", "") === hex,
	);
	return row?.emoji;
}

function unique(values: string[]): string[] {
	return [...new Set(values.map((value) => value.toLowerCase()).filter(Boolean))];
}

async function loadJson(name: string): Promise<unknown> {
	let source = SOURCES[name];
	if (!source) throw new Error(`Unknown source ${name}`);
	let filePath = path.join(CACHE, `${name}.json`);
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch {
		let response = await fetch(source.url);
		if (!response.ok) throw new Error(`Failed to download ${name}: ${response.status}`);
		let text = await response.text();
		await writeFile(filePath, text);
		return JSON.parse(text);
	}
}

async function writeDataModule(entries: Entry[]) {
	let cleaned = entries.map((entry) => {
		let row: Entry = {
			emoji: entry.emoji,
			shortcodes: entry.shortcodes,
			category: entry.category,
		};
		if (entry.tags && entry.tags.length > 0) row.tags = entry.tags;
		if (entry.emoticons && entry.emoticons.length > 0) row.emoticons = entry.emoticons;
		return row;
	});

	let body = `/**
 * Generated emoji catalog. Re-run \`bun run generate\` in \`packages/emoji\` to refresh.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UnicodeEmoji } from "../lib/types.js";

/** Built-in Unicode emoji entries, one row per glyph. */
export const emojis = ${JSON.stringify(cleaned, null, "\t")} as const satisfies readonly UnicodeEmoji[];
`;

	await mkdir(path.join(ROOT, "src/data"), { recursive: true });
	await writeFile(path.join(ROOT, "src/data/emojis.data.ts"), `${body}\n`, "utf8");
}

function formatConflicts(rows: Conflict[]): string {
	if (rows.length === 0) return "# Shortcode conflicts\n\nNone.\n";
	let lines = [
		"# Shortcode conflicts",
		"",
		"When two glyphs claimed the same shortcode, the first owner (by source priority) kept it.",
		"",
		"| Shortcode | Kept emoji | Dropped emoji | Source that lost |",
		"| ---------- | ---------- | -------------- | ---------------- |",
	];
	for (let row of rows) {
		lines.push(`| \`${row.shortcode}\` | ${row.kept} | ${row.dropped} | ${row.source} |`);
	}
	return `${lines.join("\n")}\n`;
}

function formatSources(): string {
	let lines = [
		"# Catalog sources",
		"",
		"Generated by `bun run generate` from pinned URLs in `scripts/sources.json`.",
		"",
		"| Source | License | Role | URL |",
		"| ------ | ------- | ---- | --- |",
	];
	for (let [name, source] of Object.entries(SOURCES)) {
		lines.push(`| ${name} | ${source.license} | ${source.role} | ${source.url} |`);
	}
	lines.push("");
	return lines.join("\n");
}
