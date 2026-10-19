/**
 * `sdxc notes`: every `TODO`, `FIXME`, `HACK` and `OPTIMIZE` comment in the app's code, by file
 * and line, so the work a generated file left to fill in, and the work anyone left for later,
 * reads as one list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { listFiles } from "./doctor/files.js";
import { PROJECT_FOLDERS } from "./stats.js";

/** The tags `notes` looks for without `--tag`. */
export const DEFAULT_TAGS = ["TODO", "FIXME", "HACK", "OPTIMIZE"];

/** The files read: source, SQL, stylesheets and Markdown, where a comment can hold a note. */
const READ = /\.(?:[cm]?[jt]sx?|sql|css|md)$/;

/** One note. */
export interface Note {
	/** The file, relative to the project root. */
	file: string;
	line: number;
	tag: string;
	/** The text after the tag, its `:` dropped. */
	text: string;
}

/**
 * The notes in one file's `text`: a tag as a whole word after a comment marker (`//`, `/*`,
 * `*`, `{/*`, `--` or `<!--`) on the same line, matched in upper case as written.
 */
export function findNotes(file: string, text: string, tags: readonly string[]): Note[] {
	let pattern = new RegExp(
		`(?:\\/\\/|\\/\\*|^\\s*\\*|\\{\\/\\*|--|<!--)\\s*(${tags.map(escapeRegExp).join("|")})\\b:?\\s*(.*?)\\s*(?:\\*\\/\\}?|-->)?\\s*$`,
	);
	let notes: Note[] = [];
	text.split("\n").forEach((line, index) => {
		let match = pattern.exec(line);
		if (match === null) return;
		notes.push({ file, line: index + 1, tag: match[1] as string, text: match[2] ?? "" });
	});
	return notes;
}

/** `value` with every character a regular expression reads specially escaped. */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every note under the project's layout folders, in file order. */
export async function projectNotes(root: string, tags: readonly string[]): Promise<Note[]> {
	let notes: Note[] = [];
	for (let folder of PROJECT_FOLDERS) {
		for (let path of await listFiles(root, folder)) {
			if (!READ.test(path)) continue;
			let text = await wrap(() => readFile(join(root, path), "utf8"));
			if (isFailure(text)) continue;
			notes.push(...findNotes(path, text.data, tags));
		}
	}
	return notes;
}

/** The notes grouped by file, each line numbered as `[12] TODO: …`, as `rails notes` prints. */
export function formatNotes(notes: readonly Note[]): string {
	let width = Math.max(0, ...notes.map((note) => String(note.line).length));
	let groups = new Map<string, Note[]>();
	for (let note of notes) groups.set(note.file, [...(groups.get(note.file) ?? []), note]);
	let blocks = [...groups].map(([file, entries]) => {
		let lines = entries.map((note) => {
			let text = note.text === "" ? note.tag : `${note.tag}: ${note.text}`;
			return `  [${String(note.line).padStart(width)}] ${text}`;
		});
		return `${file}:\n${lines.join("\n")}`;
	});
	return `${blocks.join("\n\n")}\n`;
}
