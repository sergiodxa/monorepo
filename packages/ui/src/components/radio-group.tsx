/**
 * A set of mutually exclusive options built from native `<input
 * type="radio">` controls sharing one grouping name, rendered as a
 * `role="radiogroup"` host wrapping a run of {@link RadioGroup.Radio}
 * instances. Each option pairs a visually hidden native input — carrying
 * every focus, keyboard, and form-submission semantic the platform already
 * provides — with a styled visual indicator that reads the input's own
 * `:checked` and `:focus-visible` states through sibling selectors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, fg, outline } from "@pkg/u/color";
import { opacity, rounded, transition } from "@pkg/u/effects";
import { cursor, pseudoContent } from "@pkg/u/general";
import { flex, flexCol, flexRow, gap, items, justify, relative, shrink } from "@pkg/u/layout";
import { bs, is } from "@pkg/u/size";
import { after, precededBy, when } from "@pkg/u/state";
import { scale } from "@pkg/u/transform";
import { text } from "@pkg/u/typography";
import { attrs } from "remix/ui";

/**
 * `role="radiogroup"` applied through {@link attrs} unless a consumer
 * supplies its own `role`, announcing the host as a radio group landmark to
 * assistive technology.
 */
const DEFAULT_ROLE = "radiogroup";

/**
 * Default {@link RadioGroup.Props} orientation, applied when `orientation`
 * is omitted, laying options out in a single column.
 */
const DEFAULT_ORIENTATION: RadioGroup.Orientation = "vertical";

/**
 * Prop types for {@link RadioGroup} and its {@link RadioGroup.Radio}
 * compound part.
 */
export namespace RadioGroup {
	/**
	 * Axis a group's options lay out along: a single column, or a single row.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Value {@link RadioGroup} stores in component context so every
	 * {@link RadioGroup.Radio} nested inside shares the same native grouping
	 * name without a consumer repeating it on each option.
	 */
	export interface Context {
		/** Shared `name` every {@link RadioGroup.Radio} reads unless it sets its own. */
		name: string;
	}

	/**
	 * Props accepted by {@link RadioGroup}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Native grouping name shared by every {@link RadioGroup.Radio} nested
		 * inside, provided through component context. Defaults to the group's
		 * own {@link Handle.id | stable instance id} when omitted, so options
		 * always group correctly even when a consumer never sets a name.
		 */
		name?: string;
		/** Layout axis. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
	}

	/**
	 * Props accepted by {@link RadioGroup.Radio}.
	 */
	export interface RadioProps extends Omit<TagProps<"label">, "children"> {
		/** Value submitted with the enclosing form when this option is selected. */
		value: string;
		/**
		 * Native grouping name for this option's underlying input. Defaults to
		 * the name provided by the nearest ancestor {@link RadioGroup} — set
		 * this only to opt a single option out of its group's shared name.
		 */
		name?: string;
		/** Whether this option starts selected, for a form that never tracks selection itself. */
		defaultChecked?: boolean;
		/** Whether this option is selected, for a form that tracks selection itself. */
		checked?: boolean;
		/** Whether this option is inert and excluded from the group's tab order. */
		disabled?: boolean;
		/** Marks the enclosing native radio group as requiring one option selected. */
		required?: boolean;
		/** The option's visible label text, associated with the input by native nesting. */
		children?: RemixNode;
		/**
		 * Per-part styling for the option's hidden `input` and visible
		 * `indicator` elements, layered after each part's own built-in
		 * styling. Use the `mix` prop instead to style the option's outer
		 * `<label>` host.
		 */
		parts?: {
			/** Additional mixin(s) applied to the hidden native `<input type="radio">`. */
			input?: TagProps<"input">["mix"];
			/** Additional mixin(s) applied to the visible indicator `<span>`. */
			indicator?: TagProps<"span">["mix"];
		};
	}
}

/**
 * Renders the group host: a `role="radiogroup"` `<div>` laying its
 * {@link RadioGroup.Radio} options out in a column by default, switching to
 * a row when `orientation` is `"horizontal"`. Every option nested inside
 * reads its shared native `name` from component context, defaulting to the
 * group's own stable identifier so grouping always works correctly even
 * when a consumer never sets `name` explicitly.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link RadioGroup.Context}.
 * @returns The render function producing the group's markup.
 * @example
 * <RadioGroup aria-label={t("shipping.method")}>
 * 	<RadioGroup.Radio value="standard">{t("shipping.standard")}</RadioGroup.Radio>
 * 	<RadioGroup.Radio value="express">{t("shipping.express")}</RadioGroup.Radio>
 * </RadioGroup>
 * @example
 * <RadioGroup aria-label={t("size.label")} orientation="horizontal">
 * 	<RadioGroup.Radio value="sm">{t("size.small")}</RadioGroup.Radio>
 * 	<RadioGroup.Radio value="md">{t("size.medium")}</RadioGroup.Radio>
 * 	<RadioGroup.Radio value="lg">{t("size.large")}</RadioGroup.Radio>
 * </RadioGroup>
 */
export function RadioGroup(handle: Handle<RadioGroup.Props, RadioGroup.Context>) {
	return () => {
		let { name, orientation, mix, ...rest } = handle.props;
		let resolvedName = name ?? handle.id;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;

		handle.context.set({ name: resolvedName });

		return (
			<div
				data-orientation={resolvedOrientation}
				aria-orientation={resolvedOrientation}
				{...rest}
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					flex(),
					flexCol(),
					when('&[data-orientation="horizontal"]', flexRow()),
					gap("0.5rem"),
					when('&[data-orientation="horizontal"]', gap("1rem")),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders a single option: a native `<label>` pairing a visually hidden
 * `<input type="radio">` with a styled visual indicator and the option's
 * label text. The hidden input carries every accessibility and form
 * semantic natively — focus, keyboard selection, native validation, form
 * submission — while the indicator reads the input's own `:checked` and
 * `:focus-visible` states through sibling selectors to render its filled
 * dot and focus ring, and the label reads the input's `:disabled` state
 * through `:has()` to dim itself, with no tracked state of its own.
 *
 * The input carries no `aria-checked` of its own, since its native
 * checkedness is what assistive technology reports; a hydrated island that
 * needs the attribute composes the `ariaChecked()` mixin through
 * `parts.input` on every option in the group, which keeps each one's token
 * rewritten from the live control as the selection moves between them.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props.
 * @returns The render function producing the option's markup.
 * @example
 * <RadioGroup.Radio value="dog">{t("pet.dog")}</RadioGroup.Radio>
 * @example
 * <RadioGroup.Radio value="cat" defaultChecked>{t("pet.cat")}</RadioGroup.Radio>
 * @example
 * <RadioGroup.Radio value="hamster" disabled>{t("pet.hamster")}</RadioGroup.Radio>
 */
RadioGroup.Radio = function RadioGroupRadio(handle: Handle<RadioGroup.RadioProps>) {
	return () => {
		let {
			value,
			name,
			checked,
			defaultChecked,
			disabled,
			required,
			children,
			parts,
			mix,
			...rest
		} = handle.props;
		let context = handle.context.get(RadioGroup);
		let resolvedName = name ?? context.name;

		return (
			<label
				{...rest}
				mix={[
					flex(),
					cursor("default"),
					items("center"),
					text("sm"),
					when("&:has(input:disabled)", [cursor("not-allowed"), opacity(50)]),
					gap("0.5rem"),
					fg("neutral.emphasis"),
					mix,
				]}
			>
				<input
					type="radio"
					id={handle.id}
					value={value}
					name={resolvedName}
					checked={checked}
					defaultChecked={defaultChecked}
					disabled={disabled}
					required={required}
					mix={[visuallyHidden(), parts?.input]}
				/>
				<span
					data-slot="indicator"
					mix={[
						relative(),
						flex(),
						shrink(),
						items("center"),
						justify("center"),
						is("var(--ui-radio-size, 1.25rem)"),
						bs("var(--ui-radio-size, 1.25rem)"),
						after([
							is("var(--ui-radio-mark-size, 0.625rem)"),
							bs("var(--ui-radio-mark-size, 0.625rem)"),
							rounded("full"),
							bg("brand.onSolid"),
							transition("transform"),
							pseudoContent('""'),
							scale(0),
						]),
						rounded("full"),
						border({ color: "neutral.strong", width: 2 }),
						bg("neutral.tint"),
						transition("background-color, border-color"),
						// `precededBy()` rather than a bare `when("input:checked ~ &", …)`:
						// the style serializer only recognizes a key as a nested selector
						// when it starts with `&`, `@`, `:`, `[` or `.`, so an element-first
						// selector is emitted as a *declaration* and the whole checked and
						// focus state silently never reaches the browser. `precededBy()`
						// leads with `:is(...)`, which is recognized, and `:is()` carries
						// its argument's specificity so matching is unchanged.
						precededBy("input:checked", after(scale(1))),
						precededBy("input:checked", [border("brand.solid"), bg("brand.solid")]),
						precededBy("input:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						parts?.indicator,
					]}
				/>
				{children}
			</label>
		);
	};
};
