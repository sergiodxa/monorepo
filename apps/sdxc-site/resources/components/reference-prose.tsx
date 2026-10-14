/**
 * A sentence lifted from a source comment, drawn the way the comment wrote it: the runs
 * it put in backticks set in the mono face, the rest as prose. Every page that prints a
 * summary or a part's description goes through here, so a comment naming an element or an
 * attribute reads as code on the page instead of showing its backticks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { font } from "@sdxc/u/typography";

import { toRuns } from "~/app/services/reference-prose";

namespace ReferenceProse {
	export interface Props {
		/** The sentence as the source comment wrote it, backticks and all. */
		children: string;
	}
}

/**
 * Renders one comment sentence.
 *
 * @param handle Runtime handle carrying the sentence to draw.
 * @returns The render function producing the sentence's runs.
 */
export default function ReferenceProse(handle: Handle<ReferenceProse.Props>) {
	return () => (
		<>
			{toRuns(handle.props.children).map((run, index) =>
				run.code ? (
					/*
					 * The size is inherited rather than set, because this sentence is drawn at the
					 * lede's size on one page and the table's on another, and a code run that keeps
					 * its own size would sit a step off the words either side of it.
					 */
					<code key={String(index)} mix={[font("mono"), fg("neutral.emphasis")]}>
						{run.text}
					</code>
				) : (
					run.text
				),
			)}
		</>
	);
}
