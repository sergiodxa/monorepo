/**
 * The `sdxc-sitemap list` handler: parses a sitemap, follows an index to its children with
 * `expand()`, and prints each page URL. Input that is not a sitemap, or a child that cannot be
 * fetched, exits 2, because the list it was asked for cannot be printed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { SITEMAP_COMMANDS } from "./cli-contract.js";
import { readSitemapInput } from "./cli-input.js";

import { Sitemap } from "./index.js";

/**
 * Prints one URL per line, or `--json` an array of `{ loc, lastmod }` in the order the sitemaps
 * list them, `lastmod` an ISO timestamp or `null`.
 */
export default createCommand(SITEMAP_COMMANDS.list, async (ctx) => {
	let input = await readSitemapInput(ctx, ctx.arguments.source);
	if (isFailure(input)) return input;

	let xml = XML.parse(input.data.source);
	if (isFailure(xml)) return exit(2, `${input.data.name}: ${xml.error.message}`);

	let sitemap = Sitemap.parse(xml.data);
	if (isFailure(sitemap)) return exit(2, `${input.data.name}: ${sitemap.error.message}`);

	let pages = await sitemap.data.expand({ signal: ctx.signal });
	if (isFailure(pages)) return exit(2, pages.error.message);

	let entries = [...pages.data.entries];
	if (ctx.flags.json) {
		let rows = entries.map((entry) => ({
			loc: entry.loc.href,
			lastmod: entry.updatedAt?.toISOString() ?? null,
		}));
		ctx.stdout(`${JSON.stringify(rows)}\n`);
		return success();
	}

	ctx.stdout(entries.map((entry) => `${entry.loc.href}\n`).join(""));
	return success();
});
