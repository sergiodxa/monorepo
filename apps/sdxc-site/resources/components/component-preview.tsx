/**
 * A rendered component with its source one click away. The preview is the component
 * itself under the site's own stylesheet, so the toggle is a disclosure rather than a
 * tab strip: there is one thing on the page and one way to look behind it, and it ope
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { clip, overflowX } from "@sdxc/u/overflow";
import { at, atMax } from "@sdxc/u/responsive";
import { is, minBs, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Disclosure } from "@sdxc/ui";

import Snippet from "~/resources/components/snippet";

/** The container the preview's frame reads its own width from. */
const PREVIEW_CONTAINER = "component-preview";

/**
 * Below this width the frame keeps a thin margin, so a page-wide demo on a phone keeps the
 * room it needs rather than spending it on the dotted surround.
 */
const NARROW = "40rem";

namespace ComponentPreview {
	export interface Props {
		/** The component as it renders, which is what the page is showing. */
		children: RemixNode;
		/**
		 * The markup that produced it, revealed by the toggle. A demo whose source the page
		 * already prints beside the frame leaves it out, and draws no toggle.
		 */
		code?: string;
		/** What the toggle reads as, so several previews on a page stay distinguishable. */
		label?: string;
		/**
		 * Whether the example meets the edges of its surface. An application shell owns the
		 * frame it is drawn in, so the band a smaller example needs around it would read as
		 * the shell's own margin instead.
		 */
		flush?: boolean;
	}
}

/**
 * Renders one preview and its source. The surface opts out of a guide's prose styles, so a
 * demo framed into an article draws exactly as it does on its component page. A demo wider
 * than the surface, positioned parts included, starts at its left edge and scrolls inside it.
 */
export default function ComponentPreview(handle: Handle<ComponentPreview.Props>) {
	return () => {
		let { children, code, label = "View code", flush = false } = handle.props;

		return (
			<div
				data-not-typeset
				mix={[vstack({ gap: 3, align: "stretch" }), container(PREVIEW_CONTAINER)]}
			>
				<div
					mix={[
						hstack({ gap: 4, align: "center", justify: "center" }),
						flexWrap(),
						atMax(NARROW, PREVIEW_CONTAINER, p(3)),
						at(NARROW, PREVIEW_CONTAINER, p(8)),
						minBs("10rem"),
						overflowX("auto"),
						raw({ position: "relative" }),
						rounded("lg"),
						border({ color: "neutral.border", width: 1, style: "solid" }),

						raw({
							backgroundImage:
								"radial-gradient(circle at 1px 1px, var(--ui-neutral-border, currentcolor) 1px, transparent 0)",
							backgroundSize: "16px 16px",
							backgroundPosition: "-1px -1px",
						}),
					]}
				>
					<div
						mix={[
							hstack({ gap: 4, align: flush ? "stretch" : "center", justify: "center" }),
							raw({ justifyContent: "safe center" }),
							flexWrap(),

							is("100%"),
							flush ? clip() : p(6),
							rounded("md"),
							bg(),
							border({ color: "neutral.border", width: 1, style: "solid" }),
						]}
					>
						{children}
					</div>
				</div>

				{code === undefined ? null : (
					<Disclosure>
						<Disclosure.Trigger mix={[text("sm")]}>{label}</Disclosure.Trigger>
						<Disclosure.Panel>
							<Snippet code={code} />
						</Disclosure.Panel>
					</Disclosure>
				)}
			</div>
		);
	};
}
