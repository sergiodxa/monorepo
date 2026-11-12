/**
 * Cairn's cycles: each team's two-week cycles with their points and progress, and one cycle's
 * page, its figures and burn-up chart streamed in as frames over placeholders of their exact
 * size, above the list of the cycle's issues.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Chart } from "@sdxc/ui/app/chart";
import { Skeleton } from "@sdxc/ui/app/skeleton";

import DemoAppFrame from "../frame";

import type { Cycle } from "./data";
import type { IssueView, VisitorState } from "./state";

import { CYCLES, LOCALE, TEAMS, TODAY, cyclePhase, href, SLUG } from "./data";
import { cyclePoints, percent } from "./progress";
import { ProgressMeter, formatDay } from "./projects";
import { CairnShell } from "./shell";

/** Days in a cycle. */
const CYCLE_DAYS = 14;

/** The chart's drawing box; the page scales it to the column, keeping this ratio. */
const CHART_SIZE = { width: 960, height: 220 } as const;

/** What a cycle's phase reads as. */
const PHASE_NAMES = { past: "Completed", current: "Current", upcoming: "Upcoming" } as const;

/** Formats a day label under the chart. */
const AXIS_DAY = new Intl.DateTimeFormat(LOCALE, {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** The `YYYY-MM-DD` day `offset` days after `day`. */
function addDays(day: string, offset: number): string {
	let date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + offset);
	return date.toISOString().slice(0, 10);
}

/** Days since a cycle started, today included; 0 before it starts, the whole cycle once over. */
export function elapsedDays(cycle: Cycle): number {
	let phase = cyclePhase(cycle);
	if (phase === "upcoming") return 0;
	if (phase === "past") return CYCLE_DAYS;
	let start = Date.parse(`${cycle.start}T00:00:00Z`);
	let today = Date.parse(`${TODAY}T00:00:00Z`);
	return Math.round((today - start) / 86_400_000) + 1;
}

/**
 * The burn-up's two series, one value per day: today's figure from the issues as the visitor
 * sees them, the days before it as the recorded history's changes counted back from today,
 * so a visitor's edit moves the whole line, and nothing for the days still ahead.
 */
export function burnUp(
	cycle: Cycle,
	issues: IssueView[],
): { scope: Array<number | null>; done: Array<number | null> } {
	let elapsed = elapsedDays(cycle);
	let live = cyclePoints(cycle, issues);
	let scope: Array<number | null> = [];
	let done: Array<number | null> = [];
	let recorded = Math.min(elapsed - 1, cycle.history.scope.length);
	let scopeEnd = cycle.history.scope[recorded - 1] ?? live.total;
	let doneEnd = cycle.history.done[recorded - 1] ?? live.done;
	for (let day = 0; day < CYCLE_DAYS; day++) {
		if (day >= elapsed) {
			scope.push(null);
			done.push(null);
		} else if (day === elapsed - 1) {
			scope.push(live.total);
			done.push(live.done);
		} else {
			scope.push(Math.max(0, live.total - (scopeEnd - (cycle.history.scope[day] ?? scopeEnd))));
			done.push(
				Math.min(
					live.done,
					Math.max(0, live.done - (doneEnd - (cycle.history.done[day] ?? doneEnd))),
				),
			);
		}
	}
	return { scope, done };
}

/** The highest value the chart's axis needs, rounded up to a multiple of five. */
function ceiling(values: Array<number | null>): number {
	let top = Math.max(5, ...values.map((value) => value ?? 0));
	return Math.ceil(top / 5) * 5;
}

/** One figure in the stats row; as a ghost, its words drawn as bars. */
function Figure(handle: Handle<{ label: string; value: string; detail: string; ghost: boolean }>) {
	return () => {
		let { label, value, detail, ghost } = handle.props;
		let shown = (text: string) => (ghost ? <Skeleton.Text>{text}</Skeleton.Text> : text);
		return (
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.25rem",
						minInlineSize: 0,
						padding: "0.75rem 1rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg, 0.375rem)",
					}),
				]}
			>
				<dt
					mix={[
						raw({ fontSize: "0.75rem", lineHeight: "1rem", color: "var(--ui-neutral-fg-muted)" }),
					]}
				>
					{shown(label)}
				</dt>
				<dd
					mix={[
						raw({
							margin: "0",
							fontSize: "1.375rem",
							lineHeight: "1.75rem",
							fontWeight: "600",
							fontVariantNumeric: "tabular-nums",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{shown(value)}
				</dd>
				<dd
					mix={[
						raw({
							margin: "0",
							fontSize: "0.75rem",
							lineHeight: "1rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{shown(detail)}
				</dd>
			</div>
		);
	};
}

/**
 * A cycle's figures: scope, finished, still open and days left; the `cycles/<id>/stats` frame.
 * As a ghost it is the frame's placeholder, every line a bar the width of its words.
 */
export function CycleStats(handle: Handle<{ cycle: Cycle; issues: IssueView[]; ghost?: boolean }>) {
	return () => {
		let { cycle, issues, ghost = false } = handle.props;
		let live = cyclePoints(cycle, issues);
		let mine = issues.filter((issue) => issue.cycle === cycle.id);
		let open = mine.filter(
			(issue) => issue.status !== "done" && issue.status !== "canceled",
		).length;
		let left = CYCLE_DAYS - elapsedDays(cycle);
		let start = cycle.history.scope[0];
		return (
			<dl
				aria-hidden={ghost ? "true" : undefined}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
						gap: "0.75rem",
						margin: "0",
					}),
				]}
			>
				<Figure
					ghost={ghost}
					label="Scope"
					value={`${live.total} pts`}
					detail={
						start === undefined
							? "Not started"
							: `${live.total - start >= 0 ? "+" : ""}${live.total - start} since day one`
					}
				/>
				<Figure
					ghost={ghost}
					label="Completed"
					value={percent(live)}
					detail={`${live.done} of ${live.total} points`}
				/>
				<Figure
					ghost={ghost}
					label="Open issues"
					value={String(open)}
					detail={`${mine.length} in the cycle`}
				/>
				<Figure
					ghost={ghost}
					label="Time left"
					value={left === 0 ? "Ended" : `${left} days`}
					detail={`Ends ${formatDay(cycle.end)}`}
				/>
			</dl>
		);
	};
}

/** The caption under the chart, which its placeholder draws as bars too. */
const CAPTION = "Solid: points completed. Upper line: scope. Dashed: an even pace to the end.";

/** The burn-up chart, its day row and its caption; the `cycles/<id>/chart` frame. */
export function BurnUpChart(handle: Handle<{ cycle: Cycle; issues: IssueView[] }>) {
	return () => {
		let { cycle, issues } = handle.props;
		let { scope, done } = burnUp(cycle, issues);
		let total =
			[...scope].reverse().find((value) => value !== null) ?? cycle.history.scope.at(-1) ?? 0;
		let top = ceiling(scope);
		let day = (index: number) =>
			AXIS_DAY.format(new Date(`${addDays(cycle.start, index)}T00:00:00Z`));
		let series = (values: Array<number | null>, name: string) =>
			values.map((y, x) => ({
				x,
				y,
				label: y === null ? `${day(x)}: no data yet` : `${name}, ${day(x)}: ${y} points`,
			}));
		let ideal = Array.from(
			{ length: CYCLE_DAYS },
			(_, x) => Math.round((total * x * 10) / (CYCLE_DAYS - 1)) / 10,
		);

		return (
			<figure mix={[raw({ display: "flex", flexDirection: "column", gap: "0.5rem", margin: "0" })]}>
				<Chart
					width={CHART_SIZE.width}
					height={CHART_SIZE.height}
					xDomain={[0, CYCLE_DAYS - 1]}
					yDomain={[0, top]}
					aria-label={`Burn-up for cycle ${cycle.number}: points completed and scope by day`}
					mix={[
						raw({
							inlineSize: "100%",
							blockSize: "auto",
							display: "block",
							"--ui-chart-1": "var(--ui-brand-fg)",
							"--ui-chart-2": "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<Chart.Line points={series(ideal, "Even pace")} comparison color={2} />
					<Chart.Line points={series(scope, "Scope")} color={2} />
					<Chart.Line points={series(done, "Completed")} />
				</Chart>
				<div
					aria-hidden="true"
					mix={[
						raw({
							display: "flex",
							justifyContent: "space-between",
							fontSize: "0.75rem",
							lineHeight: "1rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<span>{day(0)}</span>
					<span>{day(7)}</span>
					<span>{day(CYCLE_DAYS - 1)}</span>
				</div>
				<figcaption
					mix={[
						raw({
							fontSize: "0.8125rem",
							lineHeight: "1.25rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{CAPTION}
				</figcaption>
			</figure>
		);
	};
}

/** The chart's placeholder: the plot at its ratio, the day row, and the caption as a bar. */
export function BurnUpPlaceholder() {
	return () => (
		<div
			aria-hidden="true"
			mix={[raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })]}
		>
			<div
				mix={[
					raw({
						inlineSize: "100%",
						aspectRatio: `${CHART_SIZE.width} / ${CHART_SIZE.height}`,
						borderRadius: "var(--ui-radius-md, 0.25rem)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
					}),
				]}
			/>
			<div mix={[raw({ fontSize: "0.75rem", lineHeight: "1rem", visibility: "hidden" })]}>
				&nbsp;
			</div>
			<div mix={[raw({ fontSize: "0.8125rem", lineHeight: "1.25rem" })]}>
				<Skeleton.Text>{CAPTION}</Skeleton.Text>
			</div>
		</div>
	);
}

/** A cycle's header over its issue list: dates and phase, then the two frames. */
export function CycleHeader(handle: Handle<{ cycle: Cycle; issues: IssueView[] }>) {
	return () => {
		let { cycle, issues } = handle.props;
		return (
			<div mix={[raw({ display: "flex", flexDirection: "column", gap: "1rem" })]}>
				<DemoAppFrame
					app={SLUG}
					part={`cycles/${cycle.id}/stats`}
					fallback={<CycleStats cycle={cycle} issues={issues} ghost />}
				/>
				<DemoAppFrame
					app={SLUG}
					part={`cycles/${cycle.id}/chart`}
					fallback={<BurnUpPlaceholder />}
				/>
			</div>
		);
	};
}

/** One cycle as a row of the cycles list. */
function CycleRow(handle: Handle<{ cycle: Cycle; issues: IssueView[] }>) {
	return () => {
		let { cycle, issues } = handle.props;
		let phase = cyclePhase(cycle);
		let live = cyclePoints(cycle, issues);
		return (
			<li
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr) 6rem 9rem",
						alignItems: "center",
						gap: "1rem",
						minBlockSize: "3.25rem",
						paddingInline: "1rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
						"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
						"@container cairn-cycles (width < 32rem)": {
							gridTemplateColumns: "minmax(0, 1fr) auto",
						},
					}),
				]}
			>
				<span mix={[raw({ display: "flex", flexDirection: "column", minInlineSize: 0 })]}>
					<a
						href={href(`cycles/${cycle.id}`)}
						data-rmx-prefetch="intent"
						mix={[
							raw({
								fontSize: "0.875rem",
								fontWeight: "500",
								color: "var(--ui-neutral-fg-emphasis)",
								textDecoration: "none",
								"&::after": { content: '""', position: "absolute", inset: "0" },
								"&:focus-visible": { outline: "none" },
								"&:focus-visible::after": { boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" },
							}),
						]}
					>
						{`Cycle ${cycle.number}`}
					</a>
					<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
						{`${formatDay(cycle.start)} – ${formatDay(cycle.end)} · ${live.total} points`}
					</span>
				</span>
				<span
					mix={[
						raw({
							fontSize: "0.8125rem",
							fontWeight: phase === "current" ? "600" : "400",
							color: phase === "current" ? "var(--ui-brand-fg)" : "var(--ui-neutral-fg-muted)",
							"@container cairn-cycles (width < 32rem)": { display: "none" },
						}),
					]}
				>
					{PHASE_NAMES[phase]}
				</span>
				<ProgressMeter points={live} label={`Cycle ${cycle.number} progress`} />
			</li>
		);
	};
}

/** The cycles screen: each team's cycles, newest first. */
export function CyclesScreen(
	handle: Handle<{ state: VisitorState; issues: IssueView[]; collapsed: boolean }>,
) {
	return () => {
		let { state, issues, collapsed } = handle.props;
		return (
			<CairnShell
				current="cycles"
				collapsed={collapsed}
				crumb="Cycles"
				state={state}
				from="cycles"
				flush
			>
				<div
					mix={[
						raw({
							container: "cairn-cycles / inline-size",
							display: "flex",
							flexDirection: "column",
						}),
					]}
				>
					<header
						mix={[
							raw({ display: "flex", flexDirection: "column", gap: "0.125rem", padding: "1rem" }),
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
							Cycles
						</h1>
						<p
							mix={[
								raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							Two weeks each. Open a cycle for its burn-up.
						</p>
					</header>
					{TEAMS.map((team) => (
						<section aria-labelledby={`cycles-${team.id}`}>
							<h2
								id={`cycles-${team.id}`}
								mix={[
									raw({
										margin: "0",
										padding: "0.5rem 1rem",
										fontSize: "0.8125rem",
										fontWeight: "600",
										color: "var(--ui-neutral-fg-emphasis)",
										backgroundColor: "var(--ui-neutral-bg-tint)",
										borderBlock: "1px solid var(--ui-neutral-border)",
									}),
								]}
							>
								{team.name}
							</h2>
							<ul mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}>
								{CYCLES.filter((cycle) => cycle.team === team.id)
									.slice()
									.reverse()
									.map((cycle) => (
										<CycleRow cycle={cycle} issues={issues} />
									))}
							</ul>
						</section>
					))}
				</div>
			</CairnShell>
		);
	};
}

/** A cycle's title and one-line summary for its list screen. */
export function cycleTitle(cycle: Cycle): { title: string; description: string } {
	let team = TEAMS.find((candidate) => candidate.id === cycle.team);
	return {
		title: `${team?.name ?? ""} · Cycle ${cycle.number}`,
		description: `${PHASE_NAMES[cyclePhase(cycle)]}, ${formatDay(cycle.start)} – ${formatDay(cycle.end)}`,
	};
}
