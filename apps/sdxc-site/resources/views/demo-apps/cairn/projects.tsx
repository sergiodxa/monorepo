/**
 * Cairn's projects: every project as a row with its health, lead, progress and target date,
 * active first and completed below; and one project's page, its progress and dates over the
 * list of its issues, which filters, groups and opens issues like any other list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChartGanttIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";

import type { Health, Project } from "./data";
import type { Points } from "./progress";
import type { IssueView, VisitorState } from "./state";

import { HEALTH_NAMES, LOCALE, PROJECTS, findPerson, findTeam, href } from "./data";
import { PersonTile, ProjectGlyph } from "./glyphs";
import { percent, projectPoints, share } from "./progress";
import { CairnShell } from "./shell";

/** Each health's dot colour. */
const HEALTH_COLOR: Record<Health, string> = {
	"on-track": "var(--ui-brand-fg)",
	"at-risk": "oklch(0.72 0.15 75)",
	"off-track": "var(--ui-danger-fg)",
	planned: "var(--ui-neutral-fg-muted)",
	completed: "oklch(0.6 0.13 245)",
};

/** Formats a target date. */
export const TARGET_DATE = new Intl.DateTimeFormat(LOCALE, {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

/** Formats a `YYYY-MM-DD` date for a label. */
export function formatDay(day: string): string {
	return TARGET_DATE.format(new Date(`${day}T00:00:00Z`));
}

/** A health word with its dot. */
export function HealthBadge(handle: Handle<{ health: Health }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.375rem",
					fontSize: "0.8125rem",
					color: "var(--ui-neutral-fg)",
					whiteSpace: "nowrap",
				}),
			]}
		>
			<span
				aria-hidden="true"
				mix={[
					raw({
						inlineSize: "0.5rem",
						blockSize: "0.5rem",
						borderRadius: "999px",
						backgroundColor: HEALTH_COLOR[handle.props.health],
					}),
				]}
			/>
			{HEALTH_NAMES[handle.props.health]}
		</span>
	);
}

/** A thin progress bar with its percentage, named for a screen reader. */
export function ProgressMeter(handle: Handle<{ points: Points; label: string; wide?: boolean }>) {
	return () => {
		let { points: value, label, wide = false } = handle.props;
		return (
			<span
				mix={[
					raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem", minInlineSize: 0 }),
				]}
			>
				<meter
					min={0}
					max={1}
					value={share(value)}
					aria-label={label}
					mix={[
						raw({
							appearance: "none",
							inlineSize: wide ? "12rem" : "5rem",
							maxInlineSize: "100%",
							blockSize: "0.375rem",
							border: "0",
							borderRadius: "999px",
							overflow: "hidden",
							backgroundColor: "var(--ui-neutral-bg-tint-pressed, var(--ui-neutral-border))",
							"&::-webkit-meter-bar": {
								background: "transparent",
								border: "0",
								blockSize: "0.375rem",
							},
							"&::-webkit-meter-optimum-value": {
								background: "var(--ui-brand-bg-solid)",
								borderRadius: "999px",
							},
							"&::-moz-meter-bar": {
								background: "var(--ui-brand-bg-solid)",
								borderRadius: "999px",
							},
						}),
					]}
				/>
				<span
					mix={[
						raw({
							minInlineSize: "2.5rem",
							fontSize: "0.8125rem",
							fontVariantNumeric: "tabular-nums",
							color: "var(--ui-neutral-fg)",
						}),
					]}
				>
					{percent(value)}
				</span>
			</span>
		);
	};
}

/** One project row: glyph and name, health, lead, progress and target date. */
function ProjectRow(handle: Handle<{ project: Project; issues: IssueView[] }>) {
	return () => {
		let { project, issues } = handle.props;
		let value = projectPoints(project, issues);
		let lead = findPerson(project.lead);
		let late = project.projected !== undefined;
		return (
			<li
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr) 7rem 2rem 9rem 7.5rem",
						alignItems: "center",
						gap: "1rem",
						minBlockSize: "3.25rem",
						paddingInline: "1rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
						"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
						"@container cairn-projects (width < 44rem)": {
							gridTemplateColumns: "minmax(0, 1fr) auto",
							gridTemplateAreas: '"name name" "health progress" "date lead"',
							rowGap: "0.375rem",
							paddingBlock: "0.75rem",
						},
					}),
				]}
			>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.625rem",
							minInlineSize: 0,
							"@container cairn-projects (width < 44rem)": { gridArea: "name" },
						}),
					]}
				>
					<ProjectGlyph hue={project.hue} />
					<span mix={[raw({ display: "flex", flexDirection: "column", minInlineSize: 0 })]}>
						<a
							href={href(`projects/${project.id}`)}
							data-rmx-prefetch="intent"
							mix={[
								raw({
									fontSize: "0.875rem",
									fontWeight: "500",
									color: "var(--ui-neutral-fg-emphasis)",
									textDecoration: "none",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									"&::after": { content: '""', position: "absolute", inset: "0" },
									"&:focus-visible": { outline: "none" },
									"&:focus-visible::after": { boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" },
								}),
							]}
						>
							{project.name}
						</a>
						<span
							mix={[
								raw({
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}),
							]}
						>
							{findTeam(project.team)?.name} · {project.summary}
						</span>
					</span>
				</span>
				<HealthBadge health={project.health} />
				<span
					mix={[
						raw({
							"@container cairn-projects (width < 44rem)": { gridArea: "lead", justifySelf: "end" },
						}),
					]}
				>
					<PersonTile person={lead} size={22} />
				</span>
				<ProgressMeter points={value} label={`${project.name} progress`} />
				<span
					mix={[
						raw({
							fontSize: "0.8125rem",
							whiteSpace: "nowrap",
							fontVariantNumeric: "tabular-nums",
							color: late ? "var(--ui-danger-fg)" : "var(--ui-neutral-fg)",
							"@container cairn-projects (width < 44rem)": { gridArea: "date" },
						}),
					]}
				>
					<span
						mix={[
							raw({
								position: "absolute",
								inlineSize: "1px",
								blockSize: "1px",
								overflow: "hidden",
								clipPath: "inset(50%)",
							}),
						]}
					>
						Target{" "}
					</span>
					{formatDay(project.target)}
				</span>
			</li>
		);
	};
}

/** The projects overview. */
export function ProjectsScreen(
	handle: Handle<{ state: VisitorState; issues: IssueView[]; collapsed: boolean }>,
) {
	return () => {
		let { state, issues, collapsed } = handle.props;
		let active = PROJECTS.filter((project) => project.health !== "completed");
		let done = PROJECTS.filter((project) => project.health === "completed");
		let section = (title: string, projects: Project[]) => (
			<section
				aria-labelledby={`projects-${title}`}
				mix={[raw({ display: "flex", flexDirection: "column" })]}
			>
				<h2
					id={`projects-${title}`}
					mix={[
						raw({
							margin: "0",
							display: "flex",
							gap: "0.5rem",
							alignItems: "baseline",
							padding: "0.5rem 1rem",
							fontSize: "0.8125rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					{title}
					<span mix={[raw({ fontWeight: "400", color: "var(--ui-neutral-fg-muted)" })]}>
						{projects.length}
					</span>
				</h2>
				<ul mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}>
					{projects.map((project) => (
						<ProjectRow project={project} issues={issues} />
					))}
				</ul>
			</section>
		);

		return (
			<CairnShell
				current="projects"
				collapsed={collapsed}
				crumb="Projects"
				state={state}
				from="projects"
				flush
			>
				<div
					mix={[
						raw({
							container: "cairn-projects / inline-size",
							display: "flex",
							flexDirection: "column",
						}),
					]}
				>
					<header
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "1rem",
								flexWrap: "wrap",
								padding: "1rem",
							}),
						]}
					>
						<div
							mix={[
								raw({
									flex: "1 1 16rem",
									display: "flex",
									flexDirection: "column",
									gap: "0.125rem",
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
								Projects
							</h1>
							<p
								mix={[
									raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
								]}
							>
								{`${active.length} active · progress counts estimate points done`}
							</p>
						</div>
						<LinkButton
							href={href("roadmap")}
							size="sm"
							variant="outline"
							color="neutral"
							data-rmx-prefetch="intent"
						>
							<ChartGanttIcon size={16} aria-hidden="true" />
							Open roadmap
						</LinkButton>
					</header>
					<div mix={[raw({ borderBlockStart: "1px solid var(--ui-neutral-border)" })]}>
						{section("Active", active)}
						{section("Completed", done)}
					</div>
				</div>
			</CairnShell>
		);
	};
}

/** A project's summary card over its issue list: health, lead, dates and progress. */
export function ProjectHeader(handle: Handle<{ project: Project; issues: IssueView[] }>) {
	return () => {
		let { project, issues } = handle.props;
		let value = projectPoints(project, issues);
		let lead = findPerson(project.lead);
		let fact = (label: string, value: unknown) => (
			<div
				mix={[raw({ display: "flex", flexDirection: "column", gap: "0.25rem", minInlineSize: 0 })]}
			>
				<dt mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>{label}</dt>
				<dd
					mix={[
						raw({
							margin: "0",
							fontSize: "0.875rem",
							color: "var(--ui-neutral-fg-emphasis)",
							minBlockSize: "1.375rem",
							display: "flex",
							alignItems: "center",
							gap: "0.375rem",
						}),
					]}
				>
					{value as never}
				</dd>
			</div>
		);
		return (
			<dl
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
						gap: "0.75rem 1.5rem",
						margin: "0",
						padding: "0.875rem 1rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg, 0.375rem)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
					}),
				]}
			>
				{fact("Health", <HealthBadge health={project.health} />)}
				{fact(
					"Lead",
					<>
						<PersonTile person={lead} size={18} decorative />
						{lead?.name}
					</>,
				)}
				{fact("Progress", <ProgressMeter points={value} label={`${project.name} progress`} />)}
				{fact("Dates", `${formatDay(project.start)} – ${formatDay(project.target)}`)}
				{project.projected
					? fact(
							"Projected",
							<span mix={[raw({ color: "var(--ui-danger-fg)" })]}>
								{formatDay(project.projected)}
							</span>,
						)
					: null}
			</dl>
		);
	};
}
