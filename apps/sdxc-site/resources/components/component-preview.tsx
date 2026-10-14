/**
 * A rendered component with its source one click away. The preview is the component
 * itself under the site's own stylesheet, so the toggle is a disclosure rather than a
 * tab strip: there is one thing on the page and one way to look behind it, and it
 * opens and closes before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { clip, overflowX } from "@sdxc/u/overflow";
import { is, minBs, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Disclosure } from "@sdxc/ui";

import Snippet from "~/resources/components/snippet";

namespace ComponentPreview {
	export interface Props {
		/** The component as it renders, which is what the page is showing. */
		children: RemixNode;
		/** The markup that produced it, revealed by the toggle. */
		code: string;
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

/** Renders one preview and its source. */
export default function ComponentPreview(handle: Handle<ComponentPreview.Props>) {
	return () => {
		let { children, code, label = "View code", flush = false } = handle.props;

		return (
			<div mix={[vstack({ gap: 3, align: "stretch" })]}>
				<div
					mix={[
						hstack({ gap: 4, align: "center", justify: "center" }),
						flexWrap(),
						p(8),
						minBs("10rem"),
						overflowX("auto"),
						rounded("lg"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						/*
						 * A dot grid behind the example separates the component from the page it is
						 * documented on, so a surface of its own — a card, a panel, a menu — reads as
						 * a thing sitting on a canvas rather than part of the prose around it. The
						 * dots are drawn from the border token, so they follow the theme.
						 */
						raw({
							backgroundImage:
								"radial-gradient(circle at 1px 1px, var(--ui-neutral-border, currentcolor) 1px, transparent 0)",
							backgroundSize: "16px 16px",
							backgroundPosition: "-1px -1px",
						}),
					]}
				>
					{/*
					 * The example sits on a surface of its own, so the dots stay a canvas around it
					 * rather than a texture running under its text. A component that brings no
					 * background — a tree, a run of prose — would otherwise be read through them.
					 */}
					<div
						mix={[
							hstack({ gap: 4, align: flush ? "stretch" : "center", justify: "center" }),
							flexWrap(),
							/* Filling the canvas is what lets a block example — a table, a run of prose —
							   take the width it needs; sized to its content it would collapse instead. */
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

				<Disclosure>
					<Disclosure.Trigger mix={[text("sm")]}>{label}</Disclosure.Trigger>
					<Disclosure.Panel>
						<Snippet code={code} />
					</Disclosure.Panel>
				</Disclosure>
			</div>
		);
	};
}
