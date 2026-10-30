/**
 * A horizontal cluster of primary and secondary marketing actions that wraps
 * onto a second row when the container is narrow. Children are the page's own
 * {@link Button} / {@link LinkButton} instances, and an action that names no
 * size of its own takes the group's, so a hero row sizes every CTA at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { flexWrap, gap, inlineFlex, items } from "@sdxc/u/layout";
import { atMax } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** Size the group hands its actions when `size` is omitted: the 40px marketing CTA. */
const DEFAULT_SIZE: CtaGroup.Size = "md";

/**
 * Prop types for {@link CtaGroup}.
 */
export namespace CtaGroup {
	/** Size every action without a `size` of its own renders at. */
	export type Size = "sm" | "md" | "lg";

	/**
	 * When the actions stack into full-width rows: never, or on a phone-width
	 * container (36rem and below), where two side-by-side CTAs would wrap unevenly.
	 */
	export type Stack = "never" | "phone";

	/** What the group shares with the actions inside it. */
	export interface Context {
		/** Size an action without its own `size` renders at. */
		size: Size;
	}

	/**
	 * Props accepted by {@link CtaGroup}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Size handed to every action without its own. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/** When the actions stack full width. Defaults to `"never"`. */
		stack?: Stack;
		/**
		 * Action controls — typically a solid primary {@link Button} or
		 * {@link LinkButton} beside a `surface` or outline secondary. The group
		 * does not invent buttons of its own.
		 */
		children: RemixNode;
	}
}

/**
 * Lays action children in a wrapping inline-flex row with a compact gap so a
 * primary and secondary CTA read as one cluster, and publishes its size to them.
 * Radius stays on the buttons; override `--ui-marketing-cta-radius` per brand for
 * pill vs soft-rect corners through `marketingCtaChrome()`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <CtaGroup stack="phone">
 * 	<Button color="brand">{t("hero.cta")}</Button>
 * 	<LinkButton href={docs} variant="surface">{t("hero.docs")}</LinkButton>
 * </CtaGroup>
 * @example
 * <CtaGroup size="sm">
 * 	<LinkButton href={signin}>{t("nav.signin")}</LinkButton>
 * </CtaGroup>
 */
export function CtaGroup(handle: Handle<CtaGroup.Props, CtaGroup.Context>) {
	return () => {
		let { mix, size, stack, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_SIZE;

		handle.context.set({ size: resolvedSize });

		return (
			<div
				{...rest}
				data-slot="cta-group"
				data-size={resolvedSize}
				data-stack={stack === "phone" ? "phone" : undefined}
				mix={[
					inlineFlex(),
					items("center"),
					flexWrap(),
					gap(3),
					stack === "phone"
						? atMax("md", [
								raw({ display: "flex", flexDirection: "column", alignItems: "stretch" }),
								raw({ inlineSize: "100%" }),
								when("& > *", raw({ inlineSize: "100%" })),
							])
						: [],
					mix,
				]}
			/>
		);
	};
}
