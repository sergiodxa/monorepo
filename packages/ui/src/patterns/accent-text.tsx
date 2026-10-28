/**
 * A single emphasized phrase inside a marketing headline — brand color on the
 * span so the surrounding display heading stays one weight and size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";

/**
 * Prop types for {@link AccentText}.
 */
export namespace AccentText {
	/**
	 * Props accepted by {@link AccentText}.
	 */
	export interface Props extends TagProps<"span"> {
		/** The emphasized phrase. */
		children: RemixNode;
	}
}

/**
 * Colors a phrase with the brand foreground so a display heading can stress
 * one word without changing weight or inventing a gradient recipe.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the accent span.
 * @example
 * <Heading size="display">Ship <AccentText>{t("hero.accent")}</AccentText> faster</Heading>
 */
export function AccentText(handle: Handle<AccentText.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <span {...rest} data-slot="accent-text" mix={[fg("brand"), mix]} />;
	};
}
