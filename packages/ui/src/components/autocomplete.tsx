/**
 * A text field with a styled suggestion list under it, for a "Where are you going?" box or an
 * address field. The server renders a plain input with a native `<datalist>`, and the
 * {@link AutocompleteSync} island upgrades it to a combobox over a filtered, iconed listbox.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { pb, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, truncate } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { autocomplete } from "../mixins/autocomplete.js";
import { floatingSurface, surfaceInset } from "../styles/floating-surface.js";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name.js";

import { Input } from "./input.js";

export { AUTOCOMPLETE_SELECT_EVENT } from "../mixins/autocomplete.js";
export type { AutocompleteSelectDetail } from "../mixins/autocomplete.js";

/** What the list says when the typed text matches no option and the caller names nothing. */
const DEFAULT_EMPTY_LABEL = "No matches";

/** Prop types for {@link Autocomplete}. */
export namespace Autocomplete {
	/** One suggestion: what the hidden field submits, what the field shows, and how it reads. */
	export interface Option {
		/** Submitted through `valueName` when picked, such as a place id. */
		value: string;
		/** Shown in the list and written into the field when picked. */
		label: string;
		/** A second line under the label, also searched as the reader types. */
		description?: string;
		/** A glyph before the label, such as an icon from `@sdxc/icons`. */
		icon?: RemixNode;
	}

	/** Per-part styling for the elements the autocomplete composes. */
	export interface PartsProps {
		/** The text field. */
		input?: TagProps<"input">["mix"];
		/** The floating list surface. */
		list?: TagProps<"div">["mix"];
		/** Every option row. */
		option?: TagProps<"div">["mix"];
	}

	/**
	 * Every native `<input>` attribute but the ones the combobox owns, which land on the field;
	 * `mix` styles the wrapper around the field and its list.
	 */
	export interface Props extends Omit<
		TagProps<"input">,
		"type" | "list" | "role" | "children" | "mix" | "value" | "color"
	> {
		/** The field's `id`, from which every other id the autocomplete needs derives. */
		id: string;
		/** The field's accessible name; pass `aria-labelledby` instead to point at a visible label. */
		label?: string;
		/** The suggestions, in the order the list shows them. */
		options: Array<Option>;
		/** Shown at the top of the list while the field is empty, such as "Suggested destinations". */
		heading?: RemixNode;
		/** Shown in the list when nothing matches. @default "No matches" */
		emptyLabel?: RemixNode;
		/** Names a hidden field carrying the picked option's `value`, emptied once the text is edited. */
		valueName?: string;
		/**
		 * `"field"` draws the bordered input; `"bare"` drops its border, background, padding and focus
		 * ring, for a field set inside a pill that draws them with `:focus-within`.
		 * @default "field"
		 */
		variant?: "field" | "bare";
		/** Styling for the wrapper. */
		mix?: TagProps<"div">["mix"];
		/** Per-part styling. */
		parts?: PartsProps;
	}
}

/**
 * Renders the field, its `<datalist>`, a hidden list of styled options and the island that
 * swaps one for the other. Picking fires `change` and an `autocomplete-select` event on the
 * field with `{ value, label }`; Enter on an option never submits the form.
 *
 * @example
 * <Autocomplete id="where" name="where" label="Where to?" heading="Suggested destinations"
 * 	valueName="placeId" options={[{ value: "lis", label: "Lisbon", description: "Portugal" }]} />
 * @example
 * <Autocomplete id="q" name="q" variant="bare" aria-labelledby="where-label" options={places} />
 */
export function Autocomplete(handle: Handle<Autocomplete.Props>) {
	return () => {
		let {
			id,
			label,
			options,
			heading,
			emptyLabel = DEFAULT_EMPTY_LABEL,
			valueName,
			variant = "field",
			mix,
			parts,
			autoComplete = "off",
			...rest
		} = handle.props;
		let labelledBy = rest["aria-labelledby"];

		warnIfNoAccessibleLabel(
			{ "aria-label": label, "aria-labelledby": labelledBy },
			"Autocomplete: pass `label` or `aria-labelledby` so the field and its list have a name.",
		);

		return (
			<div
				data-slot="autocomplete"
				data-variant={variant}
				mix={mergeMix([raw({ position: "relative", inlineSize: "100%", minInlineSize: "0" })], mix)}
			>
				<Input
					{...rest}
					id={id}
					aria-label={label}
					autoComplete={autoComplete}
					list={`${id}-suggestions`}
					data-autocomplete-input=""
					mix={mergeMix(
						[
							raw({ minInlineSize: "0", textOverflow: "ellipsis" }),
							when('[data-variant="bare"] > &', [
								raw({
									borderWidth: "0",
									backgroundColor: "transparent",
									paddingInline: "0",
									outline: "none",
									boxShadow: "none",
								}),
							]),
						],
						parts?.input,
					)}
				/>
				{valueName ? (
					<input type="hidden" name={valueName} value="" data-autocomplete-value="" />
				) : null}
				<datalist id={`${id}-suggestions`}>
					{options.map((option) => (
						<option value={option.label} />
					))}
				</datalist>
				<div
					id={`${id}-popup`}
					popover="manual"
					data-autocomplete-popup=""
					mix={mergeMix(
						[
							floatingSurface(),
							surfaceInset(),
							raw({
								position: "fixed",
								inset: "auto",
								margin: "0",
								boxSizing: "border-box",
								overflowY: "auto",
								overscrollBehavior: "contain",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
							when("&:not(:popover-open)", raw({ display: "none !important" })),
						],
						parts?.list,
					)}
				>
					{heading ? (
						<div
							id={`${id}-heading`}
							data-autocomplete-heading=""
							mix={[
								pi(3),
								raw({
									paddingBlock: "0.375rem",
									fontSize: "0.75rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{heading}
						</div>
					) : null}
					<div
						id={`${id}-listbox`}
						role="listbox"
						aria-label={label}
						aria-labelledby={labelledBy}
						data-autocomplete-listbox=""
					>
						{options.map((option, index) => (
							<AutocompleteOption
								id={`${id}-option-${index}`}
								option={option}
								mix={parts?.option}
							/>
						))}
					</div>
					<div
						data-autocomplete-empty=""
						hidden
						mix={[pi(3), pb(2), text("sm"), fg("neutral.muted")]}
					>
						{emptyLabel}
					</div>
				</div>
				<AutocompleteSync />
			</div>
		);
	};
}

/**
 * One row of the list: the icon in a tinted square, the label over its description, both
 * truncating so a long place name never widens the list. A row is at least the pointer
 * target size tall, which grows to 44px on a touch screen.
 */
function AutocompleteOption(
	handle: Handle<{ id: string; option: Autocomplete.Option; mix?: TagProps<"div">["mix"] }>,
) {
	return () => {
		let { id, option, mix } = handle.props;

		return (
			<div
				id={id}
				role="option"
				aria-selected="false"
				data-autocomplete-option=""
				data-value={option.value}
				data-label={option.label}
				data-description={option.description}
				mix={mergeMix(
					[
						hstack({ align: "center", gap: 3 }),
						rounded("md"),
						pi(3),
						pb(1.5),
						cursor("default"),
						raw({
							minBlockSize: "max(2.75rem, var(--ui-target-size))",
							scrollMarginBlock: "0.25rem",
						}),
						hover(bg("neutral.bg-tint-hover")),
						when('&[aria-selected="true"]', [bg("brand.bg-tint-pressed")]),
						when("&[hidden]", raw({ display: "none" })),
						when(
							"& mark",
							raw({ backgroundColor: "transparent", color: "inherit", fontWeight: "700" }),
						),
					],
					mix,
				)}
			>
				{option.icon ? (
					<span
						aria-hidden="true"
						mix={[
							rounded("md"),
							bg("neutral.bg-tint-hover"),
							fg("neutral"),
							raw({
								display: "grid",
								placeItems: "center",
								flexShrink: "0",
								inlineSize: "2rem",
								blockSize: "2rem",
								"& svg": { inlineSize: "1rem", blockSize: "1rem" },
							}),
						]}
					>
						{option.icon}
					</span>
				) : null}
				<span mix={[raw({ display: "grid", minInlineSize: "0", flex: "1" })]}>
					<span data-autocomplete-label="" mix={[truncate(), text("sm"), fg("neutral.emphasis")]}>
						{option.label}
					</span>
					{option.description ? (
						<span
							data-autocomplete-description=""
							mix={[truncate(), text("xs"), fg("neutral.muted")]}
						>
							{option.description}
						</span>
					) : null}
				</span>
			</div>
		);
	};
}

/**
 * The island inside every {@link Autocomplete}: once hydrated it drops the field's datalist,
 * makes the field a combobox and opens the styled list on focus and typing. It renders only a
 * hidden marker, so the field and options stay server markup styled by the caller's mixins.
 *
 * @example <AutocompleteSync />
 */
export const AutocompleteSync: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/autocomplete#AutocompleteSync",
	function AutocompleteSync() {
		return () => <span hidden mix={[autocomplete()]} />;
	},
);
