/**
 * The `package-groups` tag: the published collection as an inspector, the groups listed
 * down one side and the packages of the one picked filling the other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
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

import type { PackageEntry, PackageGroup } from "~/app/services/packages";
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
									raw({
										gridColumn: "2",
										gridRow: `2 / span ${groups.length}`,
										contain: "size",
										overflowY: "auto",
									}),
									p(6, 8),
									borderEdge("inline-start", { color: "neutral.border", width: 1, style: "solid" }),
								]),
							]}
						>
							<PanelHeader group={group} />
							{group.packages.length === 1 && group.packages[0] ? (
								<SpecSheet entry={group.packages[0]} />
							) : (
								<ul
									mix={[
										grid(),
										raw({ columnGap: "1.5rem" }),
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
										<li
											key={entry.name}
											mix={[
												borderEdge("block-start", {
													color: "neutral.border",
													width: 1,
													style: "solid",
												}),
											]}
										>
											<a
												href={routes.api.show.href({ name: entry.directory })}
												mix={[
													vstack({ gap: 1, align: "stretch" }),
													p(3, 2),
													raw({ marginInline: "-0.5rem" }),
													rounded("md"),
													transition("background-color"),
													when("&:hover", bg("neutral.tint")),
													when("&:focus-visible", outline({ color: "brand.ring", offset: 0 })),
												]}
											>
												<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>
													{entry.name}
												</code>
												<span mix={[text("sm"), fg("neutral")]}>{entry.description}</span>
												<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>
													{facts(entry).join(" · ")}
												</span>
											</a>
										</li>
									))}
								</ul>
							)}
						</section>
					</div>
				))}
			</form>
		);
	};
}

/**
 * Opens a panel with the group's name and what its packages have in common, so a group
 * of one reads as a chosen subject rather than a sparse list.
 */
function PanelHeader(handle: Handle<{ group: PackageGroup }>) {
	return () => {
		let { group } = handle.props;
		let standalone = group.packages.filter((entry) => entry.standalone).length;
		let frameworkFree = group.packages.filter((entry) => entry.frameworkFree).length;
		let counts = [plural(group.packages.length, "package")];
		if (standalone > 0) counts.push(`${standalone} standalone`);
		if (frameworkFree > 0) counts.push(`${frameworkFree} framework-free`);

		return (
			<div
				mix={[
					hstack({ gap: 4, align: "baseline", justify: "between" }),
					flexWrap("wrap"),
					raw({ rowGap: "0.25rem" }),
				]}
			>
				<h3 mix={[m(0), text("lg"), weight("semibold"), tracking("tight"), fg("neutral.emphasis")]}>
					{group.title}
				</h3>
				<p mix={[m(0), font("mono"), text("xs"), fg("neutral.muted")]}>{counts.join(" · ")}</p>
			</div>
		);
	};
}

/**
 * Lays a group's only package out as a spec sheet: how to install it, what it exports and
 * what it brings along, each on a ruled row with the value at the inline end.
 */
function SpecSheet(handle: Handle<{ entry: PackageEntry }>) {
	return () => {
		let { entry } = handle.props;
		let rows: { term: string; value: RemixNode }[] = [
			{ term: "Install", value: <code>npm add {entry.name}</code> },
			{
				term: "Entry points",
				value: entry.subpaths.map((subpath) => (
					<code key={subpath} mix={[raw({ display: "block" })]}>
						{subpath === "." ? entry.name : `${entry.name}/${subpath.replace(/^\.\//, "")}`}
					</code>
				)),
			},
			{
				term: "From the collection",
				value:
					entry.internalDependencies.length === 0
						? "Nothing"
						: plural(entry.internalDependencies.length, "package"),
			},
			{
				term: "From outside it",
				value:
					entry.externalDependencies.length === 0
						? "Nothing"
						: entry.externalDependencies.join(", "),
			},
			{ term: "Peers", value: entry.peers.length === 0 ? "None" : entry.peers.join(", ") },
			{ term: "Licence", value: entry.license ?? "Unstated" },
		];

		return (
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<p mix={[m(0), text("base"), fg("neutral")]}>{entry.description}</p>
				<dl mix={[m(0), vstack({ gap: 0, align: "stretch" })]}>
					{rows.map((row) => (
						<div
							key={row.term}
							mix={[
								grid(),
								gridTemplate({ columns: "minmax(0, 10rem) minmax(0, 1fr)" }),
								gap(4),
								p(3, 0),
								borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
							]}
						>
							<dt
								mix={[
									font("mono"),
									text("xs"),
									textTransform("uppercase"),
									tracking("wider"),
									fg("neutral.muted"),
									raw({ paddingBlockStart: "0.125rem" }),
								]}
							>
								{row.term}
							</dt>
							<dd
								mix={[
									m(0),
									font("mono"),
									text("sm"),
									fg("neutral.emphasis"),
									raw({ textAlign: "end", overflowWrap: "anywhere" }),
								]}
							>
								{row.value}
							</dd>
						</div>
					))}
				</dl>
				<a
					href={routes.api.show.href({ name: entry.directory })}
					mix={[
						hstack({ gap: 1, align: "center" }),
						raw({ alignSelf: "flex-start" }),
						text("sm"),
						weight("medium"),
						fg("brand"),
					]}
				>
					Read the {entry.name} reference
					<ArrowRightIcon size={14} aria-hidden="true" />
				</a>
			</div>
		);
	};
}

/** The short facts a package row closes on: its entry points, and what it asks for. */
function facts(entry: PackageEntry): string[] {
	let list = [plural(entry.subpaths.length, "entry point")];
	if (entry.standalone) list.push("standalone");
	else if (entry.peers.length > 0) list.push(`needs ${entry.peers.join(", ")}`);
	return list;
}

/** A count and its noun, with the noun in the plural for anything but one. */
function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
