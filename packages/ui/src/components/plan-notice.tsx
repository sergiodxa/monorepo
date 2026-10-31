/**
 * The quiet box under a help page's title that says which plan or role a feature needs,
 * so a reader learns it before following steps they cannot complete. Pages repeat one
 * fixed sentence, with the plan names linked to pricing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix } from "@sdxc/u/general";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, overflowWrap, text, textDecoration } from "@sdxc/u/typography";

/**
 * Prop types for {@link PlanNotice}.
 */
export namespace PlanNotice {
	/** Native `<p>` attributes plus the one sentence, which may link plan names to pricing. */
	export interface Props extends TagProps<"p"> {
		children: RemixNode;
	}
}

/**
 * Renders the sentence in a muted, hairline-bordered box at the body's small size, with
 * its links underlined in the box's own ink so they read as links without shouting.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the notice's markup.
 * @example
 * <PlanNotice>Available on the <a href="/pricing">Team plan</a>.</PlanNotice>
 */
export function PlanNotice(handle: Handle<PlanNotice.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				data-slot="plan-notice"
				mix={mergeMix(
					[
						m(0),
						p(2, 3),
						rounded("md"),
						bg("neutral.tint"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						fg("neutral"),
						text("sm"),
						leading("relaxed"),
						overflowWrap("anywhere"),
						when("& a", [fg("neutral.emphasis"), textDecoration("underline")]),
					],
					mix,
				)}
			/>
		);
	};
}
