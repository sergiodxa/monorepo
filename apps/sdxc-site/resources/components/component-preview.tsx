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
