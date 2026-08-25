/**
 * A thin visual divider marking a boundary between two groups of content —
 * a menu's sections, a toolbar's clusters, a page's regions. It renders as
 * a single hairline element whose axis and length come from the semantic
 * border color and the orientation it carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg } from "@pkg/u/color";
import { bs, is, minBs } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { attrs } from "remix/ui";

/**
 * ARIA role applied through {@link attrs} so the host `<div>` is announced
 * as a divider between content groups without requiring the consumer to
 * repeat it on every instance.
 */
const DEFAULT_ROLE = "separator";

/**
 * Default `aria-orientation` value applied through {@link attrs}. Keeping
 * the accessibility attribute and the CSS variant selector on the same
 * value lets a consumer flip the axis by setting `aria-orientation="vertical"`.
 */
const DEFAULT_ORIENTATION = "horizontal";

/**
 * Props accepted by {@link Separator}.
 */
export namespace Separator {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * Setting `aria-orientation="vertical"` switches both the accessibility
	 * contract and the rendered axis to a vertical divider.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * Renders a static hairline divider between two groups of content, carrying
 * the `separator` role and defaulting to a full-width horizontal line;
 * setting `aria-orientation="vertical"` flips it to a full-height vertical line.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the divider's markup.
 * @example
 * <Separator />
 * @example
 * <Separator aria-orientation="vertical" />
 */
export function Separator(handle: Handle<Separator.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: DEFAULT_ROLE, "aria-orientation": DEFAULT_ORIENTATION }),
					when('&[aria-orientation="horizontal"]', [
						bs("var(--ui-separator-thickness, 1px)"),
						is("100%"),
					]),
					when('&[aria-orientation="vertical"]', [
						bs("100%"),
						minBs("var(--ui-separator-min-size, 1rem)"),
						is("var(--ui-separator-thickness, 1px)"),
					]),
					bg("neutral.border"),
					mix,
				]}
			/>
		);
	};
}
