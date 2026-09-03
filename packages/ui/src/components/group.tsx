/**
 * A visual and semantic wrapper binding a cluster of related controls into
 * one unit — a text input paired with its clear button, a row of segmented
 * buttons, a search field with a trailing submit action. The host lays its
 * children out in a single row and gains a keyboard focus ring around the
 * whole cluster whenever a control inside it becomes focus-visible, detected
 * structurally rather than through any tracked state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { outline, outlineColor } from "@sdxc/u/color";
import { flex, items } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { attrs } from "remix/ui";

/**
 * Default ARIA role applied through {@link attrs} unless a consumer
 * overrides `role`; pass `"region"` for landmark-worthy content or
 * `"presentation"` for purely visual grouping.
 */
const DEFAULT_ROLE = "group";

/**
 * Prop types for {@link Group}.
 */
export namespace Group {
	/**
	 * Native `<div>` attributes plus `mix`. `role` defaults to
	 * {@link DEFAULT_ROLE} (or `"region"`/`"presentation"`); `aria-invalid`
	 * gives the focus ring the danger tone, `aria-disabled` marks it disabled.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * Lays children out in a centered flex row with no border, background, or
 * gap, so controls can compose their own edges into one shape, and shows a
 * keyboard focus ring (primary, or danger under `aria-invalid="true"`).
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <Group>
 * 	<Button>{t("stepper.decrement")}</Button>
 * 	<Button>{t("stepper.increment")}</Button>
 * </Group>
 * @example
 * <Group aria-invalid="true">
 * 	<input aria-label={t("form.email")} />
 * 	<Button aria-label={t("form.clear")}>
 * 		<XIcon />
 * 	</Button>
 * </Group>
 */
export function Group(handle: Handle<Group.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					when("&:has(:focus-visible)", outline({ color: "brand.ring", offset: 2 })),
					flex(),
					items("center"),
					when('&[aria-invalid="true"]', outlineColor("danger")),
					mix,
				]}
			/>
		);
	};
}
