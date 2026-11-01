/**
 * Views for managing articles in the CMS. `CMSArticlesIndexView` lists them under status tabs,
 * search and sort kept in the address, with row actions to edit, view, post on X or delete;
 * `CMSArticlesActionView` is the editor, a writing column beside the article's properties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { ExternalLinkIcon, Share2Icon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Button, LinkButton } from "@sdxc/ui";
import { EditorLayout } from "@sdxc/ui/app/editor-layout";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { Table } from "@sdxc/ui/app/table";

import { TeaserField } from "~/resources/components/teaser-field";
import { CMSLayout } from "~/resources/layouts/cms";
import { DateCell } from "~/resources/views/cms/cells";
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
 * Type contracts for the CMS articles list page.
 */
export namespace CMSArticlesIndexView {
	/**
	 * One article row rendered in the CMS list table.
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
		/** When it went or goes live; `null` for an article published on save. */
		publishedAt: string | null;
		href: string;
		deleteAction: string;
	}

	/**
	 * Data required to render the CMS articles list view.
	 */
	export interface Props {
		items: Array<Item>;
	}
}

/**
 * Type contracts for the CMS article create/edit form.
 */
export namespace CMSArticlesActionView {
	/**
	 * Form field values used by the article action screen.
	 */
	export interface FormValues {
		title: string;
		slug: string;
		locale: string;
		excerpt: string;
		/** One line written for X; blank lets the excerpt stand in. */
		teaser: string;
		canonical_url: string;
		content: string;
		published_at: string;
	}

	/**
	 * Data required to render the article action form.
	 */
	export interface Props {
		title: string;
		description: string;
		/** The saved post's public URL, linked after the description; absent until the post is saved. */
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
const FILTER_ID = "articles-filters";

/** The editor form's id, which the bar's buttons, ⌘S and the sidebar's fields submit with. */
const FORM_ID = "article-form";

/** The status tabs' values, in the order they show. */
type Status = "all" | "published" | "scheduled";

/**
 * Lists every article, scheduled ones included, newest first. The tabs count what the search
 * keeps, and a search or tab is in the address, so a filtered list is a link.
 */
export function CMSArticlesIndexView() {
	return ({ model, assets }: { model: CMSArticlesIndexView.Props; assets: DocumentAssets }) => {
		let query = readListQuery();
		let searched = model.items.filter((item) => matchesSearch(query.q, item.title, item.slug));
		let inStatus = (status: Status) =>
			searched.filter((item) => status === "all" || (status === "scheduled") === item.preview);
		let sorted = sortRows(inStatus(query.status as Status), query.sort, {
			title: (item) => item.title,
			date: (item) => item.publishedAt,
		});
		let page = pageOf(sorted, query);
		let newArticle = (
			<LinkButton href={routes.cms.articles.new.href()} color="brand" size="sm">
				New article
			</LinkButton>
		);

		return (
			<CMSLayout assets={assets} title="Articles" activePath={routes.cms.articles.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Articles"
						description="Long-form posts, live and scheduled."
						primaryAction={newArticle}
					/>
					<FilterBar
						id={FILTER_ID}
						url={query.url}
						tabs={[
							statusTab(query, "all", "All", inStatus("all").length),
							statusTab(query, "published", "Published", inStatus("published").length),
							statusTab(query, "scheduled", "Scheduled", inStatus("scheduled").length),
						]}
						search={{ label: "Search articles", placeholder: "Search by title or slug…" }}
						sort={SORT_OPTIONS}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 ? (
						<ListEmpty
							query={query}
							noun="articles"
							firstRun={model.items.length === 0}
							action={newArticle}
						/>
					) : (
						<>
							<div id="articles-table">
								<Table.Container>
									<ListKeys filterBar={FILTER_ID} />
									<Table aria-label="Articles" density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>Title</Table.Column>
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
													<Table.Cell mix={[raw({ maxInlineSize: "min(36rem, 60cqi)" })]}>
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
															id={`article-${item.id}`}
															name={item.title}
															noun="article"
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
								target="articles-table"
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
 * The article editor: the title, excerpt and Markdown body in the writing column, and the
 * publishing, sharing and delete controls in the sidebar, all saved by one form.
 */
export function CMSArticlesActionView() {
	return ({ model, assets }: { model: CMSArticlesActionView.Props; assets: DocumentAssets }) => {
		let { action, deleteAction, mode, publicHref, shareHref, teaserError, title, values } = model;
		let editing = mode === "edit";
		let scheduled = isScheduled(values.published_at);
		let saveLabel = editing ? "Save article" : "Create article";

		return (
			<CMSLayout assets={assets} title={title} activePath={routes.cms.articles.index.href()}>
				<EditorLayout
					form={FORM_ID}
					back={{ href: routes.cms.articles.index.href(), label: "Articles" }}
					title={values.title || "New article"}
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
								<SidebarField
									form={FORM_ID}
									id="locale"
									name="locale"
									label="Locale"
									value={values.locale}
									required
								/>
								<SidebarField
									form={FORM_ID}
									id="canonical_url"
									name="canonical_url"
									label="Canonical URL"
									type="url"
									value={values.canonical_url}
									placeholder="Where it was first published"
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
										kind="article"
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
										id="article"
										name={values.title}
										noun="article"
										action={deleteAction}
										prominent
									/>
								</div>
							) : null}
						</div>
					}
					labels={{
						settings: "Settings",
						closeSettings: "Close settings",
						sidebar: "Article settings",
					}}
					mix={[raw({ margin: "calc(-1 * var(--ui-app-gutter, 1rem))", inlineSize: "auto" })]}
				>
					<WritingColumn
						form={FORM_ID}
						action={action}
						editing={editing}
						title={{ name: "title", value: values.title, placeholder: "Give this article a title" }}
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
							placeholder: "Write in Markdown…",
						}}
						saveLabel={saveLabel}
					/>
				</EditorLayout>
			</CMSLayout>
		);
	};
}
