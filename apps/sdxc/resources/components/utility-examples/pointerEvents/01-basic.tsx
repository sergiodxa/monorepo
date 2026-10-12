/**
 * The opening `pointerEvents` example: a search icon laid over its input, which lets a
 * click on the icon fall through and focus the field underneath.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pointerEvents } from "@sdxc/u/general";
import { absolute, hstack, insBe, insBs, insIs, relative } from "@sdxc/u/layout";
import { is, maxIs, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A search field whose overlaid icon passes clicks through to the input. */
export default {
	title: "Basic example",
	description:
		"Use `pointerEvents()` on something laid over a control, like an icon, so clicks pass through to whatever is underneath. Click the magnifying glass:",
	render: () => (
		<div mix={[relative(), is("full"), maxIs(72)]}>
			<input
				type="search"
				placeholder="Search recipes"
				mix={[
					is("full"),
					p(2, 3, 2, 9),
					rounded("md"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
				]}
			/>
			<span
				mix={[
					pointerEvents(),
					absolute(),
					insBs(0),
					insBe(0),
					insIs(3),
					hstack({ align: "center" }),
					fg("neutral.muted"),
				]}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<circle cx="7" cy="7" r="5" />
					<path d="m11 11 3.5 3.5" />
				</svg>
			</span>
		</div>
	),
} satisfies UtilityExampleModule;
