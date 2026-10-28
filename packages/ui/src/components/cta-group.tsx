/**
 * A horizontal cluster of primary and secondary marketing actions that wraps
 * onto a second row when the container is narrow. Children are the page's own
 * {@link Button} / {@link LinkButton} instances — pair nav rows at `size="sm"`
 * (~32px) with hero rows at `size="lg"` (~48px).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { flexWrap, gap, inlineFlex, items } from "@sdxc/u/layout";

/**
 * Prop types for {@link CtaGroup}.
 */
export namespace CtaGroup {
	/**
	 * Props accepted by {@link CtaGroup}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Action controls — typically a solid primary {@link Button} or
		 * {@link LinkButton} beside an outline secondary. The group does not
		 * invent buttons of its own.
		 */
		children: RemixNode;
	}
}

/**
 * Lays action children in a wrapping inline-flex row with a compact gap so a
 * primary and secondary CTA read as one cluster. Radius and size stay on the
 * buttons; override `--ui-marketing-cta-radius` per brand for pill vs soft-rect
 * corners when composing marketing CTAs.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <CtaGroup>
 * 	<Button size="lg" color="brand">{t("hero.cta")}</Button>
 * 	<LinkButton href={docs} size="lg" variant="outline">{t("hero.docs")}</LinkButton>
 * </CtaGroup>
 * @example
 * <CtaGroup>
 * 	<LinkButton href={signin} size="sm">{t("nav.signin")}</LinkButton>
 * </CtaGroup>
 */
export function CtaGroup(handle: Handle<CtaGroup.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="cta-group"
				mix={[inlineFlex(), items("center"), flexWrap(), gap(3), mix]}
			/>
		);
	};
}
