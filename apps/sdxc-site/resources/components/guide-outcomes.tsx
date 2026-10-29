/**
 * The list a guide opens with under its title: what a reader will know once they finish
 * it, read from the guide's `outcomes` frontmatter. It lets a reader decide in three lines
 * whether this is the page they need before reading any of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, maxIs, p, pis } from "@sdxc/u/size";
import { font, leading, text, textTransform, tracking } from "@sdxc/u/typography";

namespace GuideOutcomes {
	export interface Props {
		/** One sentence fragment each, finishing "you will know…"; `code` spans in backticks. */
		outcomes: string[];
	}
}

/**
 * Splits one outcome on its backticks, so a command or a file name reads in the code face
 * the guide's body sets it in. An unpaired backtick stays as text.
 */
function inlineCode(outcome: string) {
	let parts = outcome.split("`");
	if (parts.length % 2 === 0) return outcome;
	return parts.map((part, index) => (index % 2 === 1 ? <code>{part}</code> : part));
}

/** Renders the labelled list, or nothing for a guide that declares no outcomes. */
export default function GuideOutcomes(handle: Handle<GuideOutcomes.Props>) {
	return () => {
		let { outcomes } = handle.props;
		if (outcomes.length === 0) return null;

		return (
			<section
				aria-labelledby="guide-outcomes"
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					maxIs("48rem"),
					p(4, 5),
					rounded("lg"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
				]}
			>
				<h2
					id="guide-outcomes"
					mix={[
						m(0),
						font("mono"),
						text("xs"),
						textTransform("uppercase"),
						tracking("widest"),
						fg("neutral.muted"),
					]}
				>
					After reading this guide, you will know
				</h2>
				<ul
					mix={[
						m(0),
						pis("1.25rem"),
						listStyle("disc"),
						text("sm"),
						leading("relaxed"),
						fg("neutral"),
					]}
				>
					{outcomes.map((outcome) => (
						<li>{inlineCode(outcome)}</li>
					))}
				</ul>
			</section>
		);
	};
}
