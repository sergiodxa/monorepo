/**
 * Cairn's roadmap: every project as a bar on a shared timeline, grouped by the quarter it
 * starts in, filled to its progress, with today's line through every row and a hatched tail
 * on the projects running late. Active and closed projects are two tabs in the address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LayersIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";
import { Roadmap } from "@sdxc/ui/app/roadmap";
import { Sparkline } from "@sdxc/ui/app/sparkline";
import { TAB_BAR_BLOCK_SIZE } from "@sdxc/ui/app/tab-bar";
import { Frame } from "remix/component";

import type { Project } from "./data";
import type { IssueView, VisitorState } from "./state";

import { LOCALE, PROJECTS, TODAY, findPerson, href } from "./data";
import { PersonTile, ProjectGlyph } from "./glyphs";
import { ROADMAP_LABELS } from "./labels";
import { frameSrc } from "./list";
import { projectPoints, share } from "./progress";
import { HealthBadge } from "./projects";
import { CairnShell } from "./shell";

/** Each tab's first and last days: today a third of the way in for active work. */
const RANGES = {
	active: { start: "2026-08-24", end: "2027-04-04" },
	closed: { start: "2026-06-29", end: "2026-11-29" },
} as const;

/** Which projects the roadmap shows. */
export type RoadmapTab = "active" | "closed";

/** The quarter a project starts in, such as "Q4 2026". */
function quarter(project: Project): string {
	let [year = "", month = "1"] = project.start.split("-");
	return `Q${Math.floor((Number(month) - 1) / 3) + 1} ${year}`;
}

/**
 * A small burn-up for a bar: the share done at each of five checkpoints from the project's
 * start to today, rising to its progress now.
 */
function trend(done: number): number[] {
	let curve = [0, 0.18, 0.42, 0.7, 1];
	return curve.map((step) => Math.round(step * done * 100) / 100);
}

/** The frame holding the roadmap's timeline and its tabs, which a tab reloads alone. */
export const ROADMAP_FRAME = "cairn-roadmap";

/**
 * Renders the roadmap screen: its title, and the timeline as {@link ROADMAP_FRAME}, loaded from
 * this same address, so Active and Closed swap the timeline and nothing around it.
 */
export function RoadmapScreen(
	handle: Handle<{ state: VisitorState; collapsed: boolean; url: URL }>,
) {
	return () => {
		let { state, collapsed, url } = handle.props;
		return (
			<CairnShell
				current="roadmap"
				collapsed={collapsed}
				crumb="Roadmap"
				state={state}
				from="roadmap"
				flush
			>
				<div
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							blockSize: `calc(100dvh - var(--ui-app-header-height, 3.5rem) - ${TAB_BAR_BLOCK_SIZE})`,
							"@media (min-width: 48rem)": {
								blockSize:
									"calc(100dvh - var(--ui-app-header-height, 3.5rem) - 2 * var(--ui-app-inset-gap, 0.5rem) - 2px)",
							},
						}),
					]}
				>
					<header
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.75rem",
								flexWrap: "wrap",
								padding: "0.875rem 1rem",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<h1
							mix={[
								raw({
									margin: "0",
									fontSize: "1.125rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							Roadmap
						</h1>
						<p
							mix={[
								raw({
									margin: "0",
									flex: "1 1 12rem",
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Bars fill as estimate points close. A hatched tail runs to a late project's projected
							date.
						</p>
						<LinkButton
							href={href("projects")}
							size="sm"
							variant="outline"
							color="neutral"
							data-rmx-prefetch="intent"
						>
							<LayersIcon size={16} aria-hidden="true" />
							All projects
						</LinkButton>
					</header>
					<Frame name={ROADMAP_FRAME} src={frameSrc(url)} />
				</div>
			</CairnShell>
		);
	};
}

/**
 * The content of {@link ROADMAP_FRAME}: the tab's projects on a timeline grouped by the quarter
 * each starts in, with the tabs in its header so the current one is marked by the same answer.
 */
export function RoadmapTimeline(handle: Handle<{ issues: IssueView[]; tab: RoadmapTab }>) {
	return () => {
		let { issues, tab } = handle.props;
		let shown = PROJECTS.filter(
			(project) => (project.health === "completed") === (tab === "closed"),
		);
		let quarters = [...new Set(shown.map(quarter))].sort((a, b) => {
			let [qa = "", ya = ""] = a.split(" ");
			let [qb = "", yb = ""] = b.split(" ");
			return ya.localeCompare(yb) || qa.localeCompare(qb);
		});
		let tabLink = (value: RoadmapTab, label: string) => (
			<a
				href={href(value === "active" ? "roadmap" : "roadmap?show=closed")}
				data-rmx-target={ROADMAP_FRAME}
				aria-current={tab === value ? "page" : undefined}
				data-rmx-prefetch="intent"
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						blockSize: "1.75rem",
						paddingInline: "0.625rem",
						borderRadius: "var(--ui-radius-md, 0.25rem)",
						fontSize: "0.8125rem",
						fontWeight: "500",
						color: "var(--ui-neutral-fg-muted)",
						textDecoration: "none",
						"&[aria-current='page']": {
							color: "var(--ui-neutral-fg-emphasis)",
							backgroundColor: "var(--ui-neutral-bg-tint-pressed, var(--ui-neutral-bg-tint))",
						},
						"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
					}),
				]}
			>
				{label}
			</a>
		);

		return (
			<Roadmap
				label="Projects on a timeline"
				start={RANGES[tab].start}
				end={RANGES[tab].end}
				today={TODAY}
				locale={LOCALE}
				labels={ROADMAP_LABELS}
				header={
					<nav aria-label="Roadmap tabs" mix={[raw({ display: "flex", gap: "0.25rem" })]}>
						{tabLink("active", "Active")}
						{tabLink("closed", "Closed")}
					</nav>
				}
				mix={[raw({ flex: "1 1 auto", minBlockSize: 0 })]}
			>
				{quarters.map((name) => (
					<Roadmap.Group title={name}>
						{shown
							.filter((project) => quarter(project) === name)
							.map((project) => {
								let done = share(projectPoints(project, issues));
								return (
									<Roadmap.Item
										name={project.name}
										href={href(`projects/${project.id}`)}
										icon={<ProjectGlyph hue={project.hue} />}
										meta={
											<>
												<HealthBadge health={project.health} />
												<PersonTile person={findPerson(project.lead)} size={20} />
											</>
										}
										start={project.start}
										end={project.target}
										progress={done}
										projectedEnd={project.projected}
										trailing={
											project.health === "planned" ? null : (
												<Sparkline
													values={trend(done)}
													label={`${project.name} burn-up`}
													dot={false}
													domain={[0, 1]}
													parts={{ plot: [raw({ inlineSize: "2rem", blockSize: "0.875rem" })] }}
												/>
											)
										}
									/>
								);
							})}
					</Roadmap.Group>
				))}
			</Roadmap>
		);
	};
}
