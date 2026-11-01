/**
 * Merges the groups a keyboard help sheet is rendered with and the rows the page's shortcut
 * registry holds, so a shortcut registered in the browser still reaches the sheet the server
 * drew, and keys listed twice, under any label, appear once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Shortcuts } from "../behaviors/shortcuts.js";
import type { KeyboardHelp } from "../keyboard-help.js";

import { shortcutAlternatives } from "../behaviors/shortcuts.js";

/** One alternative as a comparable key, its sequence steps joined by single spaces. */
function normalizeAlternative(alternative: string): string {
	return alternative
		.split(/\s+/)
		.filter((step) => step !== "")
		.join(" ");
}

/**
 * Merges the server's groups with the registry's rows, keeping the server's order and appending
 * rows and groups it lacks. Keys decide what a shortcut is: a row whose every alternative is
 * already listed is dropped, so the first label seen for those keys, the server's first, wins.
 *
 * @param groups The groups passed as props.
 * @param entries The registry's rows.
 * @param other The heading for rows that name no group.
 * @returns The groups the sheet shows, empty groups dropped.
 */
export function mergeShortcutGroups(
	groups: KeyboardHelp.Group[],
	entries: Shortcuts.Entry[],
	other: string,
): KeyboardHelp.Group[] {
	let merged: KeyboardHelp.Group[] = [];
	let seen = new Set<string>();

	let add = (title: string, row: KeyboardHelp.Shortcut) => {
		let alternatives = shortcutAlternatives(row.keys).map(normalizeAlternative);
		if (alternatives.every((key) => seen.has(key))) return;
		for (let key of alternatives) seen.add(key);
		let group = merged.find((candidate) => candidate.title === title);
		if (group === undefined) {
			group = { title, shortcuts: [] };
			merged.push(group);
		}
		group.shortcuts.push(row);
	};

	for (let group of groups) {
		if (!merged.some((candidate) => candidate.title === group.title)) {
			merged.push({ title: group.title, shortcuts: [] });
		}
		for (let row of group.shortcuts) add(group.title, row);
	}
	for (let entry of entries) add(entry.group ?? other, { keys: entry.keys, label: entry.label });

	return merged.filter((group) => group.shortcuts.length > 0);
}
