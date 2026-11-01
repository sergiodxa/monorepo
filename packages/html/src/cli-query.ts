/**
 * The `sdxc-html query` handler: loads a page and lists the elements matching a role and
 * accessible name. No match is the finding a smoke check exists for, so it exits 1 with the
 * names the page does carry under that role.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { HTML_COMMANDS } from "./cli-contract.js";
import { loadPage } from "./cli-source.js";

/**
 * Prints one `#position <tag> role "name"` line per match, or with `--json` the matches as an
 * array; an empty match set prints `[]` under `--json` and exits 1 either way.
 */
export default createCommand(HTML_COMMANDS.query, async (ctx) => {
	let page = await loadPage(ctx, ctx.arguments.source);
	if (isFailure(page)) return page;

	let selector = {
		role: ctx.flags.role,
		name: ctx.flags.name,
		includeHidden: ctx.flags.includeHidden,
	};
	let matches = page.data.queryAll(selector).map((element) => ({
		tag: element.tag,
		role: element.role,
		name: element.name,
		text: element.text,
		value: element.value,
		attributes: element.attributes,
		disabled: element.disabled,
		position: element.position,
	}));

	if (ctx.flags.json) ctx.stdout(`${JSON.stringify(matches)}\n`);
	else {
		for (let match of matches) {
			let name = match.name.length > 0 ? ` "${match.name}"` : "";
			ctx.stdout(`#${String(match.position)} <${match.tag}> ${match.role ?? ""}${name}\n`);
		}
	}

	if (matches.length > 0) return success();
	let missed = page.data.query(selector);
	return exit(1, isFailure(missed) ? missed.error.message : "No element matched.");
});
