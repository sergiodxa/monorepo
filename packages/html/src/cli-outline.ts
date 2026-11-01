/**
 * The `sdxc-html outline` handler: loads a page and lists its headings and landmarks in
 * document order, which is how a reader of a screen reader skims it. Roles come from the
 * package's queries, so an explicit `role` and an implicit one read the same.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { HTML_COMMANDS } from "./cli-contract.js";
import { loadPage } from "./cli-source.js";

import type { HTML } from "./index.js";

/** The ARIA landmark roles; `form` and `region` take the role only with an accessible name. */
const LANDMARK_ROLES = new Set([
	"banner",
	"complementary",
	"contentinfo",
	"form",
	"main",
	"navigation",
	"region",
	"search",
]);

/** One outline entry; `level` is set on headings alone. */
interface OutlineEntry {
	kind: "heading" | "landmark";
	role: string;
	tag: string;
	name: string;
	level?: number | undefined;
}

/** A heading's level: `aria-level` when it is a positive integer, else the `h1`–`h6` digit, else 2. */
function headingLevel(element: HTML.Element): number {
	let explicit = Number(element.attributes["aria-level"]);
	if (Number.isInteger(explicit) && explicit > 0) return explicit;
	let match = /^h([1-6])$/.exec(element.tag);
	return match ? Number(match[1]) : 2;
}

/**
 * Prints landmarks as `[role] "name"` and headings as `hN name`, indented by level; `--json`
 * prints the entries as an array. A page with neither prints nothing and still exits 0.
 */
export default createCommand(HTML_COMMANDS.outline, async (ctx) => {
	let page = await loadPage(ctx, ctx.arguments.source);
	if (isFailure(page)) return page;

	let entries: OutlineEntry[] = [];
	for (let element of page.data.queryAll()) {
		if (element.role === "heading") {
			entries.push({
				kind: "heading",
				role: "heading",
				tag: element.tag,
				name: element.name,
				level: headingLevel(element),
			});
		} else if (element.role !== undefined && LANDMARK_ROLES.has(element.role)) {
			entries.push({ kind: "landmark", role: element.role, tag: element.tag, name: element.name });
		}
	}

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify(entries)}\n`);
		return success();
	}

	for (let entry of entries) {
		if (entry.kind === "landmark") {
			let name = entry.name.length > 0 ? ` "${entry.name}"` : "";
			ctx.stdout(`[${entry.role}]${name}\n`);
		} else {
			let level = entry.level ?? 2;
			ctx.stdout(`${"  ".repeat(level - 1)}h${String(level)} ${entry.name}\n`);
		}
	}
	return success();
});
