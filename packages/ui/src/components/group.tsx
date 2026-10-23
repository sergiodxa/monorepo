/**
 * A visual and semantic wrapper binding a cluster of related controls into
 * one unit — a text input paired with its clear button, a row of segmented
 * buttons, a search field with a trailing submit action. The host lays its
 * children out in a single row, joining their edges so the cluster reads as one
 * control, with the seam between two of them drawn structurally rather than
 * through any tracked state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { outlineColor } from "@sdxc/u/color";
import { roundedCorner } from "@sdxc/u/effects";
import { flex, items } from "@sdxc/u/layout";
import { mis } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { when } from "@sdxc/u/state";
import { attrs } from "remix/component";

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
 * Lays children out in a centered flex row with no border, background, or gap, joining
 * their edges into one shape: only the cluster's outer corners stay round, and the seam
 * two controls share is drawn once. Focus is shown by whichever control holds it.
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
					flex(),
					items("center"),
					/**
					 * The controls compose into one shape, so the cluster keeps the rounding on
					 * its own outer corners and the seam where two of them meet is drawn once; the
					 * last control before a trailing `<link rel="prefetch">` hint keeps its corners.
					 */
					when("& > *:not(:first-child)", [
						roundedCorner("start-start", "none"),
						roundedCorner("end-start", "none"),
						mis("-1px"),
					]),
					when("& > *:has(~ :not(link))", [
						roundedCorner("start-end", "none"),
						roundedCorner("end-end", "none"),
					]),
					/**
					 * Focus shows on the control holding it, naming which control has it where a ring
					 * around the cluster names only the group. That control is raised so its ring
					 * crosses the seam it shares with a neighbour.
					 */
					when("& > *:focus-visible", z(1)),
					when('&[aria-invalid="true"] > *:focus-visible', outlineColor("danger")),
					mix,
				]}
			/>
		);
	};
}
