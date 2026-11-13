/**
 * Delta's Actions: every workflow run as a two-line row (its state, the commit it built,
 * which workflow and what started it, the branch, when and how long), narrowed by workflow,
 * status, branch and actor in the address, and refreshed on its own every 30 seconds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CalendarIcon, CirclePlayIcon, TimerIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { HeadingScope, RelativeTime } from "@sdxc/ui";
import { paramValues } from "@sdxc/ui/app";
import { AutoRefresh } from "@sdxc/ui/app/auto-refresh";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";

import type { Run, RunStatus } from "../seed/actions";

import { runHref, shortSha } from "../data";
import { COPY, REFRESH_LABELS, RUNS_FILTER_LABELS } from "../labels";
import { WORKFLOWS, formatDuration } from "../seed/actions";
import { RepoHeader } from "../shell";

import { BranchPill, StateIcon } from "./ci-parts";

/** The statuses the facet offers, in the order a list reads them. */
const STATUSES: RunStatus[] = ["in_progress", "failure", "success", "cancelled"];

/** The intervals the refresh control offers, in seconds. */
const INTERVALS = [0, 10, 30, 60];

/** The interval in force while the address names none. */
const DEFAULT_INTERVAL = 30;

/** The facets a run is filtered by, each one repeated search parameter. */
type FacetName = "workflow" | "status" | "branch" | "actor" | "q";

/** A run's value for each facet. */
function facetValue(run: Run, facet: Exclude<FacetName, "q">): string {
	if (facet === "workflow") return run.workflow.id;
	if (facet === "status") return run.status;
	if (facet === "branch") return run.branch;
	return run.actor;
}

/**
 * The runs the address keeps, leaving out one facet when asked, so a facet's counts say how
 * many runs each of its values would show alongside the other filters.
 */
function filterRuns(runs: readonly Run[], url: URL, skip?: FacetName): Run[] {
	let query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
	return runs.filter((run) => {
		for (let facet of ["workflow", "status", "branch", "actor"] as const) {
			if (facet === skip) continue;
			let values = paramValues(url, facet);
			if (values.length > 0 && !values.includes(facetValue(run, facet))) return false;
		}
		return skip === "q" || query === "" || run.title.toLowerCase().includes(query);
	});
}

/** The line under a run's title: which workflow, its number, and what started it. */
function triggerLine(run: Run): string {
	let events = COPY.actions.events;
	let trigger = "";
	if (run.event === "push") trigger = events.push(shortSha(run.sha), run.actor);
	else if (run.event === "pull_request") trigger = events.pull_request(run.pr ?? 0, run.actor);
	else if (run.event === "schedule") trigger = events.schedule();
	else trigger = events.workflow_dispatch(run.actor);
	return `${run.workflow.name} #${run.id}: ${trigger}`;
}

namespace RunRow {
	export interface Props {
		run: Run;
		now: number;
	}
}

/**
 * Renders one run as a 65px two-line row: the state, the title linking to the run and the
 * trigger under it, then the branch and the start and run time stacked at the end; on a
 * phone the branch and times drop under the title.
 */
export function RunRow(handle: Handle<RunRow.Props>) {
	return () => {
		let { now, run } = handle.props;
		return (
			<li
				data-run={run.id}
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "auto minmax(0, 1fr)",
						gridTemplateAreas: '"icon title" ". meta"',
						columnGap: "0.75rem",
						rowGap: "0.375rem",
						alignItems: "center",
						minBlockSize: "4.0625rem",
						paddingBlock: "0.625rem",
						paddingInline: "1rem",
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&:first-child": { borderBlockStart: "0" },
						"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
						"&:has(a:focus-visible)": {
							outline: "2px solid var(--ui-brand-ring)",
							outlineOffset: "-2px",
						},
						"@container delta-runs (min-width: 40rem)": {
							gridTemplateColumns: "auto minmax(0, 1fr) 9rem 8.5rem",
							gridTemplateAreas: '"icon title branch meta"',
						},
					}),
				]}
			>
				<span mix={[raw({ gridArea: "icon", alignSelf: "start", paddingBlockStart: "0.125rem" })]}>
					<StateIcon state={run.status} />
				</span>
				<span
					mix={[raw({ gridArea: "title", display: "grid", gap: "0.125rem", minInlineSize: 0 })]}
				>
					<a
						href={runHref(run.id)}
						data-rmx-prefetch="intent"
						mix={[
							text("sm"),
							weight("semibold"),
							fg("neutral.emphasis"),
							raw({
								textDecoration: "none",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								outline: "none",
								"&::after": { content: '""', position: "absolute", inset: 0 },
								"&:hover": { textDecoration: "underline" },
							}),
						]}
					>
						{run.title}
					</a>
					<span
						mix={[
							text("xs"),
							fg("neutral.muted"),
							raw({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
						]}
					>
						<span mix={[weight("medium"), fg("neutral.emphasis")]}>
							{`${run.workflow.name} #${run.id}`}
						</span>
						{triggerLine(run).slice(`${run.workflow.name} #${run.id}`.length)}
					</span>
				</span>
				<span
					mix={[
						raw({
							gridArea: "branch",
							display: "none",
							minInlineSize: 0,
							"@container delta-runs (min-width: 40rem)": { display: "block" },
						}),
					]}
				>
					<BranchPill name={run.branch} />
				</span>
				<span
					mix={[
						raw({
							gridArea: "meta",
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							gap: "0.25rem 0.75rem",
							minInlineSize: 0,
							"@container delta-runs (min-width: 40rem)": {
								display: "grid",
								gap: "0.25rem",
							},
						}),
						text("xs"),
						fg("neutral.muted"),
						tabularNums(),
					]}
				>
					<span
						mix={[
							raw({
								display: "inline",
								minInlineSize: 0,
								"@container delta-runs (min-width: 40rem)": { display: "none" },
							}),
						]}
					>
						<BranchPill name={run.branch} />
					</span>
					<span
						title={COPY.actions.started}
						mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}
					>
						<CalendarIcon size={13} aria-hidden="true" />
						<RelativeTime date={new Date(run.startedAt).toISOString()} now={now} locale="en" />
					</span>
					<span
						title={COPY.actions.duration}
						mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}
					>
						<TimerIcon size={13} aria-hidden="true" />
						<span mix={[font("mono")]}>{formatDuration(run.seconds)}</span>
					</span>
				</span>
			</li>
		);
	};
}

namespace RunList {
	export interface Props {
		runs: readonly Run[];
		now: number;
		label: string;
	}
}

/** Renders runs as one bordered list, the container its rows lay out against. */
export function RunList(handle: Handle<RunList.Props>) {
	return () => (
		<ul
			aria-label={handle.props.label}
			mix={[
				raw({
					containerName: "delta-runs",
					containerType: "inline-size",
					listStyle: "none",
					margin: 0,
					padding: 0,
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-lg)",
					background: "var(--ui-bg)",
					overflow: "clip",
				}),
			]}
		>
			{handle.props.runs.map((run) => (
				<RunRow run={run} now={handle.props.now} />
			))}
		</ul>
	);
}

namespace RunsBody {
	export interface Props {
		runs: readonly Run[];
		shown: readonly Run[];
		now: number;
	}
}

/**
 * Renders the runs the filters keep, or why there are none: no history to build yet, or no
 * run matching the filters, cleared from the filter bar above.
 */
function RunsBody(handle: Handle<RunsBody.Props>) {
	return () => {
		let { now, runs, shown } = handle.props;
		if (runs.length === 0) {
			return (
				<Empty kind="first-run" icon={<CirclePlayIcon />}>
					<Empty.Title>{COPY.actions.emptyTitle}</Empty.Title>
					<Empty.Description>{COPY.actions.emptyHint}</Empty.Description>
				</Empty>
			);
		}
		if (shown.length === 0) {
			return (
				<Empty kind="no-results" icon={<CirclePlayIcon />}>
					<Empty.Title>{COPY.actions.noneTitle}</Empty.Title>
					<Empty.Description>{COPY.actions.noneHint}</Empty.Description>
				</Empty>
			);
		}
		return <RunList runs={shown} now={now} label={COPY.actions.list} />;
	};
}

namespace ActionsScreen {
	export interface Props {
		runs: readonly Run[];
		url: URL;
		commits: number;
		now: number;
	}
}

/**
 * Renders the runs list under the repository header: the filter bar with its facets and the
 * refresh control, then the rows, or the state that says why there are none.
 */
export function ActionsScreen(handle: Handle<ActionsScreen.Props>) {
	return () => {
		let { commits, now, runs } = handle.props;
		let url = new URL(handle.props.url);
		url.searchParams.delete(DEMO_APP_TOAST_PARAM);
		let shown = filterRuns(runs, url);
		let refresh = Number(url.searchParams.get("refresh") ?? DEFAULT_INTERVAL);
		let autoRefresh = {
			id: "delta-runs-refresh",
			url,
			value: INTERVALS.includes(refresh) ? refresh : DEFAULT_INTERVAL,
			defaultValue: DEFAULT_INTERVAL,
			options: INTERVALS.map((value) => ({
				value,
				label: value === 0 ? COPY.actions.refreshOff : COPY.actions.every(value),
			})),
			frame: "main",
			refreshedAt: new Date(now),
			locale: "en",
			labels: REFRESH_LABELS,
		};
		let count = (facet: Exclude<FacetName, "q">, value: string) =>
			filterRuns(runs, url, facet).filter((run) => facetValue(run, facet) === value).length;
		let unique = (facet: "branch" | "actor") => [...new Set(runs.map((run) => run[facet]))].sort();
		return (
			<>
				<RepoHeader
					title={COPY.actions.title}
					trail={[{ label: COPY.actions.title }]}
					tab="actions"
					commits={commits}
					description={COPY.actions.description}
				/>
				<HeadingScope level={2}>
					<div mix={[raw({ display: "grid", gap: "0.75rem", paddingBlockStart: "1rem" })]}>
						<FilterBar
							id="delta-runs"
							url={url}
							prefetch="intent"
							locale="en"
							search={{
								label: COPY.actions.search,
								placeholder: COPY.actions.searchPlaceholder,
							}}
							facets={[
								{
									name: "workflow",
									label: COPY.actions.workflow,
									options: WORKFLOWS.map((workflow) => ({
										value: workflow.id,
										label: workflow.name,
										count: count("workflow", workflow.id),
									})),
								},
								{
									name: "status",
									label: COPY.actions.status,
									options: STATUSES.map((status) => ({
										value: status,
										label: COPY.actions.statuses[status],
										count: count("status", status),
										icon: <StateIcon state={status} />,
									})),
								},
								{
									name: "branch",
									label: COPY.actions.branch,
									options: unique("branch").map((branch) => ({
										value: branch,
										label: branch,
										count: count("branch", branch),
									})),
								},
								{
									name: "actor",
									label: COPY.actions.actor,
									options: unique("actor").map((actor) => ({
										value: actor,
										label: actor,
										count: count("actor", actor),
									})),
								},
							]}
							options={<AutoRefresh {...autoRefresh} show="choices" />}
							status={<AutoRefresh {...autoRefresh} show="status" />}
							collapse
							labels={RUNS_FILTER_LABELS}
						/>
						<p
							aria-live="polite"
							mix={[text("sm"), weight("semibold"), raw({ margin: 0 }), tabularNums()]}
						>
							{COPY.actions.runs(shown.length)}
						</p>
						<RunsBody runs={runs} shown={shown} now={now} />
					</div>
				</HeadingScope>
			</>
		);
	};
}
