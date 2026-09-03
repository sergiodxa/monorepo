/**
 * A run of selectable option rows sharing one native grouping name — each
 * {@link ListBox.Item} pairs a visually hidden `<input type="radio">` or
 * `<input type="checkbox">` with its own visible content, so every focus,
 * keyboard, and form-submission semantic keeps coming from the platform
 * itself. The host renders as a scrollable column reading each option's
 * `:checked` and `:focus` state through a `:has()` selector to color the
 * whole row, with no selection state tracked anywhere in this module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg, outline } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { flex, gap, items } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { maxBs, p, pb, pi } from "@sdxc/u/size";
import { active, hover, when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition.js";
import { warnIfNoAccessibleName } from "../utils/warn-if-no-accessible-name.js";

import { SentinelRow } from "./sentinel-row.js";

/**
 * Default {@link ListBox.Props} selection cardinality, applied when
 * `multiple` is omitted, rendering every {@link ListBox.Item} as a native
 * `<input type="radio">` limiting the group to one selected option.
 */
const DEFAULT_MULTIPLE = false;

/**
 * Prop types for {@link ListBox} and its {@link ListBox.Item} compound part.
 */
export namespace ListBox {
	/**
	 * Value {@link ListBox} stores in component context so every
	 * {@link ListBox.Item} nested inside shares the same grouping name and
	 * selection cardinality without repeating them on each option.
	 */
	export interface Context {
		/** Shared `name` every {@link ListBox.Item} reads unless it sets its own. */
		name: string;
		/**
		 * Whether an option's underlying input renders as a checkbox (`true`,
		 * letting several options be selected at once) or a radio (`false`,
		 * limiting the group to a single selected option).
		 */
		multiple: boolean;
	}

	/**
	 * Props accepted by {@link ListBox}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Native grouping name shared by every {@link ListBox.Item} nested inside,
		 * provided through component context. Defaults to the group's own
		 * {@link Handle.id | stable instance id}, so options always group correctly.
		 */
		name?: string;
		/**
		 * Renders every option as a checkbox, allowing more than one selected
		 * at once, instead of the default mutually exclusive radio behavior.
		 * Defaults to {@link DEFAULT_MULTIPLE}.
		 */
		multiple?: boolean;
	}

	/**
	 * Props accepted by {@link ListBox.Item}.
	 */
	export interface ItemProps extends Omit<TagProps<"label">, "children"> {
		/** Value submitted with the enclosing form when this option is selected. */
		value: string;
		/**
		 * Native grouping name for this option's underlying input. Defaults to
		 * the name provided by the nearest ancestor {@link ListBox} — set this
		 * only to opt a single option out of its group's shared name.
		 */
		name?: string;
		/** Whether this option starts selected, for a form that never tracks selection itself. */
		defaultChecked?: boolean;
		/** Whether this option is selected, for a form that tracks selection itself. */
		checked?: boolean;
		/** Whether this option is inert and excluded from the group's tab order. */
		disabled?: boolean;
		/**
		 * Sets the underlying input's native `required` attribute. On a radio
		 * input this requires at least one option in the group be selected; on
		 * a checkbox input it requires this specific option be checked.
		 */
		required?: boolean;
		/** The option's visible content, associated with the input by native nesting. */
		children?: RemixNode;
		/**
		 * Per-part styling for the option's hidden `input` element, layered
		 * after its own built-in styling. Use the `mix` prop instead to style
		 * the option's outer `<label>` host.
		 */
		parts?: {
			/** Additional mixin(s) applied to the hidden native `<input>`. */
			input?: TagProps<"input">["mix"];
		};
	}

	/**
	 * Props accepted by {@link ListBox.LoadMoreItem}.
	 */
	export interface LoadMoreItemProps extends TagProps<"div"> {}
}

/**
 * Renders the group host: a `<div>` laying its {@link ListBox.Item} options
 * out as a scrollable column capped at a fixed block size, with `role`
 * defaulting to `"radiogroup"` for single selection or `"group"` for `multiple`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link ListBox.Context}.
 * @returns The render function producing the group's markup.
 * @example
 * <ListBox aria-label={t("settings.theme")}>
 * 	<ListBox.Item value="light" defaultChecked>{t("settings.themeLight")}</ListBox.Item>
 * 	<ListBox.Item value="dark">{t("settings.themeDark")}</ListBox.Item>
 * 	<ListBox.Item value="system">{t("settings.themeSystem")}</ListBox.Item>
 * </ListBox>
 * @example
 * <ListBox aria-label={t("settings.notifications")} multiple>
 * 	<Section aria-labelledby="notifications-heading">
 * 		<Header id="notifications-heading">{t("settings.channels")}</Header>
 * 		<ListBox.Item value="email" defaultChecked>{t("settings.email")}</ListBox.Item>
 * 		<ListBox.Item value="sms">{t("settings.sms")}</ListBox.Item>
 * 	</Section>
 * </ListBox>
 */
export function ListBox(handle: Handle<ListBox.Props, ListBox.Context>) {
	return () => {
		let { name, multiple, mix, ...rest } = handle.props;
		let resolvedName = name ?? handle.id;
		let resolvedMultiple = multiple ?? DEFAULT_MULTIPLE;

		handle.context.set({ name: resolvedName, multiple: resolvedMultiple });

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: resolvedMultiple ? "group" : "radiogroup" }),
					maxBs(60),
					overflow("auto"),
					p(1),
					outline("none"),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders a single option: a native `<label>` pairing a visually hidden
 * radio or checkbox input with the option's content. In dev mode, an
 * option with no accessible name logs a `console.warn`.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props.
 * @returns The render function producing the option's markup.
 * @example
 * <ListBox.Item value="dog">{t("pet.dog")}</ListBox.Item>
 * @example
 * <ListBox.Item value="cat" defaultChecked>{t("pet.cat")}</ListBox.Item>
 * @example
 * <ListBox.Item value="hamster" disabled>{t("pet.hamster")}</ListBox.Item>
 */
ListBox.Item = function ListBoxItem(handle: Handle<ListBox.ItemProps>) {
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
		let context = handle.context.get(ListBox);
		let resolvedName = name ?? context.name;
		let type: "checkbox" | "radio" = context.multiple ? "checkbox" : "radio";

		warnIfNoAccessibleName(
			handle.props,
			children,
			"ListBox.Item: an option with no visible text needs an `aria-label` describing it — assistive technology has no accessible name to announce otherwise.",
		);

		return (
			<label
				{...rest}
				mix={[
					interactiveTransition(),
					flex(),
					items("center"),
					gap(2),
					rounded("md"),
					pi(3),
					pb(2),
					fg("neutral.emphasis"),
					hover(bg("neutral.bg-tint-hover")),
					active(bg("neutral.bg-tint-pressed")),
					when("&:has(input:focus)", bg("brand.tint")),
					when('&:has(input:checked), &[aria-selected="true"]', [
						bg("brand.solid"),
						fg("brand.onSolid"),
					]),
					when('&:has(input:disabled), &[aria-disabled="true"]', opacity(50)),
					cursor("default"),
					text("sm"),
					outline("none"),
					mix,
				]}
			>
				<input
					type={type}
					value={value}
					name={resolvedName}
					checked={checked}
					defaultChecked={defaultChecked}
					disabled={disabled}
					required={required}
					mix={[visuallyHidden(), parts?.input]}
				/>
				{children}
			</label>
		);
	};
};

/**
 * Renders a decorative sentinel row: a `<div>` styled as a centered, muted
 * line of small text sized to match {@link ListBox.Item}'s vertical rhythm,
 * ready to hold a loading indicator or "load more" trigger as `children`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the sentinel row's markup.
 * @example
 * <ListBox.LoadMoreItem>{t("list.loadingMore")}</ListBox.LoadMoreItem>
 */
ListBox.LoadMoreItem = SentinelRow;
