/**
 * The `section-block` tag: one titled band of the landing page. The `id` is the anchor
 * the page is linked to by, so it belongs in the content file beside the title it
 * names rather than in a view a reader of the copy never opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { dark, media } from "@sdxc/u/responsive";
import { is, maxIs, p } from "@sdxc/u/size";
import { text, tracking, weight } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

namespace SectionBlock {
	/** How the band separates itself from the one above: not at all, or with a wash. */
	export type Tone = "plain" | "tinted";

	export interface Props extends MarkdownProps {
		id: string;
		title: string;
		tone?: Tone;
	}
}

/** Renders one titled band. */
export default function SectionBlock(handle: Handle<SectionBlock.Props>) {
	return () => {
		let { children, id, title, tone = "plain" } = handle.props;

		return (
			<section
				id={id}
				mix={[
					vstack({ align: "center" }),
					is("100%"),
					tone === "tinted"
						? [bg("color.neutral.100"), dark(bg("color.neutral.900"))]
						: bg("transparent"),
				]}
			>
				<div
					mix={[
						vstack({ gap: 6 }),
						blocksUseGap(),
						is("100%"),
						maxIs("64rem"),
						p(12, 5),
						media("(min-width: 48rem)", p(16, 5)),
					]}
				>
					<h2 mix={[text("2xl"), weight("bold"), tracking("tight")]}>{title}</h2>
					{children}
				</div>
			</section>
		);
	};
}
