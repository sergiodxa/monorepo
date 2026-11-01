/**
 * The `sdxc-qr` command line as a contract: `encode [text]` with the encoder's level, version,
 * mask and quiet-zone options as flags. Help, usage errors and the handler's typed `ctx.flags`
 * all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-qr` takes. */
export const QR_COMMANDS = commands({
	description: "sdxc-qr — QR codes as SVG or PNG",
	encode: command({
		description:
			"Encode text as the smallest QR code that holds it. Reads stdin when the text is - or absent, dropping one trailing newline.",
		arguments: {
			text: argument(s.string(), { optional: true, description: "The text to encode, or -" }),
		},
		flags: {
			output: flag.string("output", {
				short: "o",
				valueName: "file",
				description: "Write the image to this file instead of stdout",
				heading: "Output",
			}),
			png: flag.boolean("png", {
				description: "Write a PNG instead of an SVG; needs --output",
				heading: "Output",
			}),
			margin: flag.number("margin", {
				valueName: "N",
				default: 4,
				schema: s.number().refine((n) => Number.isInteger(n) && n >= 0, "expects N ≥ 0"),
				description: "Light modules around the code",
				heading: "Output",
			}),
			scale: flag.number("scale", {
				valueName: "N",
				default: 8,
				schema: s.number().refine((n) => Number.isInteger(n) && n >= 1, "expects N ≥ 1"),
				description: "Pixels a side for one module",
				heading: "Output",
			}),
			level: flag.string("level", {
				valueName: "L|M|Q|H",
				default: "M",
				schema: s.enum_(["L", "M", "Q", "H"]),
				description: "The minimum error correction level",
				heading: "Encoding",
			}),
			boostLevel: flag.boolean("boost-level", {
				default: true,
				description: "Raise the level while the chosen version still holds the text",
				heading: "Encoding",
			}),
			minVersion: flag.number("min-version", {
				valueName: "1-40",
				default: 1,
				description: "The smallest version to try",
				heading: "Encoding",
			}),
			maxVersion: flag.number("max-version", {
				valueName: "1-40",
				default: 40,
				description: "The largest version to try; longer text fails",
				heading: "Encoding",
			}),
			mask: flag.number("mask", {
				valueName: "0-7",
				description: "A fixed mask instead of the one with the lowest penalty",
				heading: "Encoding",
			}),
		},
		examples: [
			'encode "https://example.com" > code.svg',
			"encode --level H --margin 6 --png -o label.png PKG-000123",
			"cat otpauth.txt | encode --max-version 10 -o enrol.svg",
		],
	}),
});
