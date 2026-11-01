/**
 * The `sdxc-font` command line as a contract: `inspect` reports what a font file holds and
 * `subset` writes a smaller font with only the glyphs a text draws. Help, usage errors and each
 * handler's typed `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";

/**
 * A Standard Schema accepting the font path exactly as typed, so the package needs no schema
 * library for its one positional argument.
 */
const FONT_PATH = {
	"~standard": {
		version: 1 as const,
		vendor: "@sdxc/font",
		types: { input: "", output: "" },
		validate(value: unknown) {
			if (typeof value === "string") return { value };
			return { issues: [{ message: `expects a path; got ${JSON.stringify(value)}` }] };
		},
	},
};

/** The font argument both commands take: a path, or `-` and absent for stdin. */
function font() {
	return argument(FONT_PATH, {
		default: "-",
		description: "Path to a .ttf, .otf, .woff, .woff2, .ttc or .dfont file, or - for stdin",
	});
}

/** The `--json` flag every report-printing command takes. */
function json() {
	return flag.boolean("json", { description: "Print the report as JSON" });
}

/** Every command `sdxc-font` takes. */
export const FONT_COMMANDS = commands({
	description: "sdxc-font — inspect and subset fonts",
	inspect: command({
		description:
			"Print each font's names, metrics, glyph count, embedding permission, variable axes and color tables",
		arguments: { font: font() },
		flags: { json: json() },
		examples: ["inspect Inter.ttf", "inspect NotoSans.ttc --json", "inspect - < Inter.woff2"],
	}),
	subset: command({
		description:
			"Write a font holding only the glyphs a text draws, addressed by glyph id as a PDF embeds them; it maps no characters",
		arguments: { font: font() },
		flags: {
			text: flag.string("text", {
				valueName: "chars",
				description: "The characters to keep",
				heading: "Glyphs",
			}),
			textFile: flag.string("text-file", {
				valueName: "path",
				description: "A UTF-8 file whose characters to keep",
				heading: "Glyphs",
			}),
			name: flag.string("name", {
				valueName: "postscript-name",
				description: "The font of a collection to subset (default: the first)",
				heading: "Glyphs",
			}),
			instance: flag.string("instance", {
				valueName: "axes|name",
				description:
					"Fix a variable font first: axis values (wght=700,wdth=80) or a named instance (Bold)",
				heading: "Glyphs",
			}),
			output: flag.string("output", {
				short: "o",
				valueName: "path",
				description: "Write the subset here (default: stdout, when it is not a terminal)",
				heading: "Output",
			}),
			json: flag.boolean("json", {
				description: "Print the glyph id mapping as JSON; needs --output",
				heading: "Output",
			}),
		},
		examples: [
			'subset Inter.ttf --text "Hello" -o hello.ttf',
			"subset Mada-VF.ttf --text-file page.txt --instance wght=700 -o bold.ttf --json",
		],
	}),
});
