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

import { attrs, css } from "remix/ui";

import { visuallyHiddenInput } from "../styles/visually-hidden-input";

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
					css({
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",

						'&[data-orientation="horizontal"]': {
							flexDirection: "row",
							gap: "1rem",
						},
					}),
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
					css({
						display: "flex",
						cursor: "default",
						alignItems: "center",
						gap: "0.5rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						color: "var(--ui-neutral-fg-emphasis)",

						"&:has(input:disabled)": {
							cursor: "not-allowed",
							opacity: 0.5,
						},
					}),
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
					mix={[visuallyHiddenInput(), parts?.input]}
				/>
				<span
					data-slot="indicator"
					mix={[
						css({
							position: "relative",
							display: "flex",
							flexShrink: 0,
							alignItems: "center",
							justifyContent: "center",
							inlineSize: "var(--ui-radio-size, 1.25rem)",
							blockSize: "var(--ui-radio-size, 1.25rem)",
							borderRadius: "var(--ui-radius-full, 9999px)",
							borderWidth: "2px",
							borderStyle: "solid",
							borderColor: "var(--ui-neutral-border-strong)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							transitionProperty: "background-color, border-color",
							transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
							transitionDuration: "150ms",

							"&::after": {
								content: '""',
								inlineSize: "var(--ui-radio-mark-size, 0.625rem)",
								blockSize: "var(--ui-radio-mark-size, 0.625rem)",
								borderRadius: "var(--ui-radius-full, 9999px)",
								backgroundColor: "var(--ui-primary-fg-on-solid)",
								transform: "scale(0)",
								transitionProperty: "transform",
								transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
								transitionDuration: "150ms",
							},

							"input:checked ~ &": {
								borderColor: "var(--ui-primary-bg-solid)",
								backgroundColor: "var(--ui-primary-bg-solid)",
							},
							"input:checked ~ &::after": {
								transform: "scale(1)",
							},
							"input:focus-visible ~ &": {
								outlineWidth: "2px",
								outlineStyle: "solid",
								outlineOffset: "2px",
								outlineColor: "var(--ui-primary-ring)",
							},
						}),
						parts?.indicator,
					]}
				/>
				{children}
			</label>
		);
	};
};
