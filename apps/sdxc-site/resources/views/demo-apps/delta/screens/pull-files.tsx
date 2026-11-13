/**
 * A pull request's Files changed: the changed-files tree with each file's status and counts
 * beside the real range's diffs, threads between the lines they are about, "Viewed" marks that
 * collapse a file and count the review down, inline comments and the dialog that submits them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Diff } from "@sdxc/ui/app/diff";
import type { Handle, RemixNode } from "remix/component";

import { CheckIcon, FileDiffIcon, MessageSquarePlusIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { Button, HeadingScope, TextArea } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { Tree } from "@sdxc/ui/app/tree";

import type { DiffFileView, DiffView } from "../diffs";
import type { CiteContext } from "../markup";
import type { PullView, ThreadView } from "../pull-records";

import { actionHref, pullHref } from "../data";
import { COMMENT_TEMPLATE_ID } from "../diff-island";
import { DiffPage } from "../diffs";
import { COPY, DIFF_FILE_LABELS, TREE_LABELS } from "../labels";
import { ME } from "../seed/people";

import { PullHeader, PullThread } from "./pull-parts";

/** The changed-files tree's id. */
const TREE_ID = "delta-changed-files";

/** The review dialog's id, which "Finish your review" opens. */
const REVIEW_DIALOG_ID = "delta-review-dialog";

/** One node of the changed-files tree: a folder holding nodes, or a changed file. */
interface ChangedNode {
	name: string;
	path: string;
	file?: DiffFileView;
	children?: ChangedNode[];
}

/** The changed files as nested folders, folders first and each level by name. */
function changedTree(files: readonly DiffFileView[], prefix = ""): ChangedNode[] {
	let folders = new Map<string, DiffFileView[]>();
	let leaves: ChangedNode[] = [];
	for (let file of files) {
		let rest = file.path.slice(prefix.length);
		let slash = rest.indexOf("/");
		if (slash === -1) {
			leaves.push({ name: rest, path: file.path, file });
		} else {
			let name = rest.slice(0, slash);
			folders.set(name, [...(folders.get(name) ?? []), file]);
		}
	}
	let nested = [...folders].map(([name, inside]) => ({
		name,
		path: `${prefix}${name}`,
		children: changedTree(inside, `${prefix}${name}/`),
	}));
	return [
		...nested.sort((a, b) => a.name.localeCompare(b.name)),
		...leaves.sort((a, b) => a.name.localeCompare(b.name)),
	];
}

/** The tree's nodes, every folder open, each file a link to its card. */
function ChangedNodes(handle: Handle<{ nodes: readonly ChangedNode[] }>) {
	return () => (
		<>
			{handle.props.nodes.map((node) =>
				node.file === undefined ? (
					<Tree.Item id={`delta-changed-${node.path.replace(/[^a-z0-9]+/gi, "-")}`} open>
						<Tree.ItemContent>
							<Tree.ExpandButton />
							{node.name}
						</Tree.ItemContent>
						<ChangedNodes nodes={node.children ?? []} />
					</Tree.Item>
				) : (
					<Tree.Leaf
						href={`#${node.file.id}`}
						name={node.name}
						path={node.path}
						status={node.file.status === "copied" ? "added" : node.file.status}
						statusLabel={
							COPY.review.statuses[node.file.status === "copied" ? "added" : node.file.status]
						}
						additions={node.file.additions}
						deletions={node.file.deletions}
						data-rmx-document=""
					/>
				),
			)}
		</>
	);
}

/** Where a form on the files page posts: the pull request's page, naming what it does. */
function filesAction(number: number, verb: string): string {
	return `${actionHref(`delta/pull/${number}/files`)}?do=${verb}`;
}

namespace ViewedToggle {
	export interface Props {
		pull: number;
		file: DiffFileView;
		viewed: boolean;
		url: URL;
	}
}

/**
 * A file's "Viewed" mark as a form: pressing it posts the next state and the page comes back
 * with the file collapsed (or opened again) and the progress counted, without a history entry.
 */
function ViewedToggle(handle: Handle<ViewedToggle.Props>) {
	return () => {
		let { file, pull, url, viewed } = handle.props;
		return (
			<form
				method="post"
				action={`${filesAction(pull, "viewed")}${carried(url)}`}
				mix={[raw({ display: "contents" })]}
			>
				<input type="hidden" name="path" value={file.path} />
				<input type="hidden" name="viewed" value={viewed ? "false" : "true"} />
				<button
					type="submit"
					id={`viewed-${file.id}`}
					aria-pressed={viewed ? "true" : "false"}
					aria-label={
						viewed ? COPY.review.markUnviewed(file.path) : COPY.review.markViewed(file.path)
					}
					data-delta-viewed=""
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.375rem",
							minBlockSize: "1.75rem",
							paddingInline: "0.5rem",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-md)",
							backgroundColor: "var(--ui-bg, Canvas)",
							color: "var(--ui-neutral-fg)",
							fontSize: "0.75rem",
							cursor: "pointer",
							"&[aria-pressed='true']": {
								borderColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 50%, transparent)",
								backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
							},
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "2px",
							},
						}),
					]}
				>
					<span
						aria-hidden="true"
						mix={[
							raw({
								display: "inline-grid",
								placeItems: "center",
								inlineSize: "0.875rem",
								blockSize: "0.875rem",
								borderRadius: "3px",
								border: "1px solid var(--ui-neutral-fg-muted)",
								backgroundColor: viewed ? "var(--ui-brand-bg-solid)" : "transparent",
								borderColor: viewed ? "var(--ui-brand-bg-solid)" : "var(--ui-neutral-fg-muted)",
								color: "var(--ui-brand-fg-on-solid, white)",
							}),
						]}
					>
						{viewed ? <CheckIcon size={10} stroke-width={3} /> : null}
					</span>
					{COPY.review.viewed}
				</button>
			</form>
		);
	};
}

/** The view and expansions a form carries back, so a post lands on the page as it was. */
function carried(url: URL): string {
	let params = new URLSearchParams();
	for (let name of ["diff", "expand", "load"]) {
		for (let value of url.searchParams.getAll(name)) params.append(name, value);
	}
	let query = params.toString();
	return query === "" ? "" : `&${query}`;
}

namespace CommentFields {
	export interface Props {
		pull: number;
		url: URL;
		/** Whether a review is under way, so the primary button adds to it. */
		reviewing: boolean;
		/** The lines when the server draws the form, without script. */
		lines?: { path: string; side: "L" | "R"; start: number; end: number };
		/** Where Cancel goes without script. */
		cancelHref?: string;
	}
}

/**
 * The inline comment form: the lines it covers, the text box, and the buttons that add the
 * comment to a pending review or post it on its own. With script it lives in a template the
 * island copies under the lines a `+` or a drag names.
 */
function CommentFields(handle: Handle<CommentFields.Props>) {
	return () => {
		let { cancelHref, lines, pull, reviewing, url } = handle.props;
		let range =
			lines === undefined
				? ""
				: `${lines.side === "L" ? "−" : "+"}${lines.start === lines.end ? lines.start : `${lines.start}–${lines.end}`}`;
		return (
			<form
				method="post"
				action={`${filesAction(pull, "line-comment")}${carried(url)}`}
				data-slot="delta-line-comment"
				mix={[
					raw({
						display: "grid",
						gap: "0.5rem",
						margin: "0.5rem",
						padding: "0.75rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						backgroundColor: "var(--ui-bg, Canvas)",
						fontFamily: "var(--ui-font-sans)",
						whiteSpace: "normal",
					}),
				]}
			>
				<input type="hidden" name="path" value={lines?.path ?? ""} />
				<input type="hidden" name="side" value={lines?.side ?? "R"} />
				<input type="hidden" name="start" value={String(lines?.start ?? "")} />
				<input type="hidden" name="end" value={String(lines?.end ?? "")} />
				<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
					{`${COPY.review.commentOn} `}
					<span data-delta-draft-lines="" mix={[raw({ fontFamily: "var(--ui-font-mono)" })]}>
						{range}
					</span>
				</span>
				<label mix={[visuallyHidden()]} htmlFor="delta-line-comment-body">
					{COPY.review.commentLabel}
				</label>
				<TextArea
					id="delta-line-comment-body"
					name="body"
					rows={3}
					maxLength={600}
					required
					placeholder={COPY.review.commentPlaceholder}
				/>
				<div
					mix={[
						raw({ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "0.5rem" }),
					]}
				>
					{cancelHref === undefined ? (
						<Button
							type="button"
							variant="ghost"
							color="neutral"
							size="sm"
							data-delta-draft-cancel=""
						>
							{COPY.review.cancel}
						</Button>
					) : (
						<a
							href={cancelHref}
							mix={[raw({ alignSelf: "center", fontSize: "0.875rem", marginInlineEnd: "auto" })]}
						>
							{COPY.review.cancel}
						</a>
					)}
					<Button
						type="submit"
						name="mode"
						value="single"
						variant="outline"
						color="neutral"
						size="sm"
					>
						{COPY.review.single}
					</Button>
					<Button type="submit" name="mode" value="review" size="sm">
						{reviewing ? COPY.review.addToReview : COPY.review.startReview}
					</Button>
				</div>
			</form>
		);
	};
}

namespace ReviewDialog {
	export interface Props {
		pull: PullView;
		url: URL;
	}
}

/**
 * The "Finish your review" dialog: a summary and a choice of Comment, Approve or Request
 * changes, which submits every pending comment with it. The author can only comment.
 */
function ReviewDialog(handle: Handle<ReviewDialog.Props>) {
	return () => {
		let { pull, url } = handle.props;
		let kinds = COPY.review.kinds;
		let options: Array<[string, string, string]> = [
			["comment", kinds.comment, kinds.commentHint],
			["approve", kinds.approve, kinds.approveHint],
			["changes", kinds.changes, kinds.changesHint],
		];
		return (
			<dialog
				id={REVIEW_DIALOG_ID}
				aria-labelledby={`${REVIEW_DIALOG_ID}-title`}
				mix={[
					raw({
						inlineSize: "min(32rem, calc(100vw - 2rem))",
						padding: 0,
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						backgroundColor: "var(--ui-bg, Canvas)",
						color: "var(--ui-neutral-fg)",
						boxShadow: "0 16px 48px rgb(0 0 0 / 0.24)",
						"&::backdrop": { backgroundColor: "rgb(0 0 0 / 0.32)" },
					}),
				]}
			>
				<form
					method="post"
					action={`${filesAction(pull.number, "review")}${carried(url)}`}
					mix={[raw({ display: "grid", gap: "0.875rem", padding: "1rem" })]}
				>
					<h2
						id={`${REVIEW_DIALOG_ID}-title`}
						mix={[raw({ margin: 0, fontSize: "1rem", fontWeight: 600 })]}
					>
						{COPY.review.dialogTitle}
					</h2>
					<label htmlFor="delta-review-body" mix={[visuallyHidden()]}>
						{COPY.review.summary}
					</label>
					<TextArea
						id="delta-review-body"
						name="body"
						rows={4}
						maxLength={600}
						placeholder={COPY.review.summary}
					/>
					<fieldset
						mix={[raw({ margin: 0, padding: 0, border: 0, display: "grid", gap: "0.5rem" })]}
					>
						<legend mix={[visuallyHidden()]}>{COPY.review.kind}</legend>
						{options.map(([value, label, hint]) => (
							<label
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "auto 1fr",
										columnGap: "0.5rem",
										fontSize: "0.875rem",
										cursor: "pointer",
									}),
								]}
							>
								<input
									type="radio"
									name="kind"
									value={value}
									checked={value === "comment"}
									disabled={value !== "comment" && pull.author === ME}
									mix={[raw({ margin: "0.2rem 0 0", accentColor: "var(--ui-brand-bg-solid)" })]}
								/>
								<span mix={[raw({ fontWeight: 600 })]}>{label}</span>
								<span
									mix={[
										raw({
											gridColumn: 2,
											fontSize: "0.75rem",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{hint}
								</span>
							</label>
						))}
					</fieldset>
					<div mix={[raw({ display: "flex", justifyContent: "flex-end", gap: "0.5rem" })]}>
						<Button
							type="button"
							variant="ghost"
							color="neutral"
							size="sm"
							commandfor={REVIEW_DIALOG_ID}
							command="close"
						>
							{COPY.review.close}
						</Button>
						<Button type="submit" size="sm">
							{COPY.review.submit}
						</Button>
					</div>
				</form>
			</dialog>
		);
	};
}

namespace PullFilesScreen {
	export interface Props {
		pull: PullView;
		diff?: DiffView;
		context: CiteContext;
		url: URL;
		now: number;
		commits: number;
		listHref: string;
	}
}

/** The lines `?comment=path:R12` asks the server to draw the comment form under. */
function readCommentParam(
	url: URL,
): { path: string; side: "L" | "R"; start: number; end: number } | undefined {
	let value = url.searchParams.get("comment");
	let match = value === null ? null : /^(.+):([LR])(\d+)$/.exec(value);
	if (match === null) return undefined;
	let line = Number(match[3]);
	return { path: match[1]!, side: match[2] as "L" | "R", start: line, end: line };
}

/**
 * Renders the files page: the header, then the changed-files tree beside the diffs. Each file
 * carries its threads after the lines they cite (an outdated one at the file's first line),
 * its "Viewed" mark, and a `+` per line that comments without script through `?comment=`.
 */
export function PullFilesScreen(handle: Handle<PullFilesScreen.Props>) {
	return () => {
		let { commits, context, diff, listHref, now, pull, url } = handle.props;
		let viewed = new Set(pull.viewed);
		let drafting = readCommentParam(url);
		let pending = pull.threads.filter((thread) => thread.pending).length;
		let pageUrl = (next: URL) => `${next.pathname}${next.search}`;
		let commentHref = (path: string, side: "L" | "R", line: number) => {
			let next = new URL(url);
			next.searchParams.set("comment", `${path}:${side}${line}`);
			next.searchParams.delete("toast");
			next.hash = "";
			return `${pageUrl(next)}#comment-form`;
		};
		let withoutComment = new URL(url);
		withoutComment.searchParams.delete("comment");
		let threadsOf = (file: DiffFileView): Record<string, RemixNode> => {
			let rows: Record<string, RemixNode> = {};
			let add = (key: string, node: RemixNode) => {
				rows[key] =
					rows[key] === undefined ? (
						node
					) : (
						<>
							{rows[key]}
							{node}
						</>
					);
			};
			let first = file.hunks?.[0]?.lines.find((line) => line.new !== undefined)?.new;
			for (let thread of pull.threads.filter((candidate) => candidate.path === file.path)) {
				let key = threadKey(thread, first);
				if (key !== undefined)
					add(key, <PullThread pull={pull} thread={thread} now={now} context={context} />);
			}
			if (drafting !== undefined && drafting.path === file.path) {
				add(
					`${drafting.side}${drafting.end}`,
					<div id="comment-form">
						<CommentFields
							pull={pull.number}
							url={url}
							reviewing={pending > 0}
							lines={drafting}
							cancelHref={pageUrl(withoutComment)}
						/>
					</div>,
				);
			}
			return rows;
		};
		return (
			<>
				<PullHeader
					pull={pull}
					tab="files"
					now={now}
					commits={commits}
					listHref={listHref}
					filesHref={pullHref(pull.number, "files")}
				/>
				<HeadingScope level={2}>
					{diff === undefined ? (
						<div mix={[raw({ paddingBlock: "2rem" })]}>
							<Empty kind="no-results" icon={<FileDiffIcon />}>
								<Empty.Title>{COPY.review.missingTitle}</Empty.Title>
								<Empty.Description>{COPY.review.missingHint}</Empty.Description>
							</Empty>
						</div>
					) : (
						<div
							data-slot="delta-files-changed"
							mix={[raw({ container: "delta-files / inline-size", paddingBlock: "1rem 2rem" })]}
						>
							<div
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "minmax(0, 1fr)",
										gap: "1rem",
										"@container delta-files (width >= 56rem)": {
											gridTemplateColumns: "17rem minmax(0, 1fr)",
											alignItems: "start",
										},
									}),
								]}
							>
								<details
									open
									data-slot="delta-changed-tree"
									mix={[
										raw({
											minInlineSize: 0,
											"@container delta-files (width >= 56rem)": {
												position: "sticky",
												insetBlockStart: "calc(var(--ui-app-sticky-top, 3.5rem) + 7rem)",
												maxBlockSize: "calc(100dvh - var(--ui-app-sticky-top, 3.5rem) - 9rem)",
												overflowY: "auto",
												scrollbarWidth: "thin",
											},
										}),
									]}
								>
									<summary
										mix={[
											raw({
												cursor: "pointer",
												paddingBlock: "0.25rem",
												fontSize: "0.875rem",
												fontWeight: 600,
												color: "var(--ui-neutral-fg-emphasis)",
											}),
										]}
									>
										{`${COPY.review.tree} · ${diff.files.length}`}
									</summary>
									<Tree
										id={TREE_ID}
										aria-label={COPY.review.treeLabel}
										mix={[raw({ marginBlockStart: "0.5rem" })]}
									>
										<Tree.Navigation labels={TREE_LABELS} />
										<ChangedNodes nodes={changedTree(diff.files)} />
									</Tree>
								</details>
								<DiffPage
									diff={diff}
									url={url}
									viewed={diff.files.filter((file) => viewed.has(file.path)).length}
									comments
									toolbar={
										<span
											mix={[
												raw({
													display: "inline-flex",
													alignItems: "center",
													gap: "0.75rem",
													marginInlineEnd: "auto",
												}),
											]}
										>
											<span
												mix={[
													raw({
														fontSize: "0.875rem",
														color: "var(--ui-neutral-fg-muted)",
														fontVariantNumeric: "tabular-nums",
													}),
												]}
											>
												{COPY.review.summaryLine(diff.files.length, diff.additions, diff.deletions)}
											</span>
										</span>
									}
									extra={(file) => ({
										viewed: viewed.has(file.path),
										viewedControl: (
											<ViewedToggle
												pull={pull.number}
												file={file}
												viewed={viewed.has(file.path)}
												url={url}
											/>
										),
										threads: threadsOf(file),
										commentHref: pull.state === "open" ? commentHref : undefined,
										labels: FILE_LABELS,
									})}
								>
									<template id={COMMENT_TEMPLATE_ID}>
										<CommentFields pull={pull.number} url={url} reviewing={pending > 0} />
									</template>
								</DiffPage>
							</div>
							{pull.state === "open" ? (
								<div
									data-slot="delta-review-bar"
									mix={[
										raw({
											position: "sticky",
											insetBlockEnd: "1rem",
											display: "flex",
											justifyContent: "flex-end",
											marginBlockStart: "1rem",
											pointerEvents: "none",
											"& > *": { pointerEvents: "auto" },
										}),
									]}
								>
									<Button
										type="button"
										commandfor={REVIEW_DIALOG_ID}
										command="show-modal"
										size="sm"
										mix={[raw({ boxShadow: "0 6px 20px rgb(0 0 0 / 0.18)" })]}
									>
										<MessageSquarePlusIcon size={16} aria-hidden="true" />
										{pending > 0 ? COPY.review.finishCount(pending) : COPY.review.finish}
									</Button>
									<ReviewDialog pull={pull} url={url} />
								</div>
							) : null}
						</div>
					)}
				</HeadingScope>
			</>
		);
	};
}

/** Where a thread sits among a file's rows: after its last line, or at the first shown line once outdated. */
function threadKey(thread: ThreadView, first: number | undefined): string | undefined {
	if (!thread.outdated && thread.end !== undefined) return `${thread.side}${thread.end}`;
	return first === undefined ? undefined : `R${first}`;
}

/** A file card's strings with the `+` link's name, for a page that takes comments. */
const FILE_LABELS: Diff.FileLabels = { ...DIFF_FILE_LABELS, addComment: COPY.review.addComment };
