/**
 * Inkwell's posts list: status count tabs, an author facet and search that filter the
 * fixtures from the address, a comfortable table whose selection turns the footer into
 * Publish · Unpublish · Delete, and a quick-edit sheet opened by `?quick=<id>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { EyeIcon, EyeOffIcon, SendIcon, Trash2Icon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hidden, hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Badge, Button, Label, LinkButton, Select, TextField } from "@sdxc/ui";
import { clearFiltersHref, setParamHref } from "@sdxc/ui/app";
import { DetailSheet } from "@sdxc/ui/app/detail-sheet";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { Table } from "@sdxc/ui/app/table";
import { HeadingScope } from "@sdxc/ui/heading-scope";

import type { Post } from "~/resources/views/demo-apps/inkwell/data";
import type { PostsQuery } from "~/resources/views/demo-apps/inkwell/posts-query";

import {
	AUTHORS,
	findAuthor,
	POSTS,
	postDate,
	TAGS,
} from "~/resources/views/demo-apps/inkwell/data";
import {
	applyPostsQuery,
	LIST_PARAMS,
	matchFacets,
	STATUS_COLOR,
	STATUS_LABEL,
} from "~/resources/views/demo-apps/inkwell/posts-query";
import { action, Byline, href, SerifTitle } from "~/resources/views/demo-apps/inkwell/shell";

/** The filter bar's strings. */
const FILTER_LABELS: FilterBar.Labels = {
	toolbar: "Filter posts",
	tabs: "Post status",
	filters: "Filters",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
	options: "View",
};

/** The quick-edit sheet's strings. */
const SHEET_LABELS: DetailSheet.Labels = {
	close: "Close quick edit",
	copyLink: "Copy link",
	linkCopied: "Link copied",
	previous: "Previous post",
	next: "Next post",
	position: "Post",
};

/** The selection bar's strings. */
const SELECTION_LABELS = {
	toolbar: "Posts",
	clear: "Clear selection",
	selected: "{count} selected",
	cleared: "Selection cleared",
	previous: "Previous page",
	next: "Next page",
};

/** Props accepted by {@link PostsScreen}. */
interface PostsScreenProps {
	/** The list's address with the toast and quick-edit params already dropped. */
	listUrl: URL;
	query: PostsQuery;
	/** The post the quick-edit sheet holds, when the address names one. */
	quick: Post | null;
	/** Whether the last quick edit came back with an empty title. */
	titleIssue: boolean;
	/** The fields a failed quick edit carried, shown in the sheet in place of the saved ones. */
	edited?: QuickEditValues;
	now: Date;
}

/** The quick-edit fields as a submit carried them. */
export type QuickEditValues = Pick<Post, "title" | "slug" | "status" | "authorId">;

/**
 * The posts list. Tabs count what each would show under the current facets, the table keeps
 * the toolbar on no results, and the quick-edit sheet steps through the filtered rows.
 */
export function PostsScreen(handle: Handle<PostsScreenProps>) {
	return () => {
		let { listUrl, query, quick, titleIssue, edited, now } = handle.props;
		let faceted = matchFacets(POSTS, query);
		let rows = applyPostsQuery(POSTS, query, now);
		let reset = ["page", "quick"];
		let tab = (status: Post["status"] | null, label: string) => ({
			label,
			count: faceted.filter((post) => status === null || post.status === status).length,
			href: setParamHref(listUrl, "status", status, reset),
			current: (status ?? "all") === query.status,
		});
		let sortHref = (value: string) => setParamHref(listUrl, "sort", value, reset);

		return (
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<PageHeader
					title={<SerifTitle>Posts</SerifTitle>}
					description="Everything Lantern Review has published, queued or left in the drawer."
					primaryAction={
						<LinkButton href={href("posts/new")} color="brand" size="sm">
							New post
						</LinkButton>
					}
				/>
				<FilterBar
					id="posts-filters"
					url={listUrl}
					tabs={[
						tab(null, "All"),
						tab("published", "Published"),
						tab("draft", "Drafts"),
						tab("scheduled", "Scheduled"),
					]}
					facets={[
						{
							name: "author",
							label: "Author",
							options: AUTHORS.map((author) => ({
								value: author.id,
								label: author.name,
								count: POSTS.filter((post) => post.authorId === author.id).length,
							})),
						},
						{
							name: "tag",
							label: "Tag",
							options: TAGS.map((tag) => ({
								value: tag,
								label: tag,
								count: POSTS.filter((post) => post.tags.includes(tag)).length,
							})),
						},
					]}
					search={{ label: "Search posts", placeholder: "Search posts…" }}
					sort={{
						label: "Sort by",
						defaultValue: "-date",
						options: [
							{ value: "-date", label: "Newest first" },
							{ value: "date", label: "Oldest first" },
							{ value: "title", label: "Title A–Z" },
						],
					}}
					collapse
					locale="en-US"
					labels={FILTER_LABELS}
				/>
				{rows.length === 0 ? (
					<Table.Empty>
						<HeadingScope level={2}>
							<Empty kind="no-results" size="compact">
								<Empty.Title>No posts match</Empty.Title>
								<Empty.Description>
									{query.q === "" ? (
										"Nothing here fits these filters."
									) : (
										<>
											Nothing matches <Empty.Query>{query.q}</Empty.Query> with these filters.
										</>
									)}
								</Empty.Description>
								<Empty.Action>
									<LinkButton
										href={clearFiltersHref(
											listUrl,
											LIST_PARAMS.filter((name) => name !== "sort"),
										)}
										variant="outline"
										color="neutral"
										size="sm"
									>
										Clear filters
									</LinkButton>
								</Empty.Action>
							</Empty>
						</HeadingScope>
					</Table.Empty>
				) : (
					<PostsTable
						rows={rows}
						listUrl={listUrl}
						query={query}
						now={now}
						sortHref={sortHref}
						quickId={quick?.id ?? null}
					/>
				)}
				{quick === null ? null : (
					<QuickEditSheet
						post={quick}
						rows={rows}
						listUrl={listUrl}
						titleIssue={titleIssue}
						edited={edited}
					/>
				)}
			</div>
		);
	};
}

/** Props accepted by {@link PostsTable}. */
interface PostsTableProps {
	rows: Post[];
	listUrl: URL;
	query: PostsQuery;
	now: Date;
	sortHref: (value: string) => string;
	quickId: string | null;
}

/**
 * The table and its footer. Checkboxes submit with the bulk form beside the table; on a phone
 * the author, tags and date columns fold away and the byline moves under the title.
 */
function PostsTable(handle: Handle<PostsTableProps>) {
	return () => {
		let { rows, listUrl, query, now, sortHref, quickId } = handle.props;
		let wideOnly = raw({ "@container ui-app-content (max-width: 55.999rem)": { display: "none" } });
		let titleSort = query.sort === "title" ? "-title" : "title";
		let dateSort = query.sort === "-date" ? "date" : "-date";
		let quickHref = (post: Post) => setParamHref(listUrl, "quick", post.id, ["page"]);

		return (
			<>
				<form id="posts-bulk" method="post" action={action("posts")} mix={[hidden()]}>
					<input type="hidden" name="back" value={listUrl.search} />
				</form>
				<div id="posts-table">
					<Table.Container>
						<Table aria-label="Posts" density="comfortable">
							<Table.Header>
								<Table.Row>
									<Table.SelectAll label="Select all posts" />
									<Table.Column
										href={sortHref(titleSort)}
										sortDirection={columnSort(query.sort, "title")}
									>
										Title
									</Table.Column>
									<Table.Column mix={[wideOnly]}>Author</Table.Column>
									<Table.Column>Status</Table.Column>
									<Table.Column mix={[wideOnly]}>Tags</Table.Column>
									<Table.Column
										href={sortHref(dateSort)}
										sortDirection={columnSort(query.sort, "date")}
										mix={[wideOnly]}
									>
										Date
									</Table.Column>
									<Table.ActionsColumn label="Actions" />
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{rows.map((post) => {
									let author = findAuthor(post.authorId);
									return (
										<Table.Row
											key={post.id}
											aria-current={post.id === quickId ? "true" : undefined}
										>
											<Table.Select
												name="post"
												value={post.id}
												form="posts-bulk"
												label={`Select ${post.title}`}
											/>
											<Table.Cell mix={[raw({ maxInlineSize: "min(26rem, 46cqi)" })]}>
												<span
													mix={[
														vstack({ gap: 0.5, align: "stretch" }),
														raw({ minInlineSize: "0" }),
													]}
												>
													<span mix={[hstack({ gap: 2, align: "center" })]}>
														<Table.RowLink
															href={href(`posts/${post.id}`)}
															mix={[weight("semibold"), truncate()]}
														>
															{post.title}
														</Table.RowLink>
														{post.changed ? (
															<Badge
																color="warning"
																variant="secondary"
																title="Edited since it went live; the site shows the older copy."
															>
																Changed
															</Badge>
														) : null}
													</span>
													<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>
														<span
															mix={[
																raw({
																	"@container ui-app-content (min-width: 56rem)": {
																		display: "none",
																	},
																}),
															]}
														>
															{`${author.name} · `}
														</span>
														{post.excerpt}
													</span>
												</span>
											</Table.Cell>
											<Table.Cell mix={[wideOnly]}>
												<Byline author={author} />
											</Table.Cell>
											<Table.StatusCell color={STATUS_COLOR[post.status]}>
												{STATUS_LABEL[post.status]}
											</Table.StatusCell>
											<Table.Cell mix={[wideOnly, fg("neutral.muted"), text("xs")]}>
												{post.tags.join(", ")}
											</Table.Cell>
											<Table.DateCell
												date={postDate(post, now)}
												now={now}
												locale="en-US"
												local
												mix={[wideOnly]}
											/>
											<Table.Actions>
												<LinkButton
													href={href(`posts/${post.id}`)}
													variant="ghost"
													color="neutral"
													size="sm"
												>
													Edit
												</LinkButton>
												<LinkButton
													href={quickHref(post)}
													variant="ghost"
													color="neutral"
													size="sm"
												>
													Quick edit
												</LinkButton>
												<LinkButton
													href={href(`posts/${post.id}/preview`)}
													variant="ghost"
													color="neutral"
													size="sm"
												>
													View
												</LinkButton>
											</Table.Actions>
										</Table.Row>
									);
								})}
							</Table.Body>
						</Table>
					</Table.Container>
				</div>
				<SelectionBar
					target="posts-table"
					form="posts-bulk"
					pagination={{ summary: `Viewing 1–${rows.length} of ${rows.length}` }}
					actions={[
						{
							label: "Publish",
							key: "p",
							icon: <SendIcon size={16} />,
							name: "intent",
							value: "publish",
						},
						{
							label: "Unpublish",
							key: "u",
							icon: <EyeOffIcon size={16} />,
							name: "intent",
							value: "unpublish",
						},
						{
							label: "Delete",
							key: "d",
							icon: <Trash2Icon size={16} />,
							name: "intent",
							value: "delete",
							danger: true,
						},
					]}
					locale="en-US"
					labels={SELECTION_LABELS}
				/>
			</>
		);
	};
}

/**
 * The `aria-sort` direction a sortable column reports: set only on the column the list is
 * sorted by, so exactly one header says how the rows are ordered.
 *
 * @param sort The list's sort param.
 * @param column The column's sort key.
 * @returns The column's direction, or `undefined` when another column sorts the list.
 */
function columnSort(sort: string, column: "title" | "date"): Table.SortDirection | undefined {
	if (sort.replace("-", "") !== column) return undefined;
	return sort.startsWith("-") ? "descending" : "ascending";
}

/** Props accepted by {@link QuickEditSheet}. */
interface QuickEditSheetProps {
	post: Post;
	rows: Post[];
	listUrl: URL;
	titleIssue: boolean;
	edited?: QuickEditValues;
}

/**
 * Edits a post's title, slug, status and author without leaving the list. The sheet steps
 * through the filtered rows, and its form carries the list's query back, so saving lands on
 * the same view.
 */
function QuickEditSheet(handle: Handle<QuickEditSheetProps>) {
	return () => {
		let { post, rows, listUrl, titleIssue, edited } = handle.props;
		let shown = edited ?? post;
		let index = rows.findIndex((row) => row.id === post.id);
		let at = (offset: number) => {
			let neighbour = rows[index + offset];
			return neighbour === undefined
				? null
				: setParamHref(listUrl, "quick", neighbour.id, ["page"]);
		};
		let closeHref = setParamHref(listUrl, "quick", null, ["page"]);

		return (
			<DetailSheet
				id="quick-edit"
				title={post.title}
				description="Quick edit"
				closeHref={closeHref}
				position={
					index === -1
						? undefined
						: { index: index + 1, total: rows.length, previousHref: at(-1), nextHref: at(1) }
				}
				labels={SHEET_LABELS}
				footer={
					<div mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
						<Button type="submit" form="quick-edit-form" color="brand" size="sm">
							Update post
						</Button>
						<LinkButton href={closeHref} variant="ghost" color="neutral" size="sm">
							Cancel
						</LinkButton>
						<LinkButton
							href={href(`posts/${post.id}`)}
							variant="ghost"
							color="neutral"
							size="sm"
							mix={[raw({ marginInlineStart: "auto" })]}
						>
							<EyeIcon size={16} aria-hidden="true" />
							Open editor
						</LinkButton>
					</div>
				}
			>
				<form
					id="quick-edit-form"
					method="post"
					action={action(`posts/${post.id}/quick`)}
					mix={[vstack({ gap: 4, align: "stretch" })]}
				>
					<input type="hidden" name="back" value={listUrl.search} />
					<TextField
						label="Title"
						name="title"
						defaultValue={shown.title}
						errorMessage={titleIssue ? "Give the post a title, then update it again." : undefined}
						required
					/>
					<TextField
						label="Slug"
						name="slug"
						defaultValue={shown.slug}
						description={`lanternreview.example/${post.slug}`}
						pattern="[a-z0-9\-]+"
					/>
					<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
						<Label htmlFor="quick-edit-status">Status</Label>
						<Select id="quick-edit-status" name="status">
							{(["draft", "published", "scheduled"] as const).map((status) => (
								<Select.Option value={status} selected={status === shown.status}>
									{STATUS_LABEL[status]}
								</Select.Option>
							))}
						</Select>
					</div>
					<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
						<Label htmlFor="quick-edit-author">Author</Label>
						<Select id="quick-edit-author" name="author">
							{AUTHORS.map((author) => (
								<Select.Option value={author.id} selected={author.id === shown.authorId}>
									{author.name}
								</Select.Option>
							))}
						</Select>
					</div>
					<p mix={[m(0), text("xs"), fg("neutral.muted")]}>
						Tags, the excerpt and the body change in the editor.
					</p>
				</form>
			</DetailSheet>
		);
	};
}
