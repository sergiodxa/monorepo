/**
 * The `sdxc-distill extract` handler: retrieves a URL with `distill`, or reads a saved page with
 * `distillFrom`, and prints the article as sanitized HTML, readable text or JSON. A page with no
 * article is a finding, so it exits 1; an unreadable file exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createCommand, exit, success } from "@sdxc/cli";
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

import { DISTILL_COMMANDS } from "./cli-contract.js";

import type { Distill } from "./index.js";

import { distill, distillFrom } from "./index.js";

/** Whether the argument names a page to retrieve rather than a file to read. */
function isAddress(source: string): boolean {
	return /^https?:\/\//iu.test(source);
}

/** The article as the chosen format prints it, ending in a newline. */
function render(article: Distill.Article, format: string): string {
	if (format === "json") return `${JSON.stringify(article, null, 2)}\n`;
	if (format === "text") {
		let body = HTML.parse(article.html);
		let text = isFailure(body) ? "" : body.data.text;
		let heading = [article.title, article.byline].filter((line) => line !== null).join("\n");
		return `${heading === "" ? "" : `${heading}\n\n`}${text}\n`;
	}
	return `${article.html}\n`;
}

/**
 * Prints the article to stdout; every failure goes to stderr with the outcome the library
 * reported, so a script can tell a refusal from an empty page.
 */
export default createCommand(DISTILL_COMMANDS.extract, async (ctx) => {
	let source = ctx.arguments.source;
	let format = ctx.flags.json ? "json" : ctx.flags.format;

	if (isAddress(source)) {
		let article = await distill(source, { userAgent: ctx.flags.userAgent, signal: ctx.signal });
		if (isFailure(article)) return exit(1, `${article.error.outcome}: ${article.error.message}`);
		ctx.stdout(render(article.data, format));
		return success();
	}

	let markup: string;
	try {
		markup =
			source === "-" ? await ctx.stdin.text() : await readFile(resolve(ctx.cwd, source), "utf8");
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot read ${source}: ${reason}`);
	}

	let article = distillFrom(markup, ctx.flags.url ?? "https://localhost/");
	if (isFailure(article)) return exit(1, `${article.error.outcome}: ${article.error.message}`);
	ctx.stdout(render(article.data, format));
	return success();
});
