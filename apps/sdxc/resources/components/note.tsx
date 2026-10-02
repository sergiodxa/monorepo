/**
 * The `note` tag: a short aside beside the argument it qualifies. It is an `<aside>`
 * rather than a live region, because the text is there when the page loads and nothing
 * updates it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { semanticColorPanel } from "@sdxc/ui/styles";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

namespace Note {
	/** What the aside is doing: adding a fact, or warning about one. */
	export type Kind = "info" | "caution";

	export interface Props extends MarkdownProps {
		kind?: Kind;
	}
}

/** Renders one aside, tinted by its kind. */
export default function Note(handle: Handle<Note.Props>) {
	return () => {
		let { children, kind = "info" } = handle.props;

		return (
			<aside
				data-color={kind === "caution" ? "warning" : "brand"}
				mix={[
					semanticColorPanel(),
					vstack({ gap: 2 }),
					blocksUseGap(),
					p(4, 5),
					rounded("lg"),
					border({ width: 1, style: "solid" }),
					text("sm"),
				]}
			>
				{children}
			</aside>
		);
	};
}
