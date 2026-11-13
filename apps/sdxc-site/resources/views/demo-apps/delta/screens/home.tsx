/**
 * The repository's home and every folder's listing: the latest commit over the files, each
 * entry with the last commit that touched it and its age, the folder's README rendered from
 * Markdown, and on the home the About column. Every commit and age comes from git.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { BookOpenIcon, FileIcon, FolderIcon, ClockArrowUpIcon } from "@sdxc/icons";
import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { Badge, Keyboard, LinkButton, RelativeTime, Typeset } from "@sdxc/ui";

import type {
	DeltaCommit,
	DeltaCommitMeta,
	DeltaFile,
	DeltaHistory,
} from "~/app/services/delta/source";

import { DELTA_BRANCH } from "~/config/delta";

import type { FolderEntry } from "../data";

import { commitHref, commitsHref, fileHref, findHref, folderHref, parentOf } from "../data";
import { InitialsTile } from "../glyphs";
import { COPY } from "../labels";
import { RepoHeader } from "../shell";

import { RefPicker } from "./blob";

/** The card width below which the file card drops its secondary text: dates, subjects. */
const NARROW = "@container (max-width: 36rem)";

/** Commits by sha, for a row to name the last commit touching its entry. */
type CommitIndex = Map<string, DeltaCommit | DeltaCommitMeta>;

namespace LatestCommit {
	export interface Props {
		commit: DeltaCommit | DeltaCommitMeta | undefined;
		/** The commits on the branch, which the History link counts. */
		count: number;
		capped: boolean;
		now: number;
	}
}

/** Renders the bar over a file list: who made the latest commit, what it says, and when. */
export function LatestCommit(handle: Handle<LatestCommit.Props>) {
	return () => {
		let { capped, commit, count, now } = handle.props;
		return (
			<div
				data-slot="delta-latest-commit"
				aria-label={COPY.latest.label}
				role="group"
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.625rem",
						minInlineSize: 0,
						paddingBlock: "0.5rem",
						paddingInline: "0.875rem",
						background: "var(--ui-neutral-bg-tint)",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
					text("sm"),
				]}
			>
				{commit === undefined ? null : (
					<>
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
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
									flexShrink: 0,
									[NARROW]: { display: "none" },
								}),
								text("xs"),
								fg("neutral.muted"),
							]}
						>
							<span mix={[font("mono")]}>{commit.sha.slice(0, 7)}</span>
							<span aria-hidden="true">·</span>
							<RelativeTime date={commit.date} now={now} locale="en" />
						</span>
					</>
				)}
				<a
					href={commitsHref()}
					data-rmx-prefetch="intent"
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.375rem",
							flexShrink: 0,
							marginInlineStart: commit === undefined ? "auto" : undefined,
							textDecoration: "none",
						}),
						weight("medium"),
						fg("neutral.emphasis"),
					]}
				>
					<ClockArrowUpIcon size={16} aria-hidden="true" />
					<span mix={[tabularNums()]}>{COPY.latest.commits(count, capped)}</span>
				</a>
			</div>
		);
	};
}

namespace FileList {
	export interface Props {
		entries: readonly FolderEntry[];
		/** The folder listed, `""` for the root, whose parent row leads up. */
		folder: string;
		lastCommits: Record<string, string>;
		commits: CommitIndex;
		now: number;
	}
}

/**
 * Renders a folder's entries as a table: the name, the subject of the last commit touching
 * it and that commit's age, folders first. A folder below the root opens with a row up. The
 * hidden header row sets the fixed layout's columns, so on a phone the name takes the subject's room.
 */
function FileList(handle: Handle<FileList.Props>) {
	return () => {
		let { commits, entries, folder, lastCommits, now } = handle.props;
		let cell = raw({
			paddingBlock: "0.5rem",
			paddingInline: "0.875rem",
			borderBlockStart: "1px solid var(--ui-neutral-border)",
			verticalAlign: "middle",
		});
		return (
			<table
				aria-label={COPY.files.list}
				mix={[
					raw({
						inlineSize: "100%",
						borderCollapse: "collapse",
						tableLayout: "fixed",
						"& tr:first-child > *": { borderBlockStart: "0" },
						"& tbody tr:hover": { background: "var(--ui-neutral-bg-tint)" },
					}),
					text("sm"),
				]}
			>
				<thead
					mix={[
						raw({
							"& th": {
								padding: 0,
								border: 0,
								blockSize: 0,
								lineHeight: 0,
								overflow: "hidden",
								whiteSpace: "nowrap",
								clipPath: "inset(50%)",
							},
						}),
					]}
				>
					<tr>
						<th scope="col" mix={raw({ inlineSize: "38%", [NARROW]: { inlineSize: "auto" } })}>
							{COPY.files.name}
						</th>
						<th scope="col" mix={raw({ [NARROW]: { inlineSize: 0 } })}>
							{COPY.files.lastCommit}
						</th>
						<th scope="col" mix={raw({ inlineSize: "8.5rem", [NARROW]: { inlineSize: "5.5rem" } })}>
							{COPY.files.updated}
						</th>
					</tr>
				</thead>
				<tbody>
					{folder === "" ? null : (
						<tr>
							<td colSpan={3} mix={[cell]}>
								<a
									href={folderHref(parentOf(folder))}
									aria-label={COPY.files.parent}
									mix={[
										font("mono"),
										fg("neutral.emphasis"),
										raw({ textDecoration: "none", display: "block" }),
									]}
								>
									..
								</a>
							</td>
						</tr>
					)}
					{entries.map((entry) => {
						let sha = lastCommits[entry.path];
						let commit = sha === undefined ? undefined : commits.get(sha);
						let Icon = entry.kind === "folder" ? FolderIcon : FileIcon;
						return (
							<tr data-entry={entry.path}>
								<td mix={[cell]}>
									<a
										href={entry.kind === "folder" ? folderHref(entry.path) : fileHref(entry.path)}
										data-rmx-prefetch="intent"
										mix={[
											raw({
												display: "flex",
												alignItems: "center",
												gap: "0.5rem",
												minInlineSize: 0,
												textDecoration: "none",
												"&:hover > span": { textDecoration: "underline" },
											}),
											fg("neutral.emphasis"),
										]}
									>
										<Icon
											size={16}
											aria-hidden="true"
											mix={[
												raw({ flexShrink: 0 }),
												entry.kind === "folder" ? fg("brand") : fg("neutral.muted"),
											]}
										/>
										<span mix={[truncate(), font("mono"), text("xs")]}>{entry.name}</span>
									</a>
								</td>
								<td
									mix={[
										cell,
										raw({
											[NARROW]: { paddingInline: 0, lineHeight: 0, "& > *": { display: "none" } },
										}),
									]}
								>
									{commit === undefined ? null : (
										<a
											href={commitHref(commit.sha)}
											mix={[
												truncate(),
												fg("neutral.muted"),
												raw({
													display: "block",
													textDecoration: "none",
													"&:hover": { textDecoration: "underline" },
												}),
											]}
										>
											{commit.subject}
										</a>
									)}
								</td>
								<td mix={[cell, raw({ textAlign: "end" }), fg("neutral.muted"), text("xs")]}>
									{commit === undefined ? (
										"—"
									) : (
										<RelativeTime date={commit.date} now={now} locale="en" />
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		);
	};
}

namespace ReadmeHeading {
	export interface Props {
		/** The heading's level as the README writes it, from 1. */
		level?: number;
		id?: string;
		children?: RemixNode;
	}
}

/**
 * Draws a README heading one level down, so the README's own title sits under the page's
 * `h1` and the card's "README" heading instead of competing with them.
 */
function ReadmeHeading(handle: Handle<ReadmeHeading.Props>) {
	return () => {
		let { children, id, level = 1 } = handle.props;
		let Tag = `h${Math.min(6, level + 1)}` as "h2";
		return <Tag id={id}>{children}</Tag>;
	};
}

namespace Readme {
	export interface Props {
		file: DeltaFile;
	}
}

/** Renders a README as Markdown in a card headed by its name; one that will not parse shows nothing. */
function Readme(handle: Handle<Readme.Props>) {
	return () => {
		let { file } = handle.props;
		let parsed = Markdown.parse(file.text);
		if (isFailure(parsed)) return null;
		return (
			<section
				aria-labelledby="delta-readme"
				mix={[
					raw({
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						background: "var(--ui-bg)",
						overflow: "hidden",
					}),
				]}
			>
				<h2
					id="delta-readme"
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							margin: 0,
							paddingBlock: "0.625rem",
							paddingInline: "0.875rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
						text("sm"),
						weight("semibold"),
					]}
				>
					<BookOpenIcon size={16} aria-hidden="true" />
					{COPY.readme}
				</h2>
				<div
					mix={[raw({ padding: "1rem 1.5rem 1.5rem", minInlineSize: 0, overflowWrap: "anywhere" })]}
				>
					<Typeset preset="docs">
						{toRemix(parsed.data.document, { components: { heading: ReadmeHeading } })}
					</Typeset>
				</div>
			</section>
		);
	};
}

namespace About {
	export interface Props {
		files: number;
		commits: number;
	}
}

/** Renders the About column: what Delta is, its topics, and how much of it there is. */
function About(handle: Handle<About.Props>) {
	return () => (
		<aside
			aria-labelledby="delta-about"
			mix={[raw({ display: "grid", gap: "0.75rem", alignContent: "start" })]}
		>
			<h2 id="delta-about" mix={[text("sm"), weight("semibold"), raw({ margin: 0 })]}>
				{COPY.aboutTitle}
			</h2>
			<p mix={[text("sm"), raw({ margin: 0, lineHeight: 1.55 })]}>{COPY.about}</p>
			<ul
				mix={[
					raw({
						display: "flex",
						flexWrap: "wrap",
						gap: "0.375rem",
						listStyle: "none",
						margin: 0,
						padding: 0,
					}),
				]}
			>
				{COPY.topics.map((topic) => (
					<li>
						<Badge color="brand" variant="secondary">
							{topic}
						</Badge>
					</li>
				))}
			</ul>
			<dl
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "auto 1fr",
						columnGap: "0.75rem",
						rowGap: "0.25rem",
						margin: 0,
					}),
					text("sm"),
					fg("neutral.muted"),
				]}
			>
				<dt>Files</dt>
				<dd mix={[raw({ margin: 0 }), font("mono"), tabularNums(), fg("neutral.emphasis")]}>
					{handle.props.files}
				</dd>
				<dt>Commits</dt>
				<dd mix={[raw({ margin: 0 }), font("mono"), tabularNums(), fg("neutral.emphasis")]}>
					{handle.props.commits}
				</dd>
				<dt>Branch</dt>
				<dd mix={[raw({ margin: 0 }), font("mono"), fg("neutral.emphasis")]}>main</dd>
			</dl>
		</aside>
	);
}

namespace HomeScreen {
	export interface Props {
		/** The folder listed, `""` for the repository's home. */
		folder: string;
		entries: readonly FolderEntry[];
		files: readonly DeltaFile[];
		lastCommits: Record<string, string>;
		history: DeltaHistory;
		commits: CommitIndex;
		now: number;
	}
}

/**
 * Renders the repository's home or one folder: the toolbar (branch, Go to file), the latest
 * commit over the listing, then the folder's README; the home adds the About column beside it.
 */
export function HomeScreen(handle: Handle<HomeScreen.Props>) {
	return () => {
		let { commits, entries, files, folder, history, lastCommits, now } = handle.props;
		let latestSha = lastCommits[folder];
		let latest = latestSha === undefined ? undefined : commits.get(latestSha);
		let readme = files.find(
			(file) => file.path === (folder === "" ? "README.md" : `${folder}/README.md`),
		);
		let segments = folder === "" ? [] : folder.split("/");
		let isHome = folder === "";
		return (
			<div data-delta-folder={folder} data-delta-path={isHome ? undefined : folder}>
				<RepoHeader
					title={
						<span mix={[font("mono")]}>{isHome ? COPY.repo : (segments.at(-1) ?? folder)}</span>
					}
					trail={segments.map((segment, index) => ({
						label: segment,
						href:
							index === segments.length - 1
								? undefined
								: folderHref(segments.slice(0, index + 1).join("/")),
					}))}
					parent={
						isHome ? undefined : { href: folderHref(parentOf(folder)), label: COPY.files.back }
					}
					tab="code"
					commits={history.commits.length}
				/>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "1.5rem",
							paddingBlockStart: "1rem",
							containerType: "inline-size",
							"@container ui-app-content (min-width: 64rem)": isHome
								? { gridTemplateColumns: "minmax(0, 1fr) 16rem" }
								: {},
						}),
					]}
				>
					<div
						mix={[raw({ display: "grid", gap: "1rem", minInlineSize: 0, alignContent: "start" })]}
					>
						<div
							mix={[
								raw({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }),
							]}
						>
							<RefPicker current={DELTA_BRANCH} branchHref={folderHref(folder)} />
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
						<div
							mix={[
								raw({
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-lg)",
									overflow: "hidden",
									background: "var(--ui-bg)",
									containerType: "inline-size",
								}),
							]}
						>
							<LatestCommit
								commit={latest}
								count={history.commits.length}
								capped={history.capped}
								now={now}
							/>
							<FileList
								entries={entries}
								folder={folder}
								lastCommits={lastCommits}
								commits={commits}
								now={now}
							/>
						</div>
						{readme === undefined ? null : <Readme file={readme} />}
					</div>
					{isHome ? <About files={files.length} commits={history.commits.length} /> : null}
				</div>
			</div>
		);
	};
}
