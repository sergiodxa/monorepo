/**
 * Delta's commits, read from git at build time: the list on `main` grouped by the day each
 * commit was authored, every row a subject, its co-authors, its author and age and a short
 * sha that copies the full one; and one commit's page, its message and the files it changed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { GitCommitHorizontalIcon, GitBranchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { HeadingScope, LinkButton, RelativeTime } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { CopyButton } from "@sdxc/ui/docs/copy-button";

import type { DeltaCommit, DeltaCommitMeta, DeltaHistory } from "~/app/services/delta/source";

import { DELTA_HISTORY_LIMIT } from "~/config/delta";

import { commitHref, commitsHref, fileHref, groupByDay, joinNames, shortSha } from "../data";
import { InitialsTile } from "../glyphs";
import { COPY } from "../labels";
import { RepoHeader } from "../shell";

namespace ShaButton {
	export interface Props {
		sha: string;
		/** Prefix for the hidden element the copy reads, unique per list on the page. */
		scope: string;
	}
}

/**
 * Renders a commit's short sha as a link to the commit and a button copying the full sha,
 * which a hidden element beside it holds, so the label stays short and the copy is whole.
 */
export function ShaButton(handle: Handle<ShaButton.Props>) {
	return () => {
		let { scope, sha } = handle.props;
		let id = `${scope}-sha-${sha}`;
		return (
			<span
				data-slot="delta-sha"
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-md)",
						flexShrink: 0,
					}),
				]}
			>
				<a
					href={commitHref(sha)}
					data-rmx-prefetch="intent"
					mix={[
						font("mono"),
						text("xs"),
						fg("neutral.emphasis"),
						raw({ paddingInline: "0.4rem", textDecoration: "none", lineHeight: "1.5rem" }),
					]}
				>
					{shortSha(sha)}
				</a>
				<span id={id} hidden>
					{sha}
				</span>
				<span mix={[raw({ borderInlineStart: "1px solid var(--ui-neutral-border)" })]}>
					<CopyButton target={id} label={COPY.commits.copy} copiedLabel={COPY.commits.copied} />
				</span>
			</span>
		);
	};
}

namespace CommitRow {
	export interface Props {
		commit: DeltaCommit | DeltaCommitMeta;
		now: number;
		/** Prefix for the row's copy target, unique per list on the page. */
		scope: string;
	}
}

/**
 * Renders one commit as a list row: the subject linking to the commit, the author with any
 * co-authors as one sentence and the commit's age, then its short sha.
 */
export function CommitRow(handle: Handle<CommitRow.Props>) {
	return () => {
		let { commit, now, scope } = handle.props;
		let coAuthors = "coAuthors" in commit ? commit.coAuthors : [];
		let people = joinNames([commit.author, ...coAuthors], COPY.commits.and);
		return (
			<li
				data-commit={commit.sha}
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.75rem",
						paddingBlock: "0.625rem",
						paddingInline: "0.875rem",
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&:first-child": { borderBlockStart: "0" },
					}),
				]}
			>
				<div mix={[raw({ display: "grid", gap: "0.25rem", minInlineSize: 0, flex: "1 1 auto" })]}>
					<a
						href={commitHref(commit.sha)}
						data-rmx-prefetch="intent"
						mix={[
							text("sm"),
							weight("semibold"),
							fg("neutral.emphasis"),
							raw({
								textDecoration: "none",
								overflowWrap: "anywhere",
								"&:hover": { textDecoration: "underline" },
							}),
						]}
					>
						{commit.subject}
					</a>
					<span
						mix={[
							raw({ display: "flex", alignItems: "center", gap: "0.375rem", minInlineSize: 0 }),
							text("xs"),
							fg("neutral.muted"),
						]}
					>
						<span mix={[raw({ display: "inline-flex" })]}>
							{[commit.author, ...coAuthors].map((name, index) => (
								<span mix={[raw({ marginInlineStart: index === 0 ? "0" : "-0.3rem" })]}>
									<InitialsTile name={name} size={18} />
								</span>
							))}
						</span>
						<span mix={[truncate()]}>
							<span mix={[weight("medium"), fg("neutral.emphasis")]}>{people}</span>{" "}
							{COPY.commits.authored} <RelativeTime date={commit.date} now={now} locale="en" />
						</span>
					</span>
				</div>
				<ShaButton sha={commit.sha} scope={scope} />
			</li>
		);
	};
}

/** The box a run of commit rows sits in. */
export function CommitList(handle: Handle<{ label: string; children: RemixNode }>) {
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
				}),
			]}
		>
			{handle.props.children}
		</ul>
	);
}

namespace CommitsScreen {
	export interface Props {
		history: DeltaHistory;
		now: number;
	}
}

/**
 * Renders the commits on `main`, newest day first; a shallow build and an empty history each
 * say why the list is empty, and a capped list says where it stops.
 */
export function CommitsScreen(handle: Handle<CommitsScreen.Props>) {
	return () => {
		let { history, now } = handle.props;
		let days = groupByDay(history.commits);
		return (
			<>
				<RepoHeader
					title={COPY.commits.title}
					trail={[{ label: COPY.commits.title }]}
					tab="commits"
					commits={history.commits.length}
					description={
						<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
							<GitBranchIcon size={14} aria-hidden="true" />
							<span mix={[font("mono")]}>main</span>
						</span>
					}
				/>
				<HeadingScope level={2}>
					{history.commits.length === 0 ? (
						<Empty kind="first-run" icon={<GitCommitHorizontalIcon />}>
							<Empty.Title>
								{history.shallow ? COPY.commits.shallowTitle : COPY.commits.emptyTitle}
							</Empty.Title>
							<Empty.Description>
								{history.shallow ? COPY.commits.shallowHint : COPY.commits.emptyHint}
							</Empty.Description>
						</Empty>
					) : (
						<div mix={[raw({ display: "grid", gap: "1.5rem", paddingBlockStart: "1rem" })]}>
							{days.map((day) => (
								<section aria-labelledby={`day-${day.day}`} data-day={day.day}>
									<h2
										id={`day-${day.day}`}
										mix={[
											raw({
												display: "flex",
												alignItems: "center",
												gap: "0.5rem",
												margin: "0 0 0.5rem",
											}),
											text("sm"),
											weight("medium"),
											fg("neutral.muted"),
										]}
									>
										<GitCommitHorizontalIcon size={16} aria-hidden="true" />
										{COPY.commits.on(day.label)}
									</h2>
									<CommitList label={COPY.commits.on(day.label)}>
										{day.commits.map((commit) => (
											<CommitRow commit={commit} now={now} scope="list" />
										))}
									</CommitList>
								</section>
							))}
							{history.capped ? (
								<p mix={[text("sm"), fg("neutral.muted"), raw({ margin: 0, textAlign: "center" })]}>
									{COPY.commits.capped(DELTA_HISTORY_LIMIT)}
								</p>
							) : null}
						</div>
					)}
				</HeadingScope>
			</>
		);
	};
}

namespace CommitScreen {
	export interface Props {
		commit: DeltaCommit | DeltaCommitMeta;
		commits: number;
		now: number;
	}
}

/**
 * Renders one commit: its subject, author and age, its full message, and the files it
 * changed with their counts. A commit outside the build's history shows its name and why
 * the rest is missing.
 */
export function CommitScreen(handle: Handle<CommitScreen.Props>) {
	return () => {
		let { commit, commits, now } = handle.props;
		let full = "files" in commit ? commit : undefined;
		let people = joinNames([commit.author, ...(full?.coAuthors ?? [])], COPY.commits.and);
		return (
			<>
				<RepoHeader
					title={commit.subject}
					trail={[
						{ label: COPY.commits.title, href: commitsHref() },
						{ label: shortSha(commit.sha) },
					]}
					parent={{ href: commitsHref(), label: COPY.commits.title }}
					tab="commits"
					commits={commits}
					description={
						<span
							mix={[
								raw({
									display: "inline-flex",
									flexWrap: "wrap",
									alignItems: "center",
									gap: "0.375rem",
								}),
								text("sm"),
								fg("neutral.muted"),
							]}
						>
							<InitialsTile name={commit.author} size={18} />
							<span mix={[weight("medium"), fg("neutral.emphasis")]}>{people}</span>
							{COPY.commits.authored} <RelativeTime date={commit.date} now={now} locale="en" />
							<ShaButton sha={commit.sha} scope="commit" />
						</span>
					}
				/>
				<HeadingScope level={2}>
					<div mix={[raw({ display: "grid", gap: "1.25rem", paddingBlockStart: "1rem" })]}>
						{full !== undefined && full.body !== "" ? (
							<pre
								mix={[
									raw({
										margin: 0,
										whiteSpace: "pre-wrap",
										overflowWrap: "anywhere",
										fontFamily: "var(--ui-font-mono)",
										fontSize: "0.8125rem",
										lineHeight: 1.6,
										padding: "0.875rem 1rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "var(--ui-radius-lg)",
										background: "var(--ui-neutral-bg-tint)",
									}),
								]}
							>
								{full.body}
							</pre>
						) : null}
						{full === undefined ? (
							<Empty kind="no-results" icon={<GitCommitHorizontalIcon />}>
								<Empty.Title>{COPY.commit.missingTitle}</Empty.Title>
								<Empty.Description>{COPY.commit.missingHint}</Empty.Description>
								<Empty.Action>
									<LinkButton href={commitsHref()} size="sm" variant="outline" color="neutral">
										{COPY.commit.backToCommits}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<>
								<section aria-labelledby="commit-files">
									<h2
										id="commit-files"
										mix={[text("sm"), weight("semibold"), raw({ margin: "0 0 0.5rem" })]}
									>
										{COPY.commit.filesChanged(full.files.length)}
									</h2>
									<CommitList label={COPY.commit.files}>
										{full.files.map((file) => (
											<li
												mix={[
													raw({
														display: "flex",
														alignItems: "center",
														gap: "0.75rem",
														paddingBlock: "0.5rem",
														paddingInline: "0.875rem",
														borderBlockStart: "1px solid var(--ui-neutral-border)",
														"&:first-child": { borderBlockStart: "0" },
													}),
												]}
											>
												<a
													href={fileHref(file.path)}
													mix={[
														font("mono"),
														text("sm"),
														fg("neutral.emphasis"),
														raw({ flex: "1 1 auto", minInlineSize: 0, overflowWrap: "anywhere" }),
													]}
												>
													{file.oldPath === undefined
														? file.path
														: `${file.oldPath} → ${file.path}`}
												</a>
												<span
													mix={[
														font("mono"),
														text("xs"),
														tabularNums(),
														raw({ display: "inline-flex", gap: "0.5rem" }),
													]}
												>
													{file.additions === null ? (
														<span mix={[fg("neutral.muted")]}>{COPY.commit.binary}</span>
													) : (
														<>
															<span mix={[fg("success")]}>{`+${file.additions}`}</span>
															<span mix={[fg("danger")]}>{`−${file.deletions}`}</span>
														</>
													)}
												</span>
											</li>
										))}
									</CommitList>
								</section>
								<Empty size="compact" icon={<GitCommitHorizontalIcon />}>
									<Empty.Title>{COPY.commit.comingTitle}</Empty.Title>
									<Empty.Description>{COPY.commit.comingHint}</Empty.Description>
								</Empty>
							</>
						)}
					</div>
				</HeadingScope>
			</>
		);
	};
}
