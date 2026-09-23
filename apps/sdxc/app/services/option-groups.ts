/**
 * Named option groups: the axes of choice a page offers more than once — package
 * manager today — and the compact encoding that carries the reader's pick between the
 * server and the browser. One cookie holds every group, so a reader with several
 * choices still sends a single short pair list on every request, assets included.
 *
 * The values here arrive from a cookie, which is the reader's to edit, so a name or a
 * value the site does not offer is dropped on read and the group falls back to its
 * first option.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MANAGERS } from "~/app/services/install-command";

/** Every axis a block may belong to. A tag naming one outside this list is a parse error. */
export const OPTION_GROUP_NAMES = ["package-manager"] as const;

export type OptionGroupName = (typeof OPTION_GROUP_NAMES)[number];

/**
 * What each group offers, in the order its strip reads. The first option is what a
 * reader who has chosen nothing gets, on the server and in the browser alike.
 */
export const OPTION_GROUPS: Record<OptionGroupName, readonly [string, ...string[]]> = {
	"package-manager": MANAGERS,
};

/** One option per group the reader has picked, keyed by group name. */
export type OptionSelections = ReadonlyMap<OptionGroupName, string>;

/** The cookie every group shares, written by the browser and read on both sides. */
export const OPTIONS_COOKIE_NAME = "sdxc:options";

/** How long a choice outlives the visit it was made in. */
export const OPTIONS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Separates one group's pair from the next. */
const PAIR_SEPARATOR = "|";

/** Separates a group's name from the option chosen in it. */
const NAME_SEPARATOR = ":";

/**
 * Whether a string names a group this site offers.
 *
 * @param value - A name read from a cookie or from the DOM.
 * @returns True when the name is one of {@link OPTION_GROUP_NAMES}.
 */
export function isOptionGroupName(value: string): value is OptionGroupName {
	return OPTION_GROUP_NAMES.includes(value);
}

/**
 * Reads the pair list into a map, keeping only the pairs this site offers.
 *
 * @param value - The decoded cookie value, or nothing when no cookie was sent.
 * @returns The groups the reader has chosen in, which is empty for a value that
 * carries nothing this site recognises.
 * @example parseOptionSelections("package-manager:bun").get("package-manager") // "bun"
 */
export function parseOptionSelections(value: string | null | undefined): OptionSelections {
	let selections = new Map<OptionGroupName, string>();
	if (!value) return selections;

	for (let pair of value.split(PAIR_SEPARATOR)) {
		let separator = pair.indexOf(NAME_SEPARATOR);
		if (separator === -1) continue;

		let name = pair.slice(0, separator);
		let option = pair.slice(separator + 1);

		if (!isOptionGroupName(name)) continue;
		if (!OPTION_GROUPS[name].includes(option)) continue;

		selections.set(name, option);
	}

	return selections;
}

/**
 * Writes the map back out as the pair list the cookie carries.
 *
 * @param selections - The groups the reader has chosen in.
 * @returns The value to store, such as `package-manager:bun`.
 */
export function serializeOptionSelections(selections: OptionSelections): string {
	return Array.from(selections, ([name, option]) => `${name}${NAME_SEPARATOR}${option}`).join(
		PAIR_SEPARATOR,
	);
}

/**
 * Records one group's option, leaving every other group as it was.
 *
 * @param selections - The groups the reader has chosen in so far.
 * @param name - The group being chosen in.
 * @param option - The option picked, which is kept only when the group offers it.
 * @returns The selections to store.
 */
export function selectOption(
	selections: OptionSelections,
	name: OptionGroupName,
	option: string,
): OptionSelections {
	if (!OPTION_GROUPS[name].includes(option)) return selections;
	return new Map(selections).set(name, option);
}

/**
 * The option a group renders as checked.
 *
 * @param selections - The groups the reader has chosen in, or nothing where the page
 * offers no selections at all.
 * @param name - The group being rendered.
 * @returns The reader's option, or the group's first one.
 * @example selectedOption(new Map(), "package-manager") // "npm"
 */
export function selectedOption(
	selections: OptionSelections | undefined,
	name: OptionGroupName,
): string {
	return selections?.get(name) ?? OPTION_GROUPS[name][0];
}
