/**
 * The `package-groups` tag: the published collection as an inspector, the groups listed
 * down one side and the packages of the one picked filling the other. It is the one tag
 * that reads data rather than its own children, so a package published today is listed
 * today and a description edited in a manifest is the description shown here.
 *
 * Picking a group needs no script: each group is a radio input beside its label and its
 * panel, and the checked input is what reveals the panel after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, listStyle, raw } from "@sdxc/u/general";
import {
	flex,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	hidden,
	hstack,
	repeat,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { precededBy, when } from "@sdxc/u/state";
import { font, text, textTransform, tracking, weight } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { listPackageGroups } from "~/app/services/packages";
import routes from "~/routes/web";

/** Shared by every radio in the inspector, which the form owner scopes to it. */
const RADIO_GROUP = "package-group";

/** Width the inspector lays the groups beside the packages at, rather than above them. */
const SIDE_BY_SIDE = "(min-width: 56rem)";

namespace PackageGroups {
	export interface Props extends MarkdownProps {
		/** Where the list comes from; the one value keeps a typo a parse error. */
		source: "registry";
	}
}

/**
 * Renders the inspector. Beside each other, the groups take the first column one row
 * each and the open panel spans all of those rows in the second; stacked, the groups wrap
 * as a strip of choices above the panel.
 */
export default function PackageGroups(handle: Handle<PackageGroups.Props>) {
	return () => {
		let groups = listPackageGroups();
		let total = groups.reduce((sum, group) => sum + group.packages.length, 0);

		return (
			<form
				mix={[
					flex(),
					flexWrap("wrap"),
					gap(2),
					raw({ textAlign: "start" }),
					media(SIDE_BY_SIDE, [
						grid(),
						gap(0),
						gridTemplate({ columns: "15rem minmax(0, 1fr)" }),
						rounded("xl"),
						overflow("hidden"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						bg(),
					]),
				]}
			>
				<div
					mix={[
						hidden(),
						media(SIDE_BY_SIDE, [
							hstack({ align: "center", justify: "between" }),
							raw({ gridColumn: "1 / -1", gridRow: "1" }),
							p(3, 5),
							borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
							font("mono"),
							text("xs"),
							textTransform("uppercase"),
							tracking("wider"),
							fg("neutral"),
						]),
					]}
				>
					<span>Package inspector</span>
					<span>{total} packages</span>
				</div>

				{groups.map((group, index) => (
					<div key={group.title} mix={[raw({ display: "contents" })]}>
						<input
							type="radio"
							name={RADIO_GROUP}
							id={`${handle.id}-${index}`}
							defaultChecked={index === 0}
							mix={[visuallyHidden()]}
						/>
						<label
							htmlFor={`${handle.id}-${index}`}
							mix={[
								raw({ order: -1 }),
								hstack({ gap: 3, align: "center", justify: "between" }),
								p(1.5, 3),
								rounded("full"),
								border({ color: "neutral.border", width: 1, style: "solid" }),
								text("sm"),
								weight("medium"),
								fg("neutral"),
								cursor("pointer"),
								transition("background-color, border-color, color"),
								when("&:hover", fg("neutral.emphasis")),
								precededBy("input:checked", [
									bg("brand.tint"),
									fg("brand"),
									border("brand.border"),
								]),
								precededBy("input:focus-visible", outline({ color: "brand.ring", offset: -2 })),
								media(SIDE_BY_SIDE, [
									raw({ gridColumn: "1" }),
									p(4, 5),
									rounded("none"),
									border("transparent"),
									borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
									borderEdge("inline-start", { color: "transparent", width: 2, style: "solid" }),
									precededBy(
										"input:checked",
										borderEdge("inline-start", { color: "brand", width: 2, style: "solid" }),
									),
								]),
							]}
						>
							{group.title}
							<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>
								{group.packages.length}
							</span>
						</label>

						<section
							aria-label={group.title}
							mix={[
								hidden(),
								raw({ flexBasis: "100%" }),
								p(5, 0, 0, 0),
								precededBy("input:checked", vstack({ gap: 5, align: "stretch" })),
								media(SIDE_BY_SIDE, [
									/*
									 * The group list sets the inspector's height and the panel fills it: size
									 * containment keeps a long group from stretching every row of the list, and
									 * what does not fit scrolls inside the panel.
									 */
									raw({
										gridColumn: "2",
										gridRow: `2 / span ${groups.length}`,
										contain: "size",
										overflowY: "auto",
										overscrollBehavior: "contain",
									}),
									p(6, 8),
									borderEdge("inline-start", { color: "neutral.border", width: 1, style: "solid" }),
								]),
							]}
						>
							<ul
								mix={[
									grid(),
									gap(1),
									m(0),
									p(0),
									listStyle("none"),
									gridTemplate({ columns: "minmax(0, 1fr)" }),
									media(
										"(min-width: 40rem)",
										gridTemplate({ columns: repeat("auto-fill", "minmax(16rem, 1fr)") }),
									),
								]}
							>
								{group.packages.map((entry) => (
									<li key={entry.name}>
										<a
											href={routes.api.show.href({ name: entry.directory })}
											mix={[
												vstack({ gap: 1, align: "stretch" }),
												p(3),
												rounded("lg"),
												transition("background-color"),
												when("&:hover", bg("neutral.tint")),
												when("&:focus-visible", outline({ color: "brand.ring", offset: 0 })),
											]}
										>
											<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>
												{entry.name}
											</code>
											<span mix={[text("sm"), fg("neutral")]}>{entry.description}</span>
										</a>
									</li>
								))}
							</ul>
						</section>
					</div>
				))}
			</form>
		);
	};
}
