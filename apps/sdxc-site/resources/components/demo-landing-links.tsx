/**
 * The cards a marketing docs page lists the demo landings with: each demo's own title and
 * description, opening the whole page in a new tab, so a reader can see the components
 * assembled into a real product page and come back to the reference.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowUpRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { DemoSummary } from "~/resources/views/demos";

import routes from "~/routes/web";

namespace DemoLandingLinks {
	export interface Props {
		demos: DemoSummary[];
	}
}

/** Renders one card per demo landing, in the order the demo list gives them. */
export default function DemoLandingLinks(handle: Handle<DemoLandingLinks.Props>) {
	return () => (
		<ul
			mix={[
				m(0),
				p(0),
				raw({ listStyle: "none" }),
				grid(),
				gap(3),
				gridTemplate({ columns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))" }),
			]}
		>
			{handle.props.demos.map((demo) => (
				<li key={demo.slug}>
					<a
						href={routes.demo.href({ slug: demo.slug })}
						target="_blank"
						rel="noreferrer"
						mix={[
							vstack({ gap: 2, align: "stretch" }),
							p(4),
							raw({
								blockSize: "100%",
								textDecoration: "none",
								borderRadius: "var(--ui-marketing-radius-surface, 1rem)",
								backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
								boxShadow: "var(--ui-shadow-surface, 0 0 0 1px var(--ui-neutral-border))",
								transition: "box-shadow 150ms",
							}),
							hover(
								raw({ boxShadow: "var(--ui-shadow-stage, 0 0 0 1px var(--ui-neutral-border))" }),
							),
							focusVisible(
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
							),
						]}
					>
						<span
							mix={[
								hstack({ gap: 2, align: "center" }),
								raw({ justifyContent: "space-between" }),
								text("sm"),
								weight("semibold"),
								fg("neutral.emphasis"),
							]}
						>
							{demo.title.split(" — ")[0]}
							<ArrowUpRightIcon size={16} aria-hidden="true" />
						</span>
						<span mix={[text("sm"), fg("neutral")]}>{demo.description}</span>
						<span mix={[text("xs"), fg("neutral.muted")]}>
							{routes.demo.href({ slug: demo.slug })}
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}
