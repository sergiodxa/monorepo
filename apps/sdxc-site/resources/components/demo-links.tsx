/**
 * The cards a catalogue page lists the demos with: each demo's own title and description,
 * opening the whole site in a new tab, so a reader can see the components assembled into a
 * real product's landing or docs and come back to the reference.
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

namespace DemoLinks {
	/** One demo as its card shows it. */
	export interface Link {
		href: string;
		title: string;
		description: string;
		/** Small line above the title naming what kind of demo it is ("API reference"). */
		eyebrow?: string;
	}

	export interface Props {
		links: Link[];
	}
}

/** Renders one card per demo, in the order the list gives them, each with its address. */
export default function DemoLinks(handle: Handle<DemoLinks.Props>) {
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
			{handle.props.links.map((demo) => (
				<li key={demo.href}>
					<a
						href={demo.href}
						target="_blank"
						rel="noreferrer"
						mix={[
							vstack({ gap: 2, align: "stretch" }),
							p(4),
							raw({
								blockSize: "100%",
								textDecoration: "none",
								borderRadius: "var(--ui-landing-radius-surface, 1rem)",
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
						{demo.eyebrow ? (
							<span mix={[text("xs"), weight("medium"), fg("brand")]}>{demo.eyebrow}</span>
						) : null}
						<span
							mix={[
								hstack({ gap: 2, align: "center" }),
								raw({ justifyContent: "space-between" }),
								text("sm"),
								weight("semibold"),
								fg("neutral.emphasis"),
							]}
						>
							{demo.title}
							<ArrowUpRightIcon size={16} aria-hidden="true" />
						</span>
						<span mix={[text("sm"), fg("neutral")]}>{demo.description}</span>
						<span mix={[text("xs"), fg("neutral.muted"), raw({ overflowWrap: "anywhere" })]}>
							{demo.href}
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}
