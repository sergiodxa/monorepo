/**
 * Views for managing tutorials in the CMS. `CMSTutorialsIndexView` lists them under status tabs,
 * search and sort kept in the address, with row actions to edit, view, post on X or delete;
 * `CMSTutorialsActionView` is the editor, a writing column beside the tutorial's properties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { ExternalLinkIcon, Share2Icon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { overflowWrap, text, truncate, weight } from "@sdxc/u/typography";
import { Button, Link, LinkButton } from "@sdxc/ui";
import { EditorLayout } from "@sdxc/ui/app/editor-layout";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { Table } from "@sdxc/ui/app/table";

import { TeaserField } from "~/resources/components/teaser-field";
import { CMSLayout } from "~/resources/layouts/cms";
import { DateCell, TextCell } from "~/resources/views/cms/cells";
import {
	editorStatus,
	isScheduled,
	SidebarField,
	SidebarSection,
	WritingColumn,
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
 * Type contracts for the CMS tutorials list page.
 */
export namespace CMSTutorialsIndexView {
	/**
	 * One tutorial row rendered in the CMS list table.
	 */
	export interface Item {
		id: string;
		title: string;
		slug: string;
		publicHref: string;
		/** The author's "Post on X" link, prefilled with the post's share text. */
		shareHref: string;
		/** Whether its publish date is still ahead, which only the CMS shows. */
		preview: boolean;
		/** When it went or goes live; `null` for a tutorial published on save. */
		publishedAt: string | null;
		/** Its tags joined with ", ", empty when it has none. */
		tags: string;
		href: string;
		deleteAction: string;
	}

	/**
	 * Data required to render the CMS tutorials list view.
	 */
	export interface Props {
		items: Array<Item>;
	}
}

/**
 * Type contracts for the CMS tutorial create/edit form.
 */
export namespace CMSTutorialsActionView {
	/**
	 * Form field values used by the tutorial action screen.
	 */
	export interface FormValues {
		title: string;
		slug: string;
		excerpt: string;
		/** One line written for X; blank lets the excerpt stand in. */
		teaser: string;
		tags: string;
		content: string;
		published_at: string;
	}

	/**
	 * Data required to render the tutorial action form.
	 */
	export interface Props {
		title: string;
		description: string;
		/** The saved post's public URL, linked in the sidebar; absent until the post is saved. */
		publicHref?: string;
		mode: "new" | "edit";
		action: string;
		submitLabel: string;
		deleteAction?: string;
		/** The "Post on X" link of the saved post; absent until the post is saved. */
		shareHref?: string;
		/** Why the last save was refused, shown under the teaser. */
		teaserError?: string;
		values: FormValues;
	}
}

/** The filter bar's id, whose search field `/` focuses. */
const FILTER_ID = "tutorials-filters";

/** The editor form's id, which the bar's buttons, ⌘S and the sidebar's fields submit with. */
const FORM_ID = "tutorial-form";

/** The status tabs' values, in the order they show. */
type Status = "all" | "published" | "scheduled";

/**
 * Lists every tutorial, scheduled ones included, newest first. The tabs count what the search
 * keeps, and a search or tab is in the address, so a filtered list is a link.
 */
export function CMSTutorialsIndexView() {
	return ({ model, assets }: { model: CMSTutorialsIndexView.Props; assets: DocumentAssets }) => {
		let query = readListQuery();
		let searched = model.items.filter((item) =>
			matchesSearch(query.q, item.title, item.slug, item.tags),
		);
		let inStatus = (status: Status) =>
			searched.filter((item) => status === "all" || (status === "scheduled") === item.preview);
		let sorted = sortRows(inStatus(query.status as Status), query.sort, {
			title: (item) => item.title,
			date: (item) => item.publishedAt,
		});
		let page = pageOf(sorted, query);
		let newTutorial = (
			<LinkButton href={routes.cms.tutorials.new.href()} color="brand" size="sm">
				New tutorial
			</LinkButton>
		);

		return (
			<CMSLayout assets={assets} title="Tutorials" activePath={routes.cms.tutorials.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Tutorials"
						description="Step-by-step guides, live and scheduled."
						primaryAction={newTutorial}
					/>
					<FilterBar
						id={FILTER_ID}
						url={query.url}
						tabs={[
							statusTab(query, "all", "All", inStatus("all").length),
							statusTab(query, "published", "Published", inStatus("published").length),
							statusTab(query, "scheduled", "Scheduled", inStatus("scheduled").length),
						]}
						search={{ label: "Search tutorials", placeholder: "Search by title, slug or tag…" }}
						sort={SORT_OPTIONS}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 ? (
						<ListEmpty
							query={query}
							noun="tutorials"
							firstRun={model.items.length === 0}
							action={newTutorial}
						/>
					) : (
						<>
							<div id="tutorials-table">
								<Table.Container>
									<ListKeys filterBar={FILTER_ID} />
									<Table aria-label="Tutorials" density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>Title</Table.Column>
												<Table.Column
													mix={[
														raw({
															"@container ui-app-content (max-width: 48rem)": { display: "none" },
														}),
													]}
												>
													Tags
												</Table.Column>
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
																mix={[weight("semibold"), truncate()]}
															>
																{item.title}
															</Table.RowLink>
															<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>
																/{item.slug}
															</span>
														</span>
													</Table.Cell>
													<TextCell value={item.tags} maxInlineSize="14rem" hideBelow="48rem" />
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
															id={`tutorial-${item.id}`}
															name={item.title}
															noun="tutorial"
															action={item.deleteAction}
														/>
													</Table.Actions>
												</Table.Row>
											))}
										</Table.Body>
									</Table>
								</Table.Container>
							</div>
							<SelectionBar
								target="tutorials-table"
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

/**
 * The tutorial editor: the title, excerpt and Markdown body in the writing column, and the
 * publishing, sharing and delete controls in the sidebar, all saved by one form. A saved
 * tutorial's public URL is linked in full in the sidebar, so the author opens it in one click.
 */
export function CMSTutorialsActionView() {
	return ({ model, assets }: { model: CMSTutorialsActionView.Props; assets: DocumentAssets }) => {
		let { action, deleteAction, mode, publicHref, shareHref, teaserError, title, values } = model;
		let editing = mode === "edit";
		let scheduled = isScheduled(values.published_at);
		let saveLabel = editing ? "Save tutorial" : "Create tutorial";

		return (
			<CMSLayout assets={assets} title={title} activePath={routes.cms.tutorials.index.href()}>
				<EditorLayout
					form={FORM_ID}
					back={{ href: routes.cms.tutorials.index.href(), label: "Tutorials" }}
					title={values.title || "New tutorial"}
					status={editorStatus(editing, scheduled, teaserError !== undefined)}
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
						<Button type="submit" form={FORM_ID} color="brand" size="sm">
							{saveLabel}
						</Button>
					}
					sidebar={
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<SidebarSection title="Publishing">
								<SidebarField
									form={FORM_ID}
									id="published_at"
									name="published_at"
									label="Publish on"
									type="date"
									value={values.published_at}
									description="A later date schedules it; empty publishes on save."
								/>
								<SidebarField
									form={FORM_ID}
									id="slug"
									name="slug"
									label="Slug"
									value={values.slug}
									required
									readOnly={editing}
									description={editing ? "Fixed once saved, so links keep working." : undefined}
								/>
								{publicHref && editing ? (
									<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
										<span mix={[text("sm"), weight("medium")]}>Public URL</span>
										<Link href={publicHref} mix={[text("sm"), overflowWrap("anywhere")]}>
											{publicHref}
										</Link>
									</div>
								) : null}
								<SidebarField
									form={FORM_ID}
									id="tags"
									name="tags"
									label="Tags"
									value={values.tags}
									placeholder="remix, typescript"
									description="Separate tags with commas."
								/>
							</SidebarSection>
							<SidebarSection title="Sharing">
								<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
									<label htmlFor="teaser" mix={[text("sm"), weight("medium")]}>
										Teaser for X
									</label>
									<TeaserField
										id="teaser"
										titleId="title"
										form={FORM_ID}
										kind="tutorial"
										title={values.title}
										teaser={values.teaser}
										error={teaserError ?? ""}
									/>
								</div>
								{shareHref ? (
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
								) : null}
							</SidebarSection>
							{deleteAction && editing ? (
								<div mix={[hstack({ gap: 2 })]}>
									<DeleteAction
										id="tutorial"
										name={values.title}
										noun="tutorial"
										action={deleteAction}
										prominent
									/>
								</div>
							) : null}
						</div>
					}
					labels={{
						settings: "Tutorial settings",
						closeSettings: "Close settings",
						sidebar: "Tutorial settings",
					}}
					mix={[raw({ margin: "calc(-1 * var(--ui-app-gutter, 1rem))", inlineSize: "auto" })]}
				>
					<WritingColumn
						form={FORM_ID}
						action={action}
						editing={editing}
						title={{
							name: "title",
							value: values.title,
							placeholder: "Give this tutorial a title",
						}}
						summary={{
							name: "excerpt",
							label: "Excerpt",
							value: values.excerpt,
							placeholder: "A line for the index and the feeds",
						}}
						body={{
							name: "content",
							label: "Content",
							value: values.content,
							placeholder: "Write the steps in Markdown…",
						}}
						saveLabel={saveLabel}
					/>
				</EditorLayout>
			</CMSLayout>
		);
	};
}
