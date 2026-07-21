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

import { attrs, css } from "remix/ui";

import { focusRingPrimary } from "../styles/focus-ring";

/**
 * ARIA role applied through {@link attrs} unless a consumer supplies its own
 * `role`, announcing the cluster as a generic group of controls. Pass
 * `role="region"` when the group's contents are important enough to belong
 * in the page's landmark structure, or `role="presentation"` when the
 * grouping is purely visual and carries no semantic meaning of its own.
 */
const DEFAULT_ROLE = "group";

/**
 * Prop types for {@link Group}.
 */
export namespace Group {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `role` defaults to {@link DEFAULT_ROLE} but stays overridable to
	 * `"region"` or `"presentation"`. Set `aria-invalid="true"` to color the
	 * group's focus ring with the semantic danger tone instead of the default
	 * primary tone, and `aria-disabled` to mark the cluster as disabled to
	 * assistive technology.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * Renders a single-row host binding its children into one visual and
 * semantic unit: a `role="group"` `<div>` laying its children out in a
 * horizontally centered flex row. The host carries no border, background, or
 * gap of its own — a consumer's controls compose their own edges into one
 * shape (rounding only the outer corners of the first and last child, for
 * instance) — and gains a keyboard focus ring around the whole row whenever
 * a control inside it becomes focus-visible. That ring reads in the semantic
 * primary color by default, or the semantic danger color when the group
 * itself carries `aria-invalid="true"`.
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
					focusRingPrimary({ when: "&:has(:focus-visible)" }),
					css({
						display: "flex",
						alignItems: "center",

						'&[aria-invalid="true"]': {
							outlineColor: "var(--ui-danger-ring)",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
