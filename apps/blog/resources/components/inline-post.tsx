/**
 * A note or TIL read in a list, the home page's activity and its kind's topic page alike: the
 * TIL's title as the entry's name, then the content as its `e-content`, set as compact prose so
 * a run of short posts reads as one column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "@sdxc/markdown";
import type { Handle } from "remix/component";

import { toRemix } from "@sdxc/markdown/remix";
import { mf } from "@sdxc/microformats/ui";
import { fg } from "@sdxc/u/color";
import { gap, grid } from "@sdxc/u/layout";
import { m, minIs } from "@sdxc/u/size";
import { overflowWrap, text, weight } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";

/**
 * Prop types for {@link InlinePost}.
 */
export namespace InlinePost {
	export interface Props {
		/** A TIL's title; a note has none. */
		title: string | null;
		/** The parsed content; `null` when it is blank or does not parse, which shows nothing. */
		document: Markdown.Document | null;
	}
}

/** Renders a short post's title, when it has one, above its content. */
export function InlinePost(handle: Handle<InlinePost.Props>) {
	return () => {
		let { document, title } = handle.props;
		return (
			<div mix={[grid(), gap(1), minIs(0), overflowWrap("break-word")]}>
				{title ? (
					<p mix={[mf("p-name"), m(0), text("lg"), weight("bold"), fg("neutral.emphasis")]}>
						{title}
					</p>
				) : null}
				{document ? <Typeset mix={[mf("e-content")]}>{toRemix(document)}</Typeset> : null}
			</div>
		);
	};
}
