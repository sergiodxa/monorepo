/**
 * One workflow run: its summary (what started it, where it stands, how long it took and what
 * it kept), the job graph with its matrix folded into one group, and the findings it raised
 * against real lines; and one job's log, its failed step open and a running step streaming.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CircleXIcon, FileCodeIcon, PackageIcon, TriangleAlertIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { Badge, HeadingScope, RelativeTime } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { LogViewer } from "@sdxc/ui/app/log-viewer";
import { StatCard } from "@sdxc/ui/app/stat-card";

import type { DeltaAnchor } from "~/app/services/delta/source";

import { demoAppStreamHref } from "~/resources/views/demo-apps";

import type { Annotation, Job, Run } from "../seed/actions";

import { SLUG, actionsHref, commitHref, linesHref, runHref, shortSha } from "../data";
import { InitialsTile } from "../glyphs";
import { COPY, LOG_LABELS } from "../labels";
import { LIVE, formatDuration } from "../seed/actions";
import { RepoHeader } from "../shell";

import { BranchPill, StateIcon } from "./ci-parts";

/** The address of a live job's stream, after the lines the page already holds. */
const streamHref = demoAppStreamHref(SLUG);

/** A run's status as one word, for the header and the summary. */
function statusWord(run: Run): string {
	return COPY.actions.statuses[run.status];
}

namespace RunHeader {
	export interface Props {
		run: Run;
		commits: number;
		/** The job the page shows; none on the summary. */
		job?: Job;
	}
}

/** Renders a run's header: its title, the trail back to Actions, and its state in words. */
function RunHeader(handle: Handle<RunHeader.Props>) {
	return () => {
		let { commits, job, run } = handle.props;
		let number = `${run.workflow.name} #${run.id}`;
		return (
			<RepoHeader
				title={job === undefined ? run.title : job.name}
				trail={[
					{ label: COPY.actions.title, href: actionsHref() },
					job === undefined ? { label: number } : { label: number, href: runHref(run.id) },
					...(job === undefined ? [] : [{ label: job.name }]),
				]}
				parent={
					job === undefined
						? { href: actionsHref(), label: COPY.actions.title }
						: { href: runHref(run.id), label: number }
				}
				tab="actions"
				commits={commits}
				description={
					<span
						mix={[
							raw({
								display: "inline-flex",
								flexWrap: "wrap",
								alignItems: "center",
								gap: "0.5rem",
							}),
							text("sm"),
							fg("neutral.muted"),
						]}
					>
						<StateIcon state={job === undefined ? run.status : job.state} />
						<span mix={[weight("medium"), fg("neutral.emphasis")]}>
							{job === undefined ? statusWord(run) : LOG_LABELS.states[job.state]}
						</span>
						<span>{job === undefined ? number : `${number} · ${run.title}`}</span>
					</span>
				}
			/>
		);
	};
}

/** Renders the stat row: what started the run, where it stands, how long, what it kept. */
function SummaryStats(handle: Handle<{ run: Run; now: number }>) {
	return () => {
		let { now, run } = handle.props;
		return (
			<StatCard.Group columns={4} aria-label={COPY.run.summary}>
				<StatCard>
					<StatCard.Label>{COPY.run.triggered}</StatCard.Label>
					<StatCard.Value mix={[text("lg")]}>{COPY.run.events[run.event]}</StatCard.Value>
					<StatCard.Footer>
						<span
							mix={[
								raw({
									display: "inline-flex",
									flexWrap: "wrap",
									alignItems: "center",
									gap: "0.375rem",
								}),
							]}
						>
							<InitialsTile name={run.actor} size={16} />
							<span mix={[weight("medium"), fg("neutral.emphasis")]}>{run.actor}</span>
							<a
								href={commitHref(run.sha)}
								data-rmx-prefetch="intent"
								mix={[font("mono"), fg("neutral.emphasis")]}
							>
								{shortSha(run.sha)}
							</a>
							<BranchPill name={run.branch} />
						</span>
					</StatCard.Footer>
				</StatCard>
				<StatCard>
					<StatCard.Label>{COPY.run.status}</StatCard.Label>
					<StatCard.Value mix={[text("lg")]}>
						<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })]}>
							<StateIcon state={run.status} />
							{statusWord(run)}
						</span>
					</StatCard.Value>
					<StatCard.Footer>
						<RelativeTime date={new Date(run.startedAt).toISOString()} now={now} locale="en" />
					</StatCard.Footer>
				</StatCard>
				<StatCard>
					<StatCard.Label>{COPY.run.duration}</StatCard.Label>
					<StatCard.Value mix={[text("lg"), font("mono"), tabularNums()]}>
						{formatDuration(run.seconds)}
					</StatCard.Value>
					<StatCard.Footer>
						{run.status === "in_progress" ? COPY.run.runningFor : run.workflow.file}
					</StatCard.Footer>
				</StatCard>
				<StatCard>
					<StatCard.Label>{COPY.run.artifacts}</StatCard.Label>
					<StatCard.Value mix={[text("lg"), tabularNums()]}>
						{run.artifacts.length === 0 ? "—" : String(run.artifacts.length)}
					</StatCard.Value>
					<StatCard.Footer>
						{run.artifacts.length === 0 ? COPY.run.artifactsNone : COPY.run.keptFor}
					</StatCard.Footer>
				</StatCard>
			</StatCard.Group>
		);
	};
}

namespace JobCard {
	export interface Props {
		run: Run;
		job: Job;
		/** Inside a matrix group, which draws the frame. */
		nested?: boolean;
	}
}

/** Renders one job in the graph: its state, name and time, linking to its log. */
function JobCard(handle: Handle<JobCard.Props>) {
	return () => {
		let { job, nested = false, run } = handle.props;
		return (
			<a
				href={runHref(run.id, job.n)}
				data-rmx-prefetch="intent"
				data-job={job.n}
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						minInlineSize: 0,
						paddingBlock: "0.5rem",
						paddingInline: "0.625rem",
						borderRadius: "var(--ui-radius-md)",
						textDecoration: "none",
						color: "inherit",
						background: "var(--ui-bg)",
						border: nested ? "1px solid transparent" : "1px solid var(--ui-neutral-border)",
						"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
						"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-1px" },
					}),
					text("sm"),
				]}
			>
				<StateIcon state={job.state} />
				<span
					mix={[
						raw({
							flex: "1 1 auto",
							minInlineSize: 0,
							overflow: "hidden",
							textOverflow: "ellipsis",
						}),
						raw({ whiteSpace: "nowrap" }),
						weight("medium"),
					]}
				>
					{job.name}
				</span>
				<span mix={[text("xs"), fg("neutral.muted"), font("mono"), tabularNums()]}>
					{job.seconds === undefined ? "" : formatDuration(job.seconds)}
				</span>
			</a>
		);
	};
}

/** The jobs of one column of the graph, with each matrix gathered into one group. */
function columnsOf(jobs: readonly Job[]): Array<Array<{ matrix?: string; jobs: Job[] }>> {
	let stages = new Map<number, Array<{ matrix?: string; jobs: Job[] }>>();
	for (let job of jobs) {
		let column = stages.get(job.stage) ?? [];
		stages.set(job.stage, column);
		let group = job.matrix === undefined ? undefined : column.find((g) => g.matrix === job.matrix);
		if (group === undefined) column.push({ matrix: job.matrix, jobs: [job] });
		else group.jobs.push(job);
	}
	return [...stages.entries()].sort(([a], [b]) => a - b).map(([, column]) => column);
}

/**
 * Renders the job graph: one column per stage, joined by connector lines drawn in CSS, each
 * matrix one framed group saying how many of its jobs are done. A graph wider than its pane
 * scrolls inside its own box.
 */
function JobGraph(handle: Handle<{ run: Run }>) {
	return () => {
		let { run } = handle.props;
		let columns = columnsOf(run.jobs);
		return (
			<section aria-labelledby="delta-run-graph" mix={[raw({ display: "grid", gap: "0.5rem" })]}>
				<h2
					id="delta-run-graph"
					mix={[
						text("sm"),
						weight("semibold"),
						raw({
							margin: 0,
							display: "flex",
							flexWrap: "wrap",
							gap: "0.5rem",
							alignItems: "baseline",
						}),
					]}
				>
					{COPY.run.jobs}
					<span mix={[font("mono"), text("xs"), weight("normal"), fg("neutral.muted")]}>
						{`${run.workflow.file.split("/").at(-1)} · ${COPY.run.on(run.event)}`}
					</span>
				</h2>
				<div
					role="group"
					aria-label={COPY.run.graph}
					data-slot="delta-job-graph"
					mix={[
						raw({
							overflowX: "auto",
							overscrollBehaviorInline: "contain",
							padding: "1.25rem",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-lg)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							backgroundImage:
								"radial-gradient(circle, color-mix(in oklch, var(--ui-neutral-border) 70%, transparent) 1px, transparent 1px)",
							backgroundSize: "14px 14px",
						}),
					]}
				>
					<ol
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "2.5rem",
								margin: 0,
								padding: 0,
								listStyle: "none",
								inlineSize: "max-content",
							}),
						]}
					>
						{columns.map((column, index) => (
							<li
								data-stage={index}
								mix={[
									raw({
										display: "grid",
										gap: "0.75rem",
										inlineSize: "15rem",
									}),
								]}
							>
								{column.map((group) => (
									<GraphNode first={index === 0} last={index === columns.length - 1}>
										{group.matrix === undefined ? (
											<JobCard run={run} job={group.jobs[0]!} />
										) : (
											<MatrixGroup run={run} name={group.matrix} jobs={group.jobs} />
										)}
									</GraphNode>
								))}
							</li>
						))}
					</ol>
				</div>
			</section>
		);
	};
}

/** The connector's colour and weight. */
const WIRE = "2px solid var(--ui-neutral-border-hover, var(--ui-neutral-border))";

/** Half the gap between two columns, where the vertical wire between them runs. */
const HALF_GAP = "1.25rem";

/**
 * One segment of a connector: a horizontal stub at the node's middle, or the node's share of
 * the vertical wire between columns, which runs from the middle of the first node in the column
 * to the middle of the last, so the stubs from both sides meet on one line.
 */
function wire(side: "in" | "out") {
	let edge = side === "in" ? "insetInlineStart" : "insetInlineEnd";
	let vertical = (top: string, bottom: string) => ({
		content: '""',
		position: "absolute",
		[edge]: `calc(-1 * ${HALF_GAP} - 1px)`,
		insetBlock: `${top} ${bottom}`,
		borderInlineStart: WIRE,
	});
	let rules: Record<string, Record<string, string>> = {
		[`& > [data-wire=${side}-h]`]: {
			position: "absolute",
			insetBlockStart: "calc(50% - 1px)",
			[edge]: `calc(-1 * ${HALF_GAP})`,
			inlineSize: HALF_GAP,
			borderBlockStart: WIRE,
		},
		[`&:first-child:not(:last-child) > [data-wire=${side}-v]`]: vertical("50%", "-0.375rem"),
		[`&:not(:first-child):not(:last-child) > [data-wire=${side}-v]`]: vertical(
			"-0.375rem",
			"-0.375rem",
		),
		[`&:last-child:not(:first-child) > [data-wire=${side}-v]`]: vertical("-0.375rem", "50%"),
	};
	return raw(rules as Parameters<typeof raw>[0]);
}

namespace GraphNode {
	export interface Props {
		/** The node sits in the first column, so nothing leads into it. */
		first: boolean;
		/** The node sits in the last column, so nothing leads out of it. */
		last: boolean;
		children: RemixNode;
	}
}

/** Wraps a job or a matrix with the wires that lead into it and out of it. */
function GraphNode(handle: Handle<GraphNode.Props>) {
	return () => {
		let { children, first, last } = handle.props;
		return (
			<div
				mix={[
					raw({ position: "relative", display: "grid" }),
					...(first ? [] : [wire("in")]),
					...(last ? [] : [wire("out")]),
				]}
			>
				{first ? null : <span aria-hidden="true" data-wire="in-h" />}
				{first ? null : <span aria-hidden="true" data-wire="in-v" />}
				{children}
				{last ? null : <span aria-hidden="true" data-wire="out-h" />}
				{last ? null : <span aria-hidden="true" data-wire="out-v" />}
			</div>
		);
	};
}

namespace MatrixGroup {
	export interface Props {
		run: Run;
		name: string;
		jobs: Job[];
	}
}

/** Renders a matrix as one framed card: its name, how many of its jobs are done, then each job. */
function MatrixGroup(handle: Handle<MatrixGroup.Props>) {
	return () => {
		let { jobs, name, run } = handle.props;
		let done = jobs.filter((job) => job.state !== "running" && job.state !== "queued").length;
		return (
			<div
				role="group"
				aria-label={COPY.run.matrix(name, done, jobs.length)}
				mix={[
					raw({
						display: "grid",
						gap: "0.125rem",
						padding: "0.375rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						background: "var(--ui-bg)",
					}),
				]}
			>
				<span
					mix={[
						raw({ paddingInline: "0.375rem", paddingBlock: "0.25rem 0.375rem" }),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					{COPY.run.matrix(name, done, jobs.length)}
				</span>
				{jobs.map((job) => (
					<JobCard run={run} job={job} nested />
				))}
			</div>
		);
	};
}

namespace Annotations {
	export interface Props {
		run: Run;
		anchors: Record<string, DeltaAnchor>;
	}
}

/** The line a finding cites, as a link, or why it can't link: the lines have changed since. */
function CitedLines(handle: Handle<{ anchor: DeltaAnchor | undefined }>) {
	return () => {
		let { anchor } = handle.props;
		if (anchor === undefined) return null;
		if (anchor.status === "outdated") {
			return (
				<span mix={[raw({ display: "inline-flex", gap: "0.375rem", alignItems: "center" })]}>
					<span mix={[font("mono")]}>{anchor.path}</span>
					<Badge variant="outline" color="neutral">
						{COPY.run.outdated}
					</Badge>
				</span>
			);
		}
		let range =
			anchor.start === anchor.end ? `L${anchor.start}` : `L${anchor.start}-L${anchor.end}`;
		return (
			<a
				href={linesHref(anchor.path, anchor.start, anchor.end)}
				data-rmx-prefetch="intent"
				mix={[
					raw({ display: "inline-flex", gap: "0.375rem", alignItems: "center" }),
					font("mono"),
					fg("brand"),
				]}
			>
				<FileCodeIcon size={13} aria-hidden="true" />
				{`${anchor.path}#${range}`}
			</a>
		);
	};
}

/** Renders the run's findings, errors first, each citing the real lines it is about. */
function Annotations(handle: Handle<Annotations.Props>) {
	return () => {
		let { anchors, run } = handle.props;
		if (run.annotations.length === 0) return null;
		let errors = run.annotations.filter((note) => note.level === "failure").length;
		let warnings = run.annotations.length - errors;
		let sorted = [...run.annotations].sort(
			(a, b) => Number(a.level === "warning") - Number(b.level === "warning"),
		);
		return (
			<section
				aria-labelledby="delta-run-annotations"
				mix={[raw({ display: "grid", gap: "0.5rem" })]}
			>
				<h2
					id="delta-run-annotations"
					mix={[
						text("sm"),
						weight("semibold"),
						raw({
							margin: 0,
							display: "flex",
							gap: "0.5rem",
							alignItems: "baseline",
							flexWrap: "wrap",
						}),
					]}
				>
					{COPY.run.annotations}
					<span mix={[text("xs"), weight("normal"), fg("neutral.muted")]}>
						{COPY.run.annotationsCount(errors, warnings)}
					</span>
				</h2>
				<ul
					mix={[
						raw({
							listStyle: "none",
							margin: 0,
							padding: 0,
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-lg)",
							background: "var(--ui-bg)",
						}),
					]}
				>
					{sorted.map((note) => (
						<AnnotationRow
							run={run}
							note={note}
							anchor={note.anchor ? anchors[note.anchor] : undefined}
						/>
					))}
				</ul>
			</section>
		);
	};
}

/** One finding: its level, the job it came from, its message and the lines it cites. */
function AnnotationRow(handle: Handle<{ run: Run; note: Annotation; anchor?: DeltaAnchor }>) {
	return () => {
		let { anchor, note, run } = handle.props;
		let failure = note.level === "failure";
		return (
			<li
				data-annotation={note.level}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "auto minmax(0, 1fr)",
						columnGap: "0.625rem",
						rowGap: "0.25rem",
						padding: "0.75rem 1rem",
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&:first-child": { borderBlockStart: "0" },
					}),
				]}
			>
				<span
					role="img"
					aria-label={failure ? LOG_LABELS.states.failure : COPY.run.warning}
					mix={[
						raw({ paddingBlockStart: "0.125rem", display: "inline-flex" }),
						fg(failure ? "danger" : "warning"),
					]}
				>
					{failure ? (
						<CircleXIcon size={16} aria-hidden="true" />
					) : (
						<TriangleAlertIcon size={16} aria-hidden="true" />
					)}
				</span>
				<a
					href={runHref(run.id, note.job)}
					data-rmx-prefetch="intent"
					mix={[
						text("sm"),
						weight("semibold"),
						fg("neutral.emphasis"),
						raw({ justifySelf: "start" }),
					]}
				>
					{note.title}
				</a>
				<p
					mix={[
						raw({
							gridColumn: "2",
							margin: 0,
							whiteSpace: "pre-wrap",
							overflowWrap: "anywhere",
						}),
						font("mono"),
						text("xs"),
						fg(failure ? "danger" : "neutral.emphasis"),
					]}
				>
					{note.message}
				</p>
				{anchor === undefined ? null : (
					<span
						mix={[raw({ gridColumn: "2", minInlineSize: 0, overflowWrap: "anywhere" }), text("xs")]}
					>
						<CitedLines anchor={anchor} />
					</span>
				)}
			</li>
		);
	};
}

/** Renders the files the run kept, each with its size. */
function Artifacts(handle: Handle<{ run: Run }>) {
	return () => {
		let { run } = handle.props;
		if (run.artifacts.length === 0) return null;
		return (
			<section
				aria-labelledby="delta-run-artifacts"
				mix={[raw({ display: "grid", gap: "0.5rem" })]}
			>
				<h2 id="delta-run-artifacts" mix={[text("sm"), weight("semibold"), raw({ margin: 0 })]}>
					{COPY.run.artifacts}
				</h2>
				<ul
					mix={[
						raw({
							listStyle: "none",
							margin: 0,
							padding: 0,
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-lg)",
						}),
					]}
				>
					{run.artifacts.map((artifact) => (
						<li
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.625rem",
									padding: "0.625rem 1rem",
									borderBlockStart: "1px solid var(--ui-neutral-border)",
									"&:first-child": { borderBlockStart: "0" },
								}),
								text("sm"),
							]}
						>
							<PackageIcon size={16} aria-hidden="true" mix={[fg("neutral.muted")]} />
							<span
								mix={[
									font("mono"),
									raw({ flex: "1 1 auto", minInlineSize: 0, overflowWrap: "anywhere" }),
								]}
							>
								{artifact.name}
							</span>
							<span mix={[text("xs"), fg("neutral.muted"), tabularNums()]}>{artifact.size}</span>
						</li>
					))}
				</ul>
			</section>
		);
	};
}

namespace RunScreen {
	export interface Props {
		run: Run;
		anchors: Record<string, DeltaAnchor>;
		commits: number;
		now: number;
	}
}

/** Renders a run's summary: the stat row, the job graph, its findings and what it kept. */
export function RunScreen(handle: Handle<RunScreen.Props>) {
	return () => {
		let { anchors, commits, now, run } = handle.props;
		return (
			<>
				<RunHeader run={run} commits={commits} />
				<HeadingScope level={2}>
					<div mix={[raw({ display: "grid", gap: "1.5rem", paddingBlockStart: "1rem" })]}>
						<SummaryStats run={run} now={now} />
						<JobGraph run={run} />
						<Annotations run={run} anchors={anchors} />
						<Artifacts run={run} />
					</div>
				</HeadingScope>
			</>
		);
	};
}

/** Renders the run's jobs as the list beside a log, the open one marked. */
function JobNav(handle: Handle<{ run: Run; current: number }>) {
	return () => {
		let { current, run } = handle.props;
		return (
			<nav
				aria-label={COPY.run.jobNav}
				mix={[
					raw({
						display: "none",
						alignSelf: "start",
						position: "sticky",
						insetBlockStart: "calc(var(--ui-app-sticky-top, 3.5rem) + 0.5rem)",
						"@container delta-job (min-width: 52rem)": { display: "grid" },
						gap: "0.125rem",
					}),
				]}
			>
				<a
					href={runHref(run.id)}
					data-rmx-prefetch="intent"
					mix={[
						text("sm"),
						weight("medium"),
						fg("neutral.muted"),
						raw({
							padding: "0.375rem 0.625rem",
							textDecoration: "none",
							borderRadius: "var(--ui-radius-md)",
						}),
						raw({ "&:hover": { background: "var(--ui-neutral-bg-tint-hover)" } }),
					]}
				>
					{COPY.run.backToRun}
				</a>
				<span
					mix={[
						text("xs"),
						weight("semibold"),
						fg("neutral.muted"),
						raw({
							padding: "0.75rem 0.625rem 0.25rem",
							textTransform: "uppercase",
							letterSpacing: "0.04em",
						}),
					]}
				>
					{COPY.run.jobs}
				</span>
				{run.jobs.map((job) => (
					<a
						href={runHref(run.id, job.n)}
						data-rmx-prefetch="intent"
						aria-current={job.n === current ? "page" : undefined}
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								padding: "0.375rem 0.625rem",
								borderRadius: "var(--ui-radius-md)",
								textDecoration: "none",
								color: "inherit",
								"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
								"&[aria-current=page]": {
									background: "color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent)",
									fontWeight: "600",
								},
							}),
							text("sm"),
						]}
					>
						<StateIcon state={job.state} />
						<span mix={[raw({ flex: "1 1 auto", minInlineSize: 0, overflowWrap: "anywhere" })]}>
							{job.name}
						</span>
					</a>
				))}
			</nav>
		);
	};
}

namespace JobScreen {
	export interface Props {
		run: Run;
		job: Job;
		url: URL;
		commits: number;
		now: number;
	}
}

/** Draws a job that has no log yet: waiting for a runner, or skipped because an earlier job failed. */
function NoLog(handle: Handle<{ job: Job }>) {
	return () => (
		<Empty kind="first-run" size="compact">
			<Empty.Title>
				{handle.props.job.state === "queued" ? COPY.run.queued : COPY.run.skipped}
			</Empty.Title>
			<Empty.Description>
				{handle.props.job.state === "queued" ? COPY.run.queuedHint : COPY.run.skippedHint}
			</Empty.Description>
		</Empty>
	);
}

/**
 * Renders one job: the run's jobs beside its log, the failed step open, a running step
 * streaming its lines in, and the timestamps toggle as a GET link.
 */
export function JobScreen(handle: Handle<JobScreen.Props>) {
	return () => {
		let { commits, job, run, url } = handle.props;
		let timestamps = url.searchParams.get("ts") === "1";
		let page = runHref(run.id, job.n);
		let steps: LogViewer.Step[] = job.steps.map((step, index) => ({
			name: step.name,
			state: step.state,
			duration: step.seconds === undefined ? undefined : formatDuration(step.seconds),
			lines: step.lines,
			...(step.state === "running" && run.id === LIVE.run && job.n === LIVE.job
				? {
						stream: {
							src: streamHref(
								`runs/${run.id}/job/${job.n}?step=${index + 1}&after=${step.lines.at(-1)?.n ?? 0}`,
							),
							refresh: timestamps ? `${page}?ts=1` : page,
						},
					}
				: {}),
		}));
		let body: RemixNode =
			job.state === "queued" || job.state === "skipped" ? (
				<NoLog job={job} />
			) : (
				<LogViewer
					steps={steps}
					lineHref={(step, n) => `#step:${step}:${n}`}
					timestamps={timestamps}
					timestampsHref={timestamps ? page : `${page}?ts=1`}
					labels={LOG_LABELS}
					aria-label={`${job.name} log`}
				/>
			);
		return (
			<>
				<RunHeader run={run} job={job} commits={commits} />
				<HeadingScope level={2}>
					<div
						mix={[
							raw({
								containerName: "delta-job",
								containerType: "inline-size",
								paddingBlockStart: "1rem",
							}),
						]}
					>
						<div
							data-delta-job={job.n}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "minmax(0, 1fr)",
									gap: "1rem",
									alignItems: "start",
									"@container delta-job (min-width: 52rem)": {
										gridTemplateColumns: "13rem minmax(0, 1fr)",
									},
								}),
							]}
						>
							<JobNav run={run} current={job.n} />
							<div mix={[raw({ minInlineSize: 0 })]}>{body}</div>
						</div>
					</div>
				</HeadingScope>
			</>
		);
	};
}
