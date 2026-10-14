/**
 * One horizontal band of the landing page, drawn inside the page's frame: a rule across
 * the full width on top, dashed rails down both sides of the content column, and a small
 * marker where they meet. Every band draws the same rails, so down the page they read as
 * one continuous frame the sections are set into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { borderEdge } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { relative, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, maxIs, p } from "@sdxc/u/size";
import { after, before } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

namespace Band {
	/** What sits behind the band: nothing, a brand glow from one corner, or a faded grid. */
	export type Tone = "plain" | "tinted" | "grid";

	/** How much room the band leaves around its content. */
	export type Spacing = "none" | "normal" | "hero";

	export interface Props {
		id?: string;
		tone?: Tone;
		/** Centers the content, for a band that carries one statement rather than a layout. */
		align?: "start" | "center";
		/** Draws the rule and its markers on top; the first band sits under the site bar instead. */
		ruled?: boolean;
		spacing?: Spacing;
		children: RemixNode;
	}
}

/** Renders one band of the frame around its content. */
export default function Band(handle: Handle<Band.Props>) {
	return () => {
		let {
			align = "start",
			children,
			id,
			ruled = true,
			spacing = "normal",
			tone = "plain",
		} = handle.props;

		return (
			<section
				id={id}
				mix={[
					vstack({ align: "center" }),
					is("100%"),
					relative(),
					raw({ isolation: "isolate" }),
					ruled
						? borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" })
						: [],
					tone === "tinted"
						? raw({
								backgroundImage:
									"radial-gradient(60% 70% at 85% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent), transparent 70%)",
							})
						: [],
					tone === "grid"
						? before(
								raw({
									content: '""',
									position: "absolute",
									inset: 0,
									zIndex: -1,
									backgroundImage:
										"linear-gradient(to right, var(--ui-neutral-border) 1px, transparent 1px), linear-gradient(to bottom, var(--ui-neutral-border) 1px, transparent 1px)",
									backgroundSize: "3rem 3rem",
									opacity: 0.55,
									maskImage: "radial-gradient(70% 80% at 70% 40%, black, transparent 75%)",
									WebkitMaskImage: "radial-gradient(70% 80% at 70% 40%, black, transparent 75%)",
								}),
							)
						: [],
				]}
			>
				<div
					mix={[
						vstack({ align: align === "center" ? "center" : "stretch" }),
						relative(),
						is("100%"),
						maxIs("76rem"),
						align === "center" ? raw({ textAlign: "center" }) : [],
						spacing === "none" ? [] : p(spacing === "hero" ? 14 : 16, 5),
						media("(min-width: 48rem)", [
							borderEdge("inline-start", { color: "neutral.border", width: 1, style: "dashed" }),
							borderEdge("inline-end", { color: "neutral.border", width: 1, style: "dashed" }),
							spacing === "none" ? [] : p(spacing === "hero" ? 24 : 20, 12),
						]),
						ruled
							? media("(min-width: 48rem)", [
									before(marker({ insetInlineStart: "-4px" })),
									after(marker({ insetInlineEnd: "-4px" })),
								])
							: [],
						text("base"),
					]}
				>
					{children}
				</div>
			</section>
		);
	};
}

/**
 * The square drawn where the band's rule crosses a rail, which is what makes the rails
 * read as a frame the rule is fixed to rather than as two borders that happen to meet.
 */
function marker(edge: { insetInlineStart: string } | { insetInlineEnd: string }) {
	return raw({
		content: '""',
		position: "absolute",
		insetBlockStart: "-4px",
		...edge,
		inlineSize: "7px",
		blockSize: "7px",
		backgroundColor: "var(--ui-brand-bg-solid)",
	});
}
