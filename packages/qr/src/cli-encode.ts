/**
 * The `sdxc-qr encode` handler: reads the text, encodes it with `QR.encode`, and writes the
 * symbol as an SVG document or, through `@sdxc/png`, a PNG file. A summary of the symbol goes
 * to stderr when the image goes to a file, so stdout carries only the image.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createCommand, failure, success, usage } from "@sdxc/cli";
import { encode } from "@sdxc/png";
import { isFailure, wrap } from "@sdxc/result";

import type { QrLevel } from "./encode.js";

import { QR_COMMANDS } from "./cli-contract.js";
import { QR } from "./encode.js";

/**
 * A standalone SVG document: a white background under one black path, `scale` CSS pixels a
 * module, with crisp edges so a viewer never antialiases the seams between rows.
 *
 * @param qr - The symbol
 * @param margin - Light modules around it
 * @param scale - CSS pixels a module, for the document's width and height
 */
function svgDocument(qr: QR, margin: number, scale: number): string {
	let { d, viewBox, size } = qr.toSVGPath({ margin });
	let side = size * scale;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${side}" height="${side}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`;
}

/**
 * Encodes the argument, or stdin when it is `-` or absent; piped text loses one trailing
 * newline, since `echo` adds one nobody means to encode. Too-long text exits 1 with the bits
 * it needs; an out-of-range option or a terminal with nothing piped exits 2.
 */
export default createCommand(QR_COMMANDS.encode, async (ctx) => {
	let { output, png, margin, scale, level, boostLevel, minVersion, maxVersion, mask } = ctx.flags;
	if (png && output === undefined) {
		return usage("--png writes binary data, so it needs --output <file>");
	}

	let text = ctx.arguments.text;
	if (text === undefined || text === "-") {
		if (ctx.stdin.isTTY) return usage("Pass the text to encode, or pipe it on stdin");
		text = (await ctx.stdin.text()).replace(/\r?\n$/, "");
	}

	let encoded = QR.encode(text, {
		level: level as QrLevel,
		boostLevel,
		minVersion,
		maxVersion,
		mask,
	});
	if (isFailure(encoded)) {
		if (encoded.error.code === "invalid-options") return usage(encoded.error.message);
		return failure(encoded.error);
	}
	let qr = encoded.data;

	if (output === undefined) {
		ctx.stdout(svgDocument(qr, margin, scale));
		return success();
	}

	let bytes = png
		? await encode(qr.toImage({ margin, scale }))
		: new TextEncoder().encode(svgDocument(qr, margin, scale));
	let written = await wrap(() => writeFile(resolve(ctx.cwd, output), bytes));
	if (isFailure(written)) {
		return failure(new Error(`Could not write ${output}: ${written.error.message}`));
	}
	ctx.stderr(
		`Wrote ${output}: version ${qr.version}-${qr.level}, mask ${qr.mask}, ${qr.size} modules a side\n`,
	);
	return success();
});
