/**
 * Merges the groups a keyboard help sheet is rendered with and the rows the page's shortcut
 * registry holds, so a shortcut registered in the browser still reaches the sheet the server
 * drew, and one listed in both appears once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Shortcuts } from "../behaviors/shortcuts.js";
import type { KeyboardHelp } from "../keyboard-help.js";

import { shortcutAlternatives } from "../behaviors/shortcuts.js";

/**
 * Merges the server's groups with the registry's rows, keeping the server's order and appending
 * rows and groups it lacks; a row already listed with the same keys and label appears once.
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
	let merged = groups.map((group) => ({ title: group.title, shortcuts: [...group.shortcuts] }));
	let seen = new Set(
		merged.flatMap((group) =>
			group.shortcuts.map((row) => `${shortcutAlternatives(row.keys).join(",")}|${row.label}`),
		),
	);

	for (let entry of entries) {
		let id = `${entry.keys.join(",")}|${entry.label}`;
		if (seen.has(id)) continue;
		seen.add(id);
		let title = entry.group ?? other;
		let group = merged.find((candidate) => candidate.title === title);
		if (group === undefined) {
			group = { title, shortcuts: [] };
			merged.push(group);
		}
		group.shortcuts.push({ keys: entry.keys, label: entry.label });
	}

	return merged.filter((group) => group.shortcuts.length > 0);
}
