/**
 * One file of the repository, as code or as blame: the branch picker and Go to file over a
 * `CodeView` of the file at the deployed commit, with line links a server paints from `?L=`,
 * `y` to pin the address to that commit, and blame hunks from `git blame`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { GitBranchIcon, GitCommitHorizontalIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, text, truncate, weight } from "@sdxc/u/typography";
import { HeadingScope, Keyboard, LinkButton, RelativeTime } from "@sdxc/ui";
import { CodeView, codeStats, parseLineRange } from "@sdxc/ui/app/code-view";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterMenu } from "@sdxc/ui/app/filter-menu";

import type {
	DeltaBlameRange,
	DeltaCommit,
	DeltaCommitMeta,
	DeltaFile,
} from "~/app/services/delta/source";

import { DELTA_BRANCH } from "~/config/delta";

import {
	commitHref,
	fileHref,
	findHref,
	folderHref,
	formatBytes,
	parentOf,
	shortSha,
} from "../data";
import { InitialsTile } from "../glyphs";
import { CODE_LABELS, COPY, REF_LABELS } from "../labels";
import { RepoHeader } from "../shell";

namespace RefPicker {
	export interface Props {
		/** The ref the address names: the branch, or the pinned commit's sha. */
		current: string;
		/** Where the branch's item leads: this same screen on the branch. */
		branchHref: string;
	}
}

/**
 * Renders the branch picker: a filterable menu of the repository's refs, each a link to this
 * screen at that ref, `main` badged as the default and checked when it is the one shown.
 */
export function RefPicker(handle: Handle<RefPicker.Props>) {
	return () => {
		let { branchHref, current } = handle.props;
		let onBranch = current === DELTA_BRANCH;
		return (
			<FilterMenu
				id="delta-ref-picker"
				mode="navigate"
				trigger={
					<>
						<GitBranchIcon size={14} aria-hidden="true" />
						<span mix={[font("mono")]}>{onBranch ? DELTA_BRANCH : shortSha(current)}</span>
					</>
				}
				groups={[
					{
						label: COPY.refs.branches,
						items: [
							{
								value: DELTA_BRANCH,
								label: DELTA_BRANCH,
								href: branchHref,
								badge: COPY.refs.default,
								selected: onBranch,
							},
						],
					},
				]}
				labels={REF_LABELS}
			/>
		);
	};
}

namespace FileCommit {
	export interface Props {
		commit: DeltaCommit | DeltaCommitMeta | undefined;
		now: number;
	}
}

/** Renders the last commit that touched the file, over its code. */
function FileCommit(handle: Handle<FileCommit.Props>) {
	return () => {
		let { commit, now } = handle.props;
		if (commit === undefined) return null;
		return (
			<div
				data-slot="delta-file-commit"
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						minInlineSize: 0,
						paddingBlock: "0.5rem",
						paddingInline: "0.875rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						background: "var(--ui-neutral-bg-tint)",
					}),
					text("sm"),
				]}
			>
				<InitialsTile name={commit.author} size={20} />
				<span mix={[weight("semibold"), raw({ flexShrink: 0 })]}>{commit.author}</span>
				<a
					href={commitHref(commit.sha)}
					data-rmx-prefetch="intent"
					mix={[
						truncate(),
						fg("neutral.muted"),
						raw({ flex: "1 1 auto", minInlineSize: 0, textDecoration: "none" }),
					]}
				>
					{commit.subject}
				</a>
				<span
					mix={[
						raw({ display: "inline-flex", gap: "0.5rem", flexShrink: 0 }),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					<span mix={[font("mono")]}>{shortSha(commit.sha)}</span>
					<RelativeTime date={commit.date} now={now} locale="en" />
				</span>
			</div>
		);
	};
}

namespace ViewLink {
	export interface Props {
		path: string;
		gitRef: string;
		/** The view this link opens. */
		view: "blob" | "blame";
		/** The view shown, which the link marks current and leaves without a key. */
		current: "blob" | "blame";
	}
}

/**
 * Renders one side of the Code | Blame switch as a link to the same file in that view, so
 * each view is an address; the other side carries its key, `c` or `b`.
 */
function ViewLink(handle: Handle<ViewLink.Props>) {
	return () => {
		let { current, gitRef, path, view } = handle.props;
		let shown = view === current;
		let key =
			view === "blame"
				? { keys: "b", label: COPY.keys.blame }
				: { keys: "c", label: COPY.keys.code };
		return (
			<LinkButton
				href={fileHref(path, { ref: gitRef, view })}
				size="sm"
				variant={shown ? "solid" : "ghost"}
				color={shown ? "brand" : "neutral"}
				aria-current={shown ? "page" : undefined}
				data-shortcut={shown ? undefined : key.keys}
				data-shortcut-label={shown ? undefined : key.label}
				data-shortcut-group={shown ? undefined : CODE_LABELS.group}
			>
				{view === "blame" ? COPY.file.blame : COPY.file.code}
			</LinkButton>
		);
	};
}

namespace BlobScreen {
	export interface Props {
		file: DeltaFile;
		view: "blob" | "blame";
		/** The ref the address names. */
		gitRef: string;
		/** The commit the build pinned, which every permalink names. */
		head: string;
		/** The address's own query, for the cited lines. */
		url: URL;
		/** The file's runs, tokenized once per isolate. */
		tokens: ReadonlyArray<{ type: string; value: string }>;
		blame: readonly DeltaBlameRange[];
		commits: Map<string, DeltaCommit | DeltaCommitMeta>;
		lastCommit: DeltaCommit | DeltaCommitMeta | undefined;
		/** The commits on the branch, which the Commits tab counts. */
		commitCount: number;
		now: number;
	}
}

/**
 * Renders a file: the header with its folders as the trail (a "Files" link on a phone), the
 * branch picker and Go to file, its last commit, then the code or its blame. The screen
 * carries the file's path, which the tree beside `main` follows.
 */
export function BlobScreen(handle: Handle<BlobScreen.Props>) {
	return () => {
		let { blame, commitCount, commits, file, gitRef, head, lastCommit, now, tokens, url, view } =
			handle.props;
		let segments = file.path.split("/");
		let stats = codeStats(file.text);
		let selected = parseLineRange(url.searchParams.get("L"));
		let hunks =
			view === "blame"
				? blame.flatMap((range) => {
						let commit = commits.get(range.sha);
						if (commit === undefined) return [];
						return [
							{
								start: range.start,
								end: range.end,
								commit: {
									sha: commit.sha,
									subject: commit.subject,
									author: commit.author,
									date: commit.date,
									href: commitHref(commit.sha),
								},
							},
						];
					})
				: undefined;
		return (
			<div data-delta-path={file.path} data-delta-view={view}>
				<RepoHeader
					title={<span mix={[font("mono")]}>{segments.at(-1)}</span>}
					trail={segments.map((segment, index) => ({
						label: segment,
						href:
							index === segments.length - 1
								? undefined
								: folderHref(segments.slice(0, index + 1).join("/")),
					}))}
					parent={{ href: folderHref(parentOf(file.path)), label: COPY.files.back }}
					tab="code"
					commits={commitCount}
				/>
				<div
					mix={[
						raw({ display: "grid", gap: "0.75rem", paddingBlockStart: "1rem", minInlineSize: 0 }),
					]}
				>
					<div
						mix={[raw({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" })]}
					>
						<RefPicker current={gitRef} branchHref={fileHref(file.path, { view })} />
						<LinkButton
							href={findHref()}
							size="sm"
							variant="outline"
							color="neutral"
							data-rmx-prefetch="intent"
							mix={[raw({ marginInlineStart: "auto" })]}
						>
							{COPY.files.filter}
							<Keyboard>t</Keyboard>
						</LinkButton>
					</div>
					<FileCommit commit={lastCommit} now={now} />
					<CodeView
						path={file.path}
						code={file.text}
						tokens={tokens}
						selected={selected}
						blame={hunks}
						permalink={fileHref(file.path, { ref: head, view })}
						labels={CODE_LABELS}
						now={now}
						locale="en"
					>
						<CodeView.Header
							meta={COPY.file.meta(stats.lines, stats.loc, formatBytes(stats.bytes))}
						>
							<span
								role="group"
								aria-label={COPY.file.view}
								mix={[raw({ display: "inline-flex", gap: "0.125rem" })]}
							>
								<ViewLink path={file.path} gitRef={gitRef} view="blob" current={view} />
								<ViewLink path={file.path} gitRef={gitRef} view="blame" current={view} />
							</span>
							{view === "blame" ? (
								<CodeView.AgeLegend labels={{ older: COPY.file.older, newer: COPY.file.newer }} />
							) : null}
						</CodeView.Header>
					</CodeView>
				</div>
			</div>
		);
	};
}

namespace NotInBuild {
	export interface Props {
		path: string;
		gitRef: string;
		commitCount: number;
	}
}

/**
 * Renders a file address naming a commit the build does not carry files for, with the same
 * path on the branch one click away.
 */
export function NotInBuild(handle: Handle<NotInBuild.Props>) {
	return () => {
		let { commitCount, gitRef, path } = handle.props;
		return (
			<>
				<RepoHeader
					title={<span mix={[font("mono")]}>{path.split("/").at(-1) || COPY.repo}</span>}
					trail={[{ label: `${path} @ ${shortSha(gitRef)}` }]}
					tab="code"
					commits={commitCount}
				/>
				<HeadingScope level={2}>
					<Empty kind="no-results" icon={<GitCommitHorizontalIcon />}>
						<Empty.Title>{COPY.notInBuild.title}</Empty.Title>
						<Empty.Description>{COPY.notInBuild.hint}</Empty.Description>
						<Empty.Action>
							<LinkButton href={path === "" ? folderHref("") : fileHref(path)} size="sm">
								{COPY.notInBuild.action}
							</LinkButton>
						</Empty.Action>
					</Empty>
				</HeadingScope>
			</>
		);
	};
}
