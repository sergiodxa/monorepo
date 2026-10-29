/**
 * A sentence lifted from a source comment, drawn the way the comment wrote it: the runs
 * it put in backticks set in the mono face, the rest as prose.
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
