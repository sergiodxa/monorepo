/**
 * Delta's dashboard and its own 404. The dashboard answers one question, what needs you: your
 * open pull requests and who they wait on, the issues assigned to you, the runs that failed,
 * then the repository and its newest real commits. The 404 leads back to the code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArchiveIcon, BookOpenIcon, CompassIcon, TrashIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { Button, HeadingScope, LinkButton, RelativeTime } from "@sdxc/ui";
import { CheckRunIcon } from "@sdxc/ui/app/check-runs";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";

import type { DeltaCommit, DeltaCommitMeta, DeltaHistory } from "~/app/services/delta/source";

import type { RepoSettings } from "../prefs";
import type { PullView } from "../pull-records";
import type { IssueView } from "../records";
import type { Run } from "../seed/actions";

import {
	actionHref,
	actionsHref,
	commitsHref,
	href,
	issueHref,
	issuesHref,
	joinNames,
	pullHref,
	pullsHref,
	repoHref,
	runHref,
} from "../data";
import { COPY } from "../labels";
import { checksState } from "../pull-records";
import { formatDuration } from "../seed/actions";
import { StateIcon as RecordIcon } from "../states";

import { StateIcon } from "./ci-parts";
import { CommitList, CommitRow } from "./commits";

/** How many commits the dashboard lists. */
const RECENT = 5;

/** A section's box, its rows ruled between. */
function Rows(handle: Handle<{ label: string; children: RemixNode }>) {
	return () => (
		<ul
			aria-label={handle.props.label}
			mix={[
				raw({
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
			{handle.props.children}
		</ul>
	);
}

namespace Row {
	export interface Props {
		icon: RemixNode;
		href: string;
		title: string;
		/** The line under the title. */
		meta: RemixNode;
		/** What sits at the row's end, such as the checks' state. */
		end?: RemixNode;
	}
}

/** One row of a "needs you" list: an icon, the title linking to the record, a line under it. */
function Row(handle: Handle<Row.Props>) {
	return () => {
		let { end, href: link, icon, meta, title } = handle.props;
		return (
			<li
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "auto minmax(0, 1fr) auto",
						columnGap: "0.75rem",
						alignItems: "start",
						padding: "0.625rem 1rem",
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&:first-child": { borderBlockStart: "0" },
						"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
						"&:has(a:focus-visible)": {
							outline: "2px solid var(--ui-brand-ring)",
							outlineOffset: "-2px",
						},
					}),
				]}
			>
				<span mix={[raw({ display: "inline-flex", paddingBlockStart: "0.125rem" })]}>{icon}</span>
				<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: 0 })]}>
					<a
						href={link}
						data-rmx-prefetch="intent"
						mix={[
							text("sm"),
							weight("semibold"),
							fg("neutral.emphasis"),
							raw({
								textDecoration: "none",
								overflowWrap: "anywhere",
								outline: "none",
								"&::after": { content: '""', position: "absolute", inset: 0 },
								"&:hover": { textDecoration: "underline" },
							}),
						]}
					>
						{title}
					</a>
					<span mix={[text("xs"), fg("neutral.muted"), raw({ overflowWrap: "anywhere" })]}>
						{meta}
					</span>
				</span>
				{end === undefined ? null : (
					<span mix={[raw({ display: "inline-flex", paddingBlockStart: "0.125rem" })]}>{end}</span>
				)}
			</li>
		);
	};
}

namespace Section {
	export interface Props {
		id: string;
		title: string;
		count: number;
		/** The full list this section is a slice of. */
		all: { href: string; label: string };
		/** Said in place of the rows when there are none. */
		empty: string;
		children: RemixNode;
	}
}

/** One question of the dashboard: a heading with its count, the rows, and the way to the rest. */
function Section(handle: Handle<Section.Props>) {
	return () => {
		let { all, children, count, empty, id, title } = handle.props;
		return (
			<section aria-labelledby={id} mix={[raw({ display: "grid", gap: "0.5rem" })]}>
				<div
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "0.25rem 1rem",
						}),
					]}
				>
					<h2
						id={id}
						mix={[
							text("sm"),
							weight("semibold"),
							raw({ margin: 0, display: "flex", gap: "0.5rem", alignItems: "baseline" }),
						]}
					>
						{title}
						<span mix={[text("xs"), fg("neutral.muted"), tabularNums(), weight("normal")]}>
							{String(count)}
						</span>
					</h2>
					<a
						href={all.href}
						data-rmx-prefetch="intent"
						mix={[text("xs"), fg("brand"), raw({ textDecoration: "none" })]}
					>
						{all.label}
					</a>
				</div>
				{count === 0 ? (
					<p
						mix={[
							text("sm"),
							fg("neutral.muted"),
							raw({
								margin: 0,
								padding: "0.75rem 1rem",
								border: "1px dashed var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-lg)",
							}),
						]}
					>
						{empty}
					</p>
				) : (
					children
				)}
			</section>
		);
	};
}

/** Who a pull request waits on, or what its reviewers said, as one short line. */
function reviewLine(pull: PullView): string {
	let copy = COPY.dashboard.reviews;
	let names = (state: PullView["reviewers"][number]["state"]) =>
		pull.reviewers
			.filter((reviewer) => reviewer.state === state)
			.map((reviewer) => reviewer.handle);
	let changes = names("changes");
	if (changes.length > 0) return copy.changes(joinNames(changes, COPY.commits.and));
	let approved = names("approved");
	let waiting = names("requested");
	if (waiting.length > 0) return copy.waiting(joinNames(waiting, COPY.commits.and));
	if (approved.length > 0) return copy.approved(joinNames(approved, COPY.commits.and));
	return copy.none;
}

namespace RepoCard {
	export interface Props {
		history: DeltaHistory;
		files: number;
		latest: DeltaCommit | DeltaCommitMeta | undefined;
		settings: RepoSettings;
		now: number;
	}
}

/**
 * The hosted repository as a card, marked archived or deleted when the visitor did either in
 * settings; a deleted one offers Restore in place of its link.
 */
function RepoCard(handle: Handle<RepoCard.Props>) {
	return () => {
		let { files, history, latest, now, settings } = handle.props;
		let name = `${COPY.org}/${settings.name}`;
		if (settings.deleted) {
			return (
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.5rem",
							padding: "0.875rem 1rem",
							border: "1px dashed var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-lg)",
						}),
					]}
				>
					<span mix={[raw({ display: "flex", alignItems: "center", gap: "0.5rem" })]}>
						<TrashIcon size={16} aria-hidden="true" mix={[fg("neutral.muted")]} />
						<span mix={[font("mono"), weight("semibold"), fg("neutral.muted")]}>{name}</span>
					</span>
					<span mix={[text("sm"), fg("neutral.muted")]}>{COPY.dashboard.deleted}</span>
					<form method="post" action={actionHref("delta/settings/restore")}>
						<Button type="submit" size="sm" variant="outline" color="neutral">
							{COPY.dashboard.restore}
						</Button>
					</form>
				</div>
			);
		}
		return (
			<a
				href={repoHref()}
				data-rmx-prefetch="intent"
				mix={[
					raw({
						display: "grid",
						gap: "0.375rem",
						padding: "0.875rem 1rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						background: "var(--ui-bg)",
						textDecoration: "none",
						color: "inherit",
						"&:hover": { borderColor: "var(--ui-brand-border)" },
					}),
				]}
			>
				<span
					mix={[
						raw({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }),
						weight("semibold"),
						fg("brand"),
					]}
				>
					<BookOpenIcon size={16} aria-hidden="true" />
					<span mix={[font("mono")]}>{name}</span>
					{settings.archived ? (
						<span
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.25rem",
									paddingInline: "0.375rem",
									borderRadius: "999px",
									border: "1px solid var(--ui-warning-border, var(--ui-neutral-border))",
								}),
								text("xs"),
								weight("medium"),
								fg("warning"),
							]}
						>
							<ArchiveIcon size={12} aria-hidden="true" />
							{COPY.dashboard.archived}
						</span>
					) : null}
				</span>
				<span mix={[text("sm"), fg("neutral.muted")]}>{settings.description}</span>
				<span
					mix={[
						raw({ display: "flex", flexWrap: "wrap", gap: "0.25rem 1rem" }),
						text("xs"),
						fg("neutral.muted"),
						tabularNums(),
					]}
				>
					<span>{COPY.dashboard.files(files)}</span>
					<span>{COPY.latest.commits(history.commits.length, history.capped)}</span>
					{latest === undefined ? null : (
						<span>
							{COPY.dashboard.updated} <RelativeTime date={latest.date} now={now} locale="en" />
						</span>
					)}
				</span>
			</a>
		);
	};
}

namespace DashboardScreen {
	export interface Props {
		history: DeltaHistory;
		files: number;
		latest: DeltaCommit | DeltaCommitMeta | undefined;
		/** The signed-in person's open pull requests. */
		pulls: readonly PullView[];
		/** Open pull requests waiting on the signed-in person's review. */
		reviews: readonly PullView[];
		/** Open issues assigned to the signed-in person. */
		issues: readonly IssueView[];
		/** Runs that failed, newest first. */
		failures: readonly Run[];
		settings: RepoSettings;
		now: number;
	}
}

/**
 * Renders the dashboard: what needs you (your pull requests and the reviews they wait on,
 * review requests, your issues, failed runs) beside the repository and its newest commits.
 * On a phone the questions come first.
 */
export function DashboardScreen(handle: Handle<DashboardScreen.Props>) {
	return () => {
		let { failures, files, history, issues, latest, now, pulls, reviews, settings } = handle.props;
		let copy = COPY.dashboard;
		let waiting = pulls.length + reviews.length + issues.length + failures.length;
		return (
			<>
				<PageHeader
					title={copy.title}
					description={
						waiting === 0
							? copy.nothing
							: copy.summary(pulls.length + reviews.length, issues.length, failures.length)
					}
				/>
				<HeadingScope level={2}>
					<div mix={[raw({ containerName: "delta-dashboard", containerType: "inline-size" })]}>
						<div
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "minmax(0, 1fr)",
									gap: "1.75rem",
									alignItems: "start",
									"@container delta-dashboard (min-width: 56rem)": {
										gridTemplateColumns: "minmax(0, 1fr) 20rem",
										gap: "2rem",
									},
								}),
							]}
						>
							<div mix={[raw({ display: "grid", gap: "1.5rem", minInlineSize: 0 })]}>
								<Section
									id="delta-dash-pulls"
									title={copy.yourPulls}
									count={pulls.length}
									all={{ href: pullsHref("is:open author:@me"), label: copy.allPulls }}
									empty={copy.noPulls}
								>
									<Rows label={copy.yourPulls}>
										{pulls.map((pull) => (
											<Row
												icon={
													<RecordIcon
														state={pull.draft ? "draft" : "pr-open"}
														label={pull.draft ? copy.draft : copy.openPull}
													/>
												}
												href={pullHref(pull.number)}
												title={pull.title}
												meta={
													<>
														<span mix={[font("mono")]}>{`#${pull.number}`}</span>
														{` · ${reviewLine(pull)}`}
													</>
												}
												end={
													<CheckRunIcon
														state={checksState(pull.checks)}
														label={copy.checks[checksState(pull.checks)]}
													/>
												}
											/>
										))}
									</Rows>
								</Section>
								<Section
									id="delta-dash-reviews"
									title={copy.reviewRequests}
									count={reviews.length}
									all={{ href: pullsHref("is:open review-requested:@me"), label: copy.allPulls }}
									empty={copy.noReviews}
								>
									<Rows label={copy.reviewRequests}>
										{reviews.map((pull) => (
											<Row
												icon={<RecordIcon state="pr-open" label={copy.openPull} />}
												href={pullHref(pull.number)}
												title={pull.title}
												meta={
													<>
														<span mix={[font("mono")]}>{`#${pull.number}`}</span>
														{` · ${copy.by(pull.author)}`}
													</>
												}
											/>
										))}
									</Rows>
								</Section>
								<Section
									id="delta-dash-issues"
									title={copy.assigned}
									count={issues.length}
									all={{ href: issuesHref("is:open assignee:@me"), label: copy.allIssues }}
									empty={copy.noIssues}
								>
									<Rows label={copy.assigned}>
										{issues.map((issue) => (
											<Row
												icon={<RecordIcon state="open" label={copy.openIssue} />}
												href={issueHref(issue.number)}
												title={issue.title}
												meta={
													<>
														<span mix={[font("mono")]}>{`#${issue.number}`}</span>
														{" · "}
														{copy.updated}{" "}
														<RelativeTime date={issue.updatedAt} now={now} locale="en" />
													</>
												}
											/>
										))}
									</Rows>
								</Section>
								<Section
									id="delta-dash-runs"
									title={copy.failures}
									count={failures.length}
									all={{ href: actionsHref("status=failure"), label: copy.allRuns }}
									empty={copy.noFailures}
								>
									<Rows label={copy.failures}>
										{failures.map((run) => (
											<Row
												icon={<StateIcon state={run.status} />}
												href={runHref(run.id)}
												title={run.title}
												meta={
													<>
														<span mix={[weight("medium"), fg("neutral.emphasis")]}>
															{`${run.workflow.name} #${run.id}`}
														</span>
														{` · ${run.branch} · ${formatDuration(run.seconds)} · `}
														<RelativeTime
															date={new Date(run.startedAt).toISOString()}
															now={now}
															locale="en"
														/>
													</>
												}
											/>
										))}
									</Rows>
								</Section>
							</div>
							<div mix={[raw({ display: "grid", gap: "1.5rem", minInlineSize: 0 })]}>
								<section
									aria-labelledby="delta-repos"
									mix={[raw({ display: "grid", gap: "0.5rem" })]}
								>
									<div
										mix={[
											raw({
												display: "flex",
												alignItems: "baseline",
												justifyContent: "space-between",
												gap: "1rem",
											}),
										]}
									>
										<h2 id="delta-repos" mix={[text("sm"), weight("semibold"), raw({ margin: 0 })]}>
											{copy.repositories}
										</h2>
										<a
											href={href(COPY.org)}
											data-rmx-prefetch="intent"
											mix={[text("xs"), fg("brand"), raw({ textDecoration: "none" })]}
										>
											{copy.allRepos}
										</a>
									</div>
									<RepoCard
										history={history}
										files={files}
										latest={latest}
										settings={settings}
										now={now}
									/>
								</section>
								{history.commits.length === 0 ? null : (
									<section
										aria-labelledby="delta-recent"
										mix={[raw({ display: "grid", gap: "0.5rem" })]}
									>
										<div
											mix={[
												raw({
													display: "flex",
													alignItems: "baseline",
													justifyContent: "space-between",
													gap: "1rem",
												}),
											]}
										>
											<h2
												id="delta-recent"
												mix={[text("sm"), weight("semibold"), raw({ margin: 0 })]}
											>
												{copy.recent}
											</h2>
											<a
												href={commitsHref()}
												data-rmx-prefetch="intent"
												mix={[text("xs"), fg("brand"), raw({ textDecoration: "none" })]}
											>
												{copy.all}
											</a>
										</div>
										<CommitList label={copy.recent}>
											{history.commits.slice(0, RECENT).map((commit) => (
												<CommitRow commit={commit} now={now} scope="recent" />
											))}
										</CommitList>
									</section>
								)}
							</div>
						</div>
					</div>
				</HeadingScope>
			</>
		);
	};
}

/** Renders the app's own 404 inside the shell, so the sidebar still leads somewhere. */
export function NotFoundScreen() {
	return () => (
		<>
			<PageHeader title={COPY.notFound.title} />
			<HeadingScope level={2}>
				<Empty icon={<CompassIcon />}>
					<Empty.Description>{COPY.notFound.hint}</Empty.Description>
					<Empty.Action>
						<LinkButton href={repoHref()} color="brand">
							{COPY.notFound.action}
						</LinkButton>
					</Empty.Action>
				</Empty>
			</HeadingScope>
		</>
	);
}
