/**
 * Technical-sounding filler: the vocabulary a mock console or a joke ticket
 * needs when the words have to look like a system without meaning anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset.js";
import type { Random } from "../random.js";

/** Sentence shapes a phrase is built from, filled by the module below. */
const PHRASES = [
	"If we {verb} the {noun}, we can {verb} the {adjective} {abbreviation} {noun}!",
	"We need to {verb} the {adjective} {abbreviation} {noun}!",
	"Try to {verb} the {abbreviation} {noun}, maybe it will {verb} the {adjective} {noun}!",
	"You can't {verb} the {noun} without {ingverb} the {adjective} {abbreviation} {noun}!",
	"Use the {adjective} {abbreviation} {noun}, then you can {verb} the {adjective} {noun}!",
	"The {abbreviation} {noun} is down, {verb} the {adjective} {noun} so we can {verb} the {abbreviation} {noun}!",
	"{ingverb} the {noun} won't do anything, we need to {verb} the {adjective} {abbreviation} {noun}!",
] as const;

/** Technical words and the sentences built from them. */
export interface HackerModule {
	/** An acronym, such as `"SSL"`. */
	abbreviation(): string;
	/** A qualifier, such as `"redundant"`. */
	adjective(): string;
	/** A thing, such as `"bandwidth"`. */
	noun(): string;
	/** An action, such as `"parse"`. */
	verb(): string;
	/** An action in its `-ing` form, such as `"parsing"`. */
	ingverb(): string;
	/** A whole sentence built from the words above. */
	phrase(): string;
}

/** Create the `hacker` module over one stream and dataset. */
export function createHackerModule(random: Random, data: Dataset): HackerModule {
	let hacker: HackerModule = {
		abbreviation() {
			return random.pick(data.hackerAbbreviations);
		},
		adjective() {
			return random.pick(data.hackerAdjectives);
		},
		noun() {
			return random.pick(data.hackerNouns);
		},
		verb() {
			return random.pick(data.hackerVerbs);
		},
		ingverb() {
			return random.pick(data.hackerIngverbs);
		},
		phrase() {
			return random.pick(PHRASES).replace(/\{(\w+)\}/g, (whole, slot: string) => {
				if (slot === "verb") return hacker.verb();
				if (slot === "noun") return hacker.noun();
				if (slot === "adjective") return hacker.adjective();
				if (slot === "abbreviation") return hacker.abbreviation();
				if (slot === "ingverb") return hacker.ingverb();
				return whole;
			});
		},
	};

	return hacker;
}
