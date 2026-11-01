/**
 * The `sdxc-jscontact` command line as a contract: `convert` between JSContact, vCard and
 * jCard, and `validate` a Card against RFC 9553. Help, usage errors and each handler's typed
 * `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The formats `convert` reads and writes, as `--from` and `--to` spell them. */
const FORMATS = ["jscontact", "vcard", "jcard"] as const;

/** The input document: a path, or stdin when it is `-` or left out. */
const FILE = argument(s.string(), {
	default: "-",
	description: "The file to read; - or nothing reads stdin",
});

/** Every command `sdxc-jscontact` takes. */
export const JSCONTACT_COMMANDS = commands({
	description: "sdxc-jscontact — JSContact, vCard and jCard contacts",
	convert: command({
		description:
			"Convert contacts between JSContact, vCard and jCard, writing the result to stdout. The input format is detected unless --from names it.",
		arguments: { file: FILE },
		flags: {
			to: flag.string("to", {
				required: true,
				valueName: FORMATS.join("|"),
				schema: s.enum_(FORMATS),
				description: "The format to write",
			}),
			from: flag.string("from", {
				valueName: FORMATS.join("|"),
				schema: s.enum_(FORMATS),
				description: "The format to read (default: detected)",
			}),
		},
		examples: [
			"convert contact.vcf --to jscontact",
			"convert card.json --to vcard > contact.vcf",
			"convert - --from jcard --to jscontact < entity.json",
		],
	}),
	validate: command({
		description:
			"Validate JSContact Cards against RFC 9553 and RFC 9982. Exits 1 and lists every problem when a Card is invalid.",
		arguments: { file: FILE },
		flags: {
			json: flag.boolean("json", { description: "Print the report as JSON" }),
		},
		examples: ["validate card.json", "validate cards.json --json"],
	}),
});
