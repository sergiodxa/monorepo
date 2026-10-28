/**
 * Window or device chrome around a product screenshot or staged UI. Optional
 * traffic lights, title, and URL bar stay decorative; the page supplies every
 * string and the framed children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { gap, hstack, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, m, p, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, truncate, weight } from "@sdxc/u/typography";

/** Chrome density {@link ProductFrame} applies when `variant` is omitted. */
const DEFAULT_VARIANT: ProductFrame.Variant = "window";

/**
 * Prop types for {@link ProductFrame} and its compound parts.
 */
export namespace ProductFrame {
	/**
	 * Outer chrome: a desktop window with a title bar, or a darker rim for
	 * device-like screenshots.
	 */
	export type Variant = "window" | "device";

	/**
	 * Per-part styling for chrome the frame renders besides its host.
	 */
	export interface PartsProps {
		/** Styling for the title-bar row. */
		chrome?: TagProps<"div">["mix"];
		/** Styling for the framed body that holds children. */
		body?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link ProductFrame}.
	 */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** Outer chrome. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/**
		 * Draws three decorative traffic-light dots in the title bar. Dots are
		 * `aria-hidden`; they never carry actionable behavior.
		 */
		lights?: boolean;
		/** Optional window title shown in the chrome bar. */
		title?: RemixNode;
		/** Optional URL or path shown as a quiet mono field in the chrome bar. */
		url?: RemixNode;
		/** Per-part styling for chrome and body. */
		parts?: PartsProps;
		/** Product UI, screenshot, or staged sample inside the frame. */
		children: RemixNode;
	}
}

/**
 * Wraps children in soft window or device chrome so a landing media slot reads
 * as a product surface rather than a bare image.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the frame's markup.
 * @example
 * <ProductFrame lights title={t("frame.app")} url="app.example.com">
 * 	<img src={shot} alt={t("frame.alt")} />
 * </ProductFrame>
 */
export function ProductFrame(handle: Handle<ProductFrame.Props>) {
	return () => {
		let { children, lights, mix, parts, title, url, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let showChrome = Boolean(lights || title || url);
		let isDevice = resolvedVariant === "device";

		return (
			<div
				{...rest}
				data-slot="product-frame"
				data-variant={resolvedVariant}
				mix={[
					vstack({ gap: 0, align: "stretch" }),
					overflow("hidden"),
					rounded(isDevice ? "2xl" : "xl"),
					border({ color: "neutral", width: 1, style: "solid" }),
					bg(),
					shadow("md"),
					isDevice
						? raw({
								boxShadow:
									"0 0 0 1px color-mix(in oklab, CanvasText 12%, transparent), 0 18px 40px color-mix(in oklab, CanvasText 18%, transparent)",
							})
						: [],
					mix,
				]}
			>
				{showChrome ? (
					<div
						mix={[
							hstack({ gap: 3, align: "center", justify: "between" }),
							p(2, 3),
							borderEdge("block-end", {
								color: "neutral",
								width: 1,
								style: "solid",
							}),
							bg("neutral.tint"),
							parts?.chrome,
						]}
					>
						<span mix={[hstack({ gap: 3, align: "center" }), is("100%"), overflow("hidden")]}>
							{lights ? (
								<span
									aria-hidden="true"
									mix={[inlineFlex(), items("center"), gap(1.5), raw({ flexShrink: "0" })]}
								>
									<span mix={[is(2.5), bs(2.5), rounded("full"), bg("danger.solid")]} />
									<span mix={[is(2.5), bs(2.5), rounded("full"), bg("warning.solid")]} />
									<span mix={[is(2.5), bs(2.5), rounded("full"), bg("success.solid")]} />
								</span>
							) : null}

							{title ? (
								<span mix={[text("xs"), weight("medium"), fg("neutral"), truncate(), m(0)]}>
									{title}
								</span>
							) : null}
						</span>

						{url ? (
							<span
								mix={[
									font("mono"),
									text("xs"),
									fg("neutral.muted"),
									truncate(),
									pi(2),
									raw({ maxInlineSize: "50%" }),
								]}
							>
								{url}
							</span>
						) : null}
					</div>
				) : null}

				<div
					data-slot="product-frame-body"
					mix={[
						overflow("hidden"),
						bg(),
						when("& > img, & > video", [
							is("100%"),
							bs("auto"),
							raw({ display: "block", verticalAlign: "middle" }),
						]),
						parts?.body,
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}
