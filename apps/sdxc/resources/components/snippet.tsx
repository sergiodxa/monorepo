/**
 * One block of source a generated page prints. The markdown pipeline paints a fence on
 * the way through its walk; a page assembled from a documentation model has no walk to
 * ride, so it paints here and hands the same block the same runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { tokenize } from "@sdxc/highlight";

import CodeBlock from "~/resources/components/code-block";

namespace Snippet {
	export interface Props {
		code: string;
		/** Language the block is painted as, named the way a fence names it. */
		language?: string;
		/** What the block's header reads as; without one the block has no header. */
		title?: string;
	}
}

/** Renders one painted block of source. */
export default function Snippet(handle: Handle<Snippet.Props>) {
	return () => {
		let { code, language = "tsx", title } = handle.props;

		return (
			<CodeBlock content={code} language={language} title={title} tokens={tokenize(code, language)}>
				{null}
			</CodeBlock>
		);
	};
}
