/**
 * Chips that name a product's controls inside help-doc prose: one chip per button, menu or
 * setting, and a path of chips joined by arrows for where to click in order. Each chip
 * stays whole on one line, so a path wraps only between its steps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { font, nowrap, weight } from "@sdxc/u/typography";

/** Separator {@link UiPath} draws between steps when `separator` is omitted. */
const DEFAULT_SEPARATOR = "→";

/**
 * Prop types for {@link UiLabel}.
 */
export namespace UiLabel {
	/** Native `<span>` attributes plus the control's name exactly as the product shows it. */
	export interface Props extends TagProps<"span"> {
		children: RemixNode;
	}
}

/**
 * Renders a control's name as a light, hairline-bordered chip in the sans face, so it
 * reads as something on screen rather than as code. It never breaks inside, and sizes
 * relative to the sentence around it.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the chip's markup.
 * @example
 * Click <UiLabel>{t("monitors.add")}</UiLabel> to open the form.
 */
export function UiLabel(handle: Handle<UiLabel.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				data-slot="ui-label"
				mix={mergeMix(
					[
						raw({
							display: "inline-block",
							fontSize: "0.875em",
							lineHeight: "1.4",
							padding: "0.0625em 0.4em",
							verticalAlign: "baseline",
						}),
						rounded("0.3125rem"),
						bg("neutral.tint"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						fg("neutral.emphasis"),
						font("sans"),
						weight("medium"),
						nowrap(),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * Prop types for {@link UiPath}.
 */
export namespace UiPath {
	/** Native `<span>` attributes plus the controls to click, in order. */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		/** Each control's name, in the order the reader clicks them. */
		items: string[];
		/** Drawn between steps. Defaults to {@link DEFAULT_SEPARATOR}; pass `"←"` on a right-to-left page. */
		separator?: string;
	}
}

/**
 * Renders a click path as chips joined by a muted separator. Spaces sit around each
 * separator, so a long path breaks between steps and every chip stays whole.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the path's markup.
 * @example
 * Open <UiPath items={[t("nav.settings"), t("settings.notifications"), t("channels.add")]} />.
 */
export function UiPath(handle: Handle<UiPath.Props>) {
	return () => {
		let { items, mix, separator, ...rest } = handle.props;
		let glyph = separator ?? DEFAULT_SEPARATOR;

		return (
			<span {...rest} data-slot="ui-path" mix={mix}>
				{items.flatMap((item, index) => {
					let chip = <UiLabel key={`item-${index}`}>{item}</UiLabel>;
					if (index === 0) return [chip];
					return [
						" ",
						<span
							key={`separator-${index}`}
							data-slot="ui-path-separator"
							mix={[fg("neutral.muted")]}
						>
							{glyph}
						</span>,
						" ",
						chip,
					];
				})}
			</span>
		);
	};
}
