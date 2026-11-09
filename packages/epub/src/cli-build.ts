/**
 * The `sdxc-epub build` handler: prepares the book through `fromMarkdown`, builds it with
 * `EPUB.build` and writes the file, beside the input unless `--output` says where. A book that
 * breaks a rule exits 2 with the file or chapter to fix, the rule's code and what is wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { EPUB_COMMANDS } from "./cli-contract.js";
import { describeFailure, locateBook, prepareBook } from "./cli-source.js";
import { EPUB } from "./epub.js";
import { EpubError } from "./errors.js";

/**
 * Writes the EPUB and reports it: a ✓ line on stderr, and with `--json` the chapters, files,
 * fonts and downloads on stdout, or `{ error }` when the book fails.
 */
export default createCommand(EPUB_COMMANDS.build, async (ctx) => {
	let location = await locateBook(ctx, ctx.arguments.book);
	if (isFailure(location)) return location;
	let target =
		ctx.flags.output === undefined ? location.data.output : resolve(ctx.cwd, ctx.flags.output);
	if (target === undefined) return exit(2, "Pass --output when the book comes from stdin");

	let prepared = await prepareBook(ctx, location.data, ctx.flags);
	if (isFailure(prepared)) {
		if (!(prepared.error instanceof EpubError)) return prepared;
		if (ctx.flags.json)
			ctx.stdout(`${JSON.stringify({ error: errorJson(prepared.error) }, null, "\t")}\n`);
		return exit(2, describeFailure(prepared.error));
	}

	let nearby = relative(ctx.cwd, target);
	let shown = nearby === "" || nearby.startsWith("..") ? target : nearby;
	let written = await ctx.task(`Building ${shown}`, async (task) => {
		let built = EPUB.build(prepared.data.book.input);
		if (isFailure(built)) return built;
		let bytes = await built.data.bytes();
		if (isFailure(bytes)) return bytes;
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, bytes.data);
		let { chapters } = prepared.data.book.input;
		task.update(`Wrote ${shown}: ${chapters.length} pages, ${size(bytes.data.byteLength)}`);
		return bytes.data.byteLength;
	});
	if (isFailure(written)) {
		let error = written.error;
		if (ctx.flags.json && error instanceof EpubError) {
			ctx.stdout(`${JSON.stringify({ error: errorJson(error) }, null, "\t")}\n`);
		}
		return exit(
			2,
			error instanceof EpubError
				? describeFailure(error)
				: `Cannot write ${shown}: ${error.message}`,
		);
	}

	if (ctx.flags.json) {
		let { input, fonts, downloads } = prepared.data.book;
		let report = {
			output: target,
			bytes: written.data,
			chapters: input.chapters.map((chapter) => ({
				id: chapter.id,
				title: chapter.title,
				toc: chapter.toc !== false,
			})),
			files: [
				...(input.styles ?? []).map((style) => style.path),
				...(input.cover ? [input.cover.image.path] : []),
				...(input.resources ?? []).map((resource) => resource.path),
			],
			fonts,
			downloads,
		};
		ctx.stdout(`${JSON.stringify(report, null, "\t")}\n`);
	}
	return success();
});

/** An `EpubError` as the `--json` report carries it. */
export function errorJson(error: EpubError): { code: string; path?: string; message: string } {
	return { code: error.code, path: error.path, message: error.message };
}

/** A byte count as a person reads it. */
function size(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
