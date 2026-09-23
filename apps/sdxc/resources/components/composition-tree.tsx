/**
 * The parts a component composes from, drawn as the tree they nest into. Every part is
 * a static property of the host, so the shape is already in the source and the page
 * has no prose to write about it — only the names, and what each one is for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, pis } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";

import type { ComponentPart } from "~/app/services/components";

import ReferenceProse from "~/resources/components/reference-prose";

namespace CompositionTree {
	export interface Props {
		/** The host every part hangs off, written as it is imported. */
		host: string;
		parts: ComponentPart[];
	}
}

/** Renders one component's composition tree. */
export default function CompositionTree(handle: Handle<CompositionTree.Props>) {
	return () => {
		let { host, parts } = handle.props;

		return (
			<ul mix={[m(0), pis(0), listStyle("none"), vstack({ gap: 2, align: "stretch" })]}>
				<li>
					<code mix={[font("mono"), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
						{host}
					</code>
				</li>

				{parts.map((part) => (
					<li key={part.name} mix={[pis(6), vstack({ gap: 1, align: "start" })]}>
						<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>{part.name}</code>
						<span mix={[text("sm"), fg("neutral")]}>
							<ReferenceProse>{part.description}</ReferenceProse>
						</span>
					</li>
				))}
			</ul>
		);
	};
}
