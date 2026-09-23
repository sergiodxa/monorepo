/**
 * One titled band of a generated reference. Both catalogue trees answer the same
 * questions in the same order on every page, so the heading, its anchor and the space
 * under it are settled once here rather than per page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, tracking, weight } from "@sdxc/u/typography";

namespace ReferenceSection {
	export interface Props {
		/** The fragment the in-page navigation links this band by. */
		id: string;
		title: string;
		/** One line under the heading, where the band needs introducing. */
		lead?: string;
		children: RemixNode;
	}
}

/** Renders one titled band. */
export default function ReferenceSection(handle: Handle<ReferenceSection.Props>) {
	return () => {
		let { children, id, lead, title } = handle.props;

		return (
			<section mix={[vstack({ gap: 4, align: "stretch" })]}>
				<h2
					id={id}
					mix={[m(0), fg("neutral.emphasis"), text("xl"), weight("semibold"), tracking("tight")]}
				>
					{title}
				</h2>

				{lead ? <p mix={[m(0), text("base"), fg("neutral")]}>{lead}</p> : null}

				{children}
			</section>
		);
	};
}
