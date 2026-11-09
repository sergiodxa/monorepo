/**
 * The `sdxc-epub check` handler: runs the whole build, reads and downloads included, and writes
 * nothing. A book that breaks a rule exits 1 naming the file or chapter to fix, so CI can hold
 * a book's sources to what reading systems open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { errorJson } from "./cli-build.js";
import { EPUB_COMMANDS } from "./cli-contract.js";
import { describeFailure, locateBook, prepareBook } from "./cli-source.js";
import { EPUB } from "./epub.js";
import { EpubError } from "./errors.js";

/** Prints `{ valid, chapters }` or `{ valid: false, error }` with `--json`, a line on stderr otherwise. */
export default createCommand(EPUB_COMMANDS.check, async (ctx) => {
	let location = await locateBook(ctx, ctx.arguments.book);
	if (isFailure(location)) return location;

	let prepared = await prepareBook(ctx, location.data, ctx.flags);
	if (isFailure(prepared) && !(prepared.error instanceof EpubError)) return prepared;
	let built = isFailure(prepared) ? prepared : EPUB.build(prepared.data.book.input);

	if (isFailure(built)) {
		let error = built.error;
		if (!(error instanceof EpubError)) return built;
		if (ctx.flags.json) {
			ctx.stdout(`${JSON.stringify({ valid: false, error: errorJson(error) }, null, "\t")}\n`);
		}
		return exit(1, describeFailure(error));
	}

	let pages = built.data.files.filter((file) => file.path.startsWith("EPUB/text/")).length;
	if (ctx.flags.json) ctx.stdout(`${JSON.stringify({ valid: true, pages }, null, "\t")}\n`);
	else ctx.stderr(`${location.data.name} builds a valid EPUB of ${pages} pages\n`);
	return success();
});
