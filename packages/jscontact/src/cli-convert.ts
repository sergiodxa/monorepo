/**
 * The `sdxc-jscontact convert` handler: reads contacts as JSContact, vCard or jCard and writes
 * them in another of the three to stdout. One contact in gives one out; several give a JSON
 * array, or one vCard after another. Input that does not read as its format exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { ContactFormat, VCard } from "./vcard.js";

import { JSCONTACT_COMMANDS } from "./cli-contract.js";
import { readInput } from "./cli-input.js";
import {
	detectFormat,
	fromVCard,
	parseVCard,
	readJCard,
	stringifyVCard,
	toVCard,
	writeJCard,
} from "./vcard.js";

import type { JSContact } from "./index.js";

import { parse } from "./index.js";

/**
 * The contacts of the input, kept in the model they were read into so a vCard written back as
 * jCard never passes through JSContact. `many` is whether the input held a list, which the
 * output keeps even for a list of one.
 */
type Contacts =
	| { model: "vcard"; cards: VCard[]; many: boolean }
	| { model: "jscontact"; cards: JSContact.Card[]; many: boolean };

/** The JSON value of `text`, or a failure that exits 2. */
function json(text: string): Result<unknown, ExitError> {
	try {
		return success(JSON.parse(text));
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `The input is not JSON: ${reason}`);
	}
}

/**
 * Reads `text` as `format`. A jCard document or a Card may arrive alone or in a JSON array;
 * the first one that does not read names its position in the array.
 */
function read(text: string, format: ContactFormat): Result<Contacts, ExitError> {
	if (format === "vcard") {
		let cards = parseVCard(text);
		if (isFailure(cards)) {
			let at = cards.error.line === null ? "" : ` at line ${cards.error.line}`;
			return exit(2, `Invalid vCard${at}: ${cards.error.message}`);
		}
		return success({ model: "vcard", cards: cards.data, many: cards.data.length !== 1 });
	}

	let value = json(text);
	if (isFailure(value)) return value;
	let many = Array.isArray(value.data) && !(format === "jcard" && value.data[0] === "vcard");
	let list: unknown[] = many && Array.isArray(value.data) ? value.data : [value.data];
	let label = (index: number) => (many ? ` ${index}` : "");

	if (format === "jcard") {
		let cards: VCard[] = [];
		for (let [index, entry] of list.entries()) {
			let card = readJCard(entry);
			if (isFailure(card)) return exit(2, `Invalid jCard${label(index)}: ${card.error.message}`);
			cards.push(card.data);
		}
		return success({ model: "vcard", cards, many });
	}

	let cards: JSContact.Card[] = [];
	for (let [index, entry] of list.entries()) {
		let card = parse(entry);
		if (isFailure(card)) {
			return exit(
				2,
				`Card${label(index)}: ${card.error.message}. Run validate to list every problem.`,
			);
		}
		cards.push(card.data);
	}
	return success({ model: "jscontact", cards, many });
}

/** `contacts` written as `format`, ending with a line break. */
function write(contacts: Contacts, format: ContactFormat): string {
	if (format === "jscontact") {
		let cards = contacts.model === "jscontact" ? contacts.cards : contacts.cards.map(fromVCard);
		return `${JSON.stringify(contacts.many ? cards : cards[0], null, 2)}\n`;
	}
	let vcards = contacts.model === "vcard" ? contacts.cards : contacts.cards.map(toVCard);
	if (format === "vcard") return stringifyVCard(vcards);
	let jcards = vcards.map(writeJCard);
	return `${JSON.stringify(contacts.many ? jcards : jcards[0], null, 2)}\n`;
}

/**
 * Writes the converted contacts to stdout. The input format is `--from` when given, else
 * detected from the text; text that matches none of the three is a usage error.
 */
export default createCommand(JSCONTACT_COMMANDS.convert, async (ctx) => {
	let text = await readInput(ctx.arguments.file, ctx);
	if (isFailure(text)) return text;
	let from = ctx.flags.from ?? detectFormat(text.data);
	if (from === null) {
		return usage("Cannot tell the input's format; name it with --from jscontact|vcard|jcard");
	}
	let contacts = read(text.data, from);
	if (isFailure(contacts)) return contacts;
	ctx.stdout(write(contacts.data, ctx.flags.to));
	return success();
});
