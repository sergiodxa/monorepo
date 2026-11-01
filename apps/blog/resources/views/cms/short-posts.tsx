/**
 * Views for managing notes and TILs in the CMS: a list under status tabs, search and sort kept
 * in the address, and an editor whose writing column is the content and its count of X's limit.
 * One pair serves both kinds; a TIL adds a title, a slug and tags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle } from "remix/component";

import { ExternalLinkIcon, Share2Icon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { pbe, pbs } from "@sdxc/u/size";
import { overflowWrap, text, truncate, weight } from "@sdxc/u/typography";
import { Button, Link, LinkButton } from "@sdxc/ui";
import { EditorLayout } from "@sdxc/ui/app/editor-layout";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SaveBar } from "@sdxc/ui/app/save-bar";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { Table } from "@sdxc/ui/app/table";

import type { ShortPostViewModel } from "~/app/http/view-models/cms/short-posts";

import { POST_KINDS } from "~/app/models/kinds";
import { noteTitle } from "~/app/models/post-values";
import { ShortField } from "~/resources/components/short-field";
import { CMSLayout } from "~/resources/layouts/cms";
import { DateCell, TextCell } from "~/resources/views/cms/cells";
import {
	editorStatus,
	isScheduled,
	SidebarField,
	SidebarSection,
} from "~/resources/views/cms/editor";
import {
	DeleteAction,
	FILTER_LABELS,
	ListEmpty,
	ListKeys,
	matchesSearch,
	PAGINATION_LABELS,
	pageOf,
	readListQuery,
	SORT_OPTIONS,
	sortRows,
	statusTab,
} from "~/resources/views/cms/list";
import routes from "~/routes/web";

/**
 * Types used by the notes and TILs list view.
 */
export namespace CMSShortPostsIndexView {
	/** Which kind the list shows, and its rows. */
	export interface Props {
		kind: ShortPostViewModel.Kind;
		items: Array<ShortPostViewModel.Row>;
	}
}

/**
 * Types used by the note and TIL form.
 */
export namespace CMSShortPostsActionView {
	/** The form's heading, behavior and values. */
	export interface Props extends ShortPostViewModel.Form {}
}

/** The status tabs' values, in the order they show. */
type Status = "all" | "published" | "scheduled";

/** The CMS routes of a kind's screens. */
function routesOf(kind: ShortPostViewModel.Kind) {
	return kind === "note" ? routes.cms.notes : routes.cms.tils;
}

/** What a kind is called inside a sentence-case label: "New note", "New TIL". */
function nounOf(kind: ShortPostViewModel.Kind): string {
	return kind === "note" ? "note" : "TIL";
}

/**
 * The list's sort menu. A note has no title, so its list sorts by date alone; a TIL's also
 * sorts by title.
 */
function sortOptionsOf(kind: ShortPostViewModel.Kind) {
	if (kind === "til") return SORT_OPTIONS;
	return { ...SORT_OPTIONS, options: SORT_OPTIONS.options.filter((o) => o.value !== "title") };
}

/**
 * Lists every note or TIL, scheduled ones included, newest first. A note's row reads as its
 * content shortened, since a note has no title. The tabs count what the search keeps, and a
 * search or tab is in the address, so a filtered list is a link.
 */
export function CMSShortPostsIndexView() {
	return ({ model, assets }: { model: CMSShortPostsIndexView.Props; assets: DocumentAssets }) => {
		let { items, kind } = model;
		let { plural } = POST_KINDS[kind];
		let noun = nounOf(kind);
		let til = kind === "til";
		let cms = routesOf(kind);
		let filterId = `${kind}-filters`;
		let tableId = `${kind}-table`;
		let query = readListQuery();
		let searched = items.filter((item) => matchesSearch(query.q, item.label, item.slug, item.tags));
		let inStatus = (status: Status) =>
			searched.filter((item) => status === "all" || (status === "scheduled") === item.preview);
		let sorted = sortRows(inStatus(query.status as Status), query.sort, {
			title: (item) => item.label,
			date: (item) => item.publishedAt,
		});
		let page = pageOf(sorted, query);
		let newPost = (
			<LinkButton href={cms.new.href()} color="brand" size="sm">
				New {noun}
			</LinkButton>
		);

		return (
			<CMSLayout assets={assets} title={plural} activePath={cms.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title={plural}
						description={
							til
								? "Things learned, each shared on X as a TIL with its permalink."
								: "Short posts, each shared on X whole with its permalink."
						}
						primaryAction={newPost}
					/>
					<FilterBar
						id={filterId}
						url={query.url}
						tabs={[
							statusTab(query, "all", "All", inStatus("all").length),
							statusTab(query, "published", "Published", inStatus("published").length),
							statusTab(query, "scheduled", "Scheduled", inStatus("scheduled").length),
						]}
						search={{
							label: `Search ${plural}`,
							placeholder: til ? "Search by title, slug or tag…" : "Search notes…",
						}}
						sort={sortOptionsOf(kind)}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 ? (
						<ListEmpty
							query={query}
							noun={til ? "TILs" : "notes"}
							firstRun={items.length === 0}
							action={newPost}
						/>
					) : (
						<>
							<div id={tableId}>
								<Table.Container>
									<ListKeys filterBar={filterId} />
									<Table aria-label={plural} density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>{til ? "Title" : "Note"}</Table.Column>
												{til ? (
													<Table.Column
														mix={[
															raw({
																"@container ui-app-content (max-width: 48rem)": { display: "none" },
															}),
														]}
													>
														Tags
													</Table.Column>
												) : null}
												<Table.Column>Status</Table.Column>
												<Table.Column
													mix={[
														raw({
															"@container ui-app-content (max-width: 40rem)": { display: "none" },
														}),
													]}
												>
													Date
												</Table.Column>
												<Table.ActionsColumn label="Actions" />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{page.rows.map((item) => (
												<Table.Row key={item.id}>
													<Table.Cell mix={[raw({ maxInlineSize: "min(32rem, 50cqi)" })]}>
														<span
															mix={[
																vstack({ gap: 0.5, align: "stretch" }),
																raw({ minInlineSize: "0" }),
															]}
														>
															<Table.RowLink
																href={item.href}
																mix={[til ? weight("semibold") : weight("normal"), truncate()]}
															>
																{item.label}
															</Table.RowLink>
															{til ? (
																<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>
																	/{item.slug}
																</span>
															) : null}
														</span>
													</Table.Cell>
													{til ? (
														<TextCell value={item.tags} maxInlineSize="14rem" hideBelow="48rem" />
													) : null}
													<Table.StatusCell color={item.preview ? "warning" : "success"}>
														{item.preview ? "Scheduled" : "Published"}
													</Table.StatusCell>
													<DateCell date={item.publishedAt} hideNarrow />
													<Table.Actions>
														<LinkButton
															href={item.publicHref}
															variant="ghost"
															color="neutral"
															size="sm"
														>
															View
														</LinkButton>
														<LinkButton
															href={item.shareHref}
															target="_blank"
															rel="noopener"
															variant="ghost"
															color="neutral"
															size="sm"
														>
															Post on X
														</LinkButton>
														<DeleteAction
															id={`${kind}-${item.id}`}
															name={item.label}
															noun={noun}
															action={item.deleteAction}
															consequence="is removed, and its permalink answers that it was deleted."
														/>
													</Table.Actions>
												</Table.Row>
											))}
										</Table.Body>
									</Table>
								</Table.Container>
							</div>
							<SelectionBar
								target={tableId}
								pagination={page.pagination}
								locale="en-US"
								labels={PAGINATION_LABELS}
							/>
						</>
					)}
				</div>
			</CMSLayout>
		);
	};
}

/** Props accepted by {@link ShortColumn}. */
interface ShortColumnProps {
	/** The form's id, which the editor bar's buttons and the sidebar's fields submit with. */
	form: string;
	action: string;
	/** Whether the form updates a saved post, which the router reads from `_method=PUT`. */
	editing: boolean;
	kind: ShortPostViewModel.Kind;
	/** A TIL's title; a note has none, so its column is the content alone. */
	title: string;
	content: string;
	/** Why the last save was refused, shown under the content. */
	error: string;
	/** What the floating bar's Save says once the form is dirty. */
	saveLabel: string;
}

/**
 * The short post's writing surface: a TIL's large title over its content, or a note's content
 * alone, counted against X's limit as it is typed.
 */
function ShortColumn(handle: Handle<ShortColumnProps>) {
	return () => {
		let { form, action, editing, kind, title, content, error, saveLabel } = handle.props;

		return (
			<form
				id={form}
				method="post"
				action={action}
				mix={[vstack({ gap: 4, align: "stretch" }), pbs(6), pbe(16)]}
			>
				{editing ? <input type="hidden" name="_method" value="PUT" /> : null}
				{kind === "til" ? (
					<>
						<label htmlFor="title" mix={[visuallyHidden()]}>
							Title
						</label>
						<input
							id="title"
							name="title"
							defaultValue={title}
							placeholder="Today I learned…"
							required
							autoComplete="off"
							mix={[
								text("3xl"),
								weight("semibold"),
								fg("neutral.emphasis"),
								raw({
									border: "none",
									background: "transparent",
									padding: "0",
									outline: "none",
									inlineSize: "100%",
								}),
							]}
						/>
					</>
				) : null}
				<label htmlFor="content" mix={[visuallyHidden()]}>
					{kind === "til" ? "What you learned" : "Note"}
				</label>
				<ShortField id="content" kind={kind} content={content} error={error} />
				<SaveBar
					labels={{
						message: "Unsaved changes",
						discard: "Discard",
						save: saveLabel,
						shortcut: "⌘S",
					}}
				/>
			</form>
		);
	};
}

/**
 * What the editor bar calls the post: a TIL's title once typed; a note, which has no title,
 * by its kind.
 */
function barTitle(kind: ShortPostViewModel.Kind, editing: boolean, title: string): string {
	if (kind === "til" && title !== "") return title;
	return editing ? POST_KINDS[kind].label : `New ${nounOf(kind)}`;
}

/**
 * The note or TIL editor. A TIL's slug is typed or taken from its title and fixed once saved;
 * a note's comes from its publish date, so its sidebar has none. A saved post's public URL is
 * linked in full in the sidebar.
 */
export function CMSShortPostsActionView() {
	return ({ model, assets }: { model: CMSShortPostsActionView.Props; assets: DocumentAssets }) => {
		let { action, contentError, deleteAction, kind, mode, publicHref, shareHref, title, values } =
			model;
		let cms = routesOf(kind);
		let noun = nounOf(kind);
		let editing = mode === "edit";
		let form = `${kind}-form`;
		let saveLabel = editing ? `Save ${noun}` : `Create ${noun}`;

		return (
			<CMSLayout assets={assets} title={title} activePath={cms.index.href()}>
				<EditorLayout
					form={form}
					back={{ href: cms.index.href(), label: POST_KINDS[kind].plural }}
					title={barTitle(kind, editing, values.title)}
					status={editorStatus(
						editing,
						isScheduled(values.published_at),
						contentError !== undefined,
					)}
					preview={
						publicHref && editing ? (
							<LinkButton
								href={publicHref}
								target="_blank"
								rel="noopener"
								variant="outline"
								color="neutral"
								size="sm"
							>
								<ExternalLinkIcon size={16} aria-hidden="true" />
								View
							</LinkButton>
						) : null
					}
					primary={
						<Button type="submit" form={form} color="brand" size="sm">
							{saveLabel}
						</Button>
					}
					sidebar={
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<SidebarSection title="Publishing">
								<SidebarField
									form={form}
									id="published_at"
									name="published_at"
									label="Publish on"
									type="date"
									value={values.published_at}
									description="A later date schedules it; empty publishes on save."
								/>
								{kind === "til" ? (
									<SidebarField
										form={form}
										id="slug"
										name="slug"
										label="Slug"
										value={values.slug}
										readOnly={editing}
										placeholder="Taken from the title"
										description={editing ? "Fixed once saved, so links keep working." : undefined}
									/>
								) : null}
								{publicHref && editing ? (
									<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
										<span mix={[text("sm"), weight("medium")]}>Public URL</span>
										<Link href={publicHref} mix={[text("sm"), overflowWrap("anywhere")]}>
											{publicHref}
										</Link>
									</div>
								) : null}
								{kind === "til" ? (
									<SidebarField
										form={form}
										id="tags"
										name="tags"
										label="Tags"
										value={values.tags}
										placeholder="remix, typescript"
										description="Separate tags with commas."
									/>
								) : null}
							</SidebarSection>
							{shareHref ? (
								<SidebarSection title="Sharing">
									<LinkButton
										href={shareHref}
										target="_blank"
										rel="noopener"
										variant="outline"
										color="neutral"
										size="sm"
									>
										<Share2Icon size={16} aria-hidden="true" />
										Post on X
									</LinkButton>
								</SidebarSection>
							) : null}
							{deleteAction && editing ? (
								<div mix={[hstack({ gap: 2 })]}>
									<DeleteAction
										id={kind}
										name={kind === "til" ? values.title : noteTitle(values.content)}
										noun={noun}
										action={deleteAction}
										consequence="is removed, and its permalink answers that it was deleted."
										prominent
									/>
								</div>
							) : null}
						</div>
					}
					labels={{
						settings: `${POST_KINDS[kind].label} settings`,
						closeSettings: "Close settings",
						sidebar: `${POST_KINDS[kind].label} settings`,
					}}
					mix={[raw({ margin: "calc(-1 * var(--ui-app-gutter, 1rem))", inlineSize: "auto" })]}
				>
					<ShortColumn
						form={form}
						action={action}
						editing={editing}
						kind={kind}
						title={values.title}
						content={values.content}
						error={contentError ?? ""}
						saveLabel={saveLabel}
					/>
				</EditorLayout>
			</CMSLayout>
		);
	};
}
