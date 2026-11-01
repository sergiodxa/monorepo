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
import type { RemixNode } from "remix/component";

import { bg, border, fg, outline, outlineColor } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { flex, grow, items, shrink } from "@sdxc/u/layout";
import { bs, minIs, mis, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { when } from "@sdxc/u/state";
import { nowrap, text } from "@sdxc/u/typography";
import { attrs } from "remix/component";

/**
 * Default ARIA role applied through {@link attrs} unless a consumer
 * overrides `role`; pass `"region"` for landmark-worthy content or
 * `"presentation"` for purely visual grouping.
 */
const DEFAULT_ROLE = "group";

/** A group holding a {@link Group.Text} addon, which makes it one field drawing its own rings. */
const WITH_ADDON = '&:has(> [data-slot="group-text"])';

/** A control whose value fails validation, by the platform's own check or the field's `aria-invalid`. */
const INVALID_CONTROL = ':is(:user-invalid, [aria-invalid="true"])';

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

	/**
	 * Native `<label>` attributes plus `mix`. Set `htmlFor` to the control's `id` so a
	 * click on the addon focuses it, and `id` to list the addon in the control's
	 * `aria-describedby`; give the control its name through `aria-label` or
	 * `aria-labelledby`, which keeps the addon's text out of that name.
	 */
	export interface TextProps extends TagProps<"label"> {
		/** The addon's static text: a currency, a unit, a domain. */
		children: RemixNode;
	}
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
				mix={mergeMix(
					[
						attrs({ role: DEFAULT_ROLE }),
						flex(),
						items("center"),
						/**
						 * The controls compose into one shape, so the cluster keeps the rounding on
						 * its own outer corners and the seam where two of them meet is drawn once; the
						 * last control before a trailing `<link rel="prefetch">` hint keeps its corners.
						 * The square corners are `!important` so they hold over every child's own
						 * rounding, whichever reached the page first.
						 */
						when("& > *:not(:first-child)", [
							raw({
								borderStartStartRadius: "0 !important",
								borderEndStartRadius: "0 !important",
							}),
							mis("-1px"),
						]),
						when(
							"& > *:has(~ :not(link))",
							raw({
								borderStartEndRadius: "0 !important",
								borderEndEndRadius: "0 !important",
							}),
						),
						/**
						 * Focus shows on the control holding it, naming which control has it where a ring
						 * around the cluster names only the group. That control is raised so its ring
						 * crosses the seam it shares with a neighbour.
						 */
						when("& > *:focus-visible", z(1)),
						when('&[aria-invalid="true"] > *:focus-visible', outlineColor("danger")),
						/**
						 * With an addon the cluster is one field, so it carries the field's rounding and
						 * rings, and the control takes the width the addons leave, down to nothing.
						 */
						when(WITH_ADDON, rounded("md")),
						when(`${WITH_ADDON} > :not([data-slot="group-text"])`, [grow(), minIs(0)]),
						when(
							`${WITH_ADDON}:has(> :focus-visible)`,
							outline({ color: "brand.ring", offset: 2 }),
						),
						when(
							`${WITH_ADDON}:has(> [data-color="success"]:focus-visible)`,
							outlineColor("success.ring"),
						),
						when(
							`${WITH_ADDON}:has(> [data-color="warning"]:focus-visible)`,
							outlineColor("warning.ring"),
						),
						when(
							`${WITH_ADDON}:has(> [data-color="danger"]:focus-visible)`,
							outlineColor("danger.ring"),
						),
						when(
							`${WITH_ADDON}:has(> ${INVALID_CONTROL})`,
							outline({ color: "danger.ring", offset: 2 }),
						),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * Renders a static addon joined to the control beside it — a currency, a unit, a domain —
 * as a muted, bordered `<label>` that keeps its text on one line. The `<label>` makes a
 * click on the addon focus the control; it dims with a disabled control and takes the
 * danger border with an invalid one, and its group draws the field's focus and invalid rings.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props.
 * @returns The render function producing the addon's markup.
 * @example
 * <Group>
 * 	<Group.Text id="slug-prefix" htmlFor="slug">pulse.dev/</Group.Text>
 * 	<Input id="slug" aria-labelledby="slug-label" aria-describedby="slug-prefix" />
 * </Group>
 */
Group.Text = function GroupText(handle: Handle<Group.TextProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<label
				{...rest}
				data-slot="group-text"
				mix={mergeMix(
					[
						flex(),
						items("center"),
						shrink(0),
						nowrap(),
						bs(10),
						pi(3),
						rounded("md"),
						border({ color: "neutral", width: 1 }),
						bg("neutral.tint"),
						fg("neutral.muted"),
						text("sm"),
						cursor("text"),
						when(`${INVALID_CONTROL} ~ &, &:has(~ ${INVALID_CONTROL})`, border("danger")),
						when(":disabled ~ &, &:has(~ :disabled)", [opacity(50), cursor("not-allowed")]),
					],
					mix,
				)}
			/>
		);
	};
};
