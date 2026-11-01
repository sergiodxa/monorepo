/**
 * Views for the weekly releases posts in the CMS. `CMSReleasesIndexView` lists them under
 * status tabs, search and sort kept in the address, with row actions to edit, view, post on X
 * or delete; `CMSReleasesEditView` edits a post's title and Markdown content.
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
import { StatusDot } from "@sdxc/ui/status-dot";

import { CMSLayout } from "~/resources/layouts/cms";
import { DateCell } from "~/resources/views/cms/cells";
import { SidebarSection, WritingColumn } from "~/resources/views/cms/editor";
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

/** Type contracts for the releases index screen. */
export namespace CMSReleasesIndexView {
	/** One releases post as a row of the index. */
	export interface Item {
		id: string;
		title: string;
		/** The ISO week the post covers, which is also its permalink's last segment. */
		slug: string;
		preview: boolean;
		/** When it went or goes live; `null` for a post published when written. */
		publishedAt: string | null;
		publicHref: string;
		/** The author's "Post on X" link, prefilled with the post's share text. */
		shareHref: string;
		href: string;
		deleteAction: string;
	}

	/** Data required to render the releases index. */
	export interface Props {
		items: Array<Item>;
	}
}

/** Type contracts for the releases edit screen. */
export namespace CMSReleasesEditView {
	/** Data required to render the edit form. */
	export interface Props {
		title: string;
		description: string;
		/** The ISO week the post covers, which names it, since every week shares a title. */
		slug: string;
		/** The post's public URL, linked in full in the sidebar. */
		publicHref: string;
		action: string;
		deleteAction: string;
		/** Whether its publish date is still ahead. */
		preview: boolean;
		/** The "Post on X" link of the saved post. */
		shareHref: string;
		values: { title: string; content: string };
	}
}

/** The filter bar's id, whose search field `/` focuses. */
const FILTER_ID = "releases-filters";

/** The editor form's id, which the bar's buttons, ⌘S and the sidebar's fields submit with. */
const FORM_ID = "release-form";

/** The status tabs' values, in the order they show. */
type Status = "all" | "published" | "scheduled";

/**
 * The sort menu: every post shares a title, so the list sorts by date alone, newest first by
 * default.
 */
const RELEASE_SORT = {
	...SORT_OPTIONS,
	options: SORT_OPTIONS.options.filter((option) => option.value !== "title"),
};

/**
 * Lists every releases post, newest first. The weekly job writes them, so the screen edits and
 * deletes but creates none; every post shares a title, so each row leads with its week.
 */
export function CMSReleasesIndexView() {
	return ({ model, assets }: { model: CMSReleasesIndexView.Props; assets: DocumentAssets }) => {
		let query = readListQuery();
		let searched = model.items.filter((item) => matchesSearch(query.q, item.title, item.slug));
		let inStatus = (status: Status) =>
			searched.filter((item) => status === "all" || (status === "scheduled") === item.preview);
		let sorted = sortRows(inStatus(query.status as Status), query.sort, {
			title: (item) => item.title,
			date: (item) => item.publishedAt ?? item.slug,
		});
		let page = pageOf(sorted, query);

		return (
			<CMSLayout assets={assets} title="Releases" activePath={routes.cms.releases.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Releases"
						description="Written every Friday from the week's GitHub releases."
					/>
					<FilterBar
						id={FILTER_ID}
						url={query.url}
						tabs={[
							statusTab(query, "all", "All", inStatus("all").length),
							statusTab(query, "published", "Published", inStatus("published").length),
							statusTab(query, "scheduled", "Scheduled", inStatus("scheduled").length),
						]}
						search={{ label: "Search releases", placeholder: "Search by week or title…" }}
						sort={RELEASE_SORT}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 ? (
						<ListEmpty query={query} noun="releases posts" firstRun={model.items.length === 0} />
					) : (
						<>
							<div id="releases-table">
								<Table.Container>
									<ListKeys filterBar={FILTER_ID} />
									<Table aria-label="Releases" density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>Week</Table.Column>
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
																{item.slug}
															</Table.RowLink>
															<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>
																{item.title}
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
															id={`release-${item.id}`}
															name={item.slug}
															noun="release"
															action={item.deleteAction}
															consequence="is removed from the site, and the weekly job won't write that week again."
														/>
													</Table.Actions>
												</Table.Row>
											))}
										</Table.Body>
									</Table>
								</Table.Container>
							</div>
							<SelectionBar
								target="releases-table"
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
 * The releases post editor: its title and Markdown list in the writing column, and its public
 * link, "Post on X" and delete in the sidebar. The slug and package list stay as the weekly job
 * wrote them; deleting a week keeps the job from writing it again.
 */
export function CMSReleasesEditView() {
	return ({ model, assets }: { model: CMSReleasesEditView.Props; assets: DocumentAssets }) => {
		let { action, deleteAction, preview, publicHref, shareHref, slug, title, values } = model;

		return (
			<CMSLayout assets={assets} title={title} activePath={routes.cms.releases.index.href()}>
				<EditorLayout
					form={FORM_ID}
					back={{ href: routes.cms.releases.index.href(), label: "Releases" }}
					title={slug}
					status={
						<StatusDot color={preview ? "warning" : "success"}>
							{preview ? "Scheduled" : "Published"}
						</StatusDot>
					}
					preview={
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
					}
					primary={
						<Button type="submit" form={FORM_ID} color="brand" size="sm">
							Save release
						</Button>
					}
					sidebar={
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<SidebarSection title="Publishing">
								<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
									<span mix={[text("sm"), weight("medium")]}>Public URL</span>
									<Link href={publicHref} mix={[text("sm"), overflowWrap("anywhere")]}>
										{publicHref}
									</Link>
								</div>
							</SidebarSection>
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
							<div mix={[hstack({ gap: 2 })]}>
								<DeleteAction
									id="release"
									name={slug}
									noun="release"
									action={deleteAction}
									consequence="is removed from the site, and the weekly job won't write that week again."
									prominent
								/>
							</div>
						</div>
					}
					labels={{
						settings: "Release settings",
						closeSettings: "Close settings",
						sidebar: "Release settings",
					}}
					mix={[raw({ margin: "calc(-1 * var(--ui-app-gutter, 1rem))", inlineSize: "auto" })]}
				>
					<WritingColumn
						form={FORM_ID}
						action={action}
						editing
						title={{ name: "title", value: values.title, placeholder: "Weekly releases" }}
						body={{
							name: "content",
							label: "Content",
							value: values.content,
							placeholder: "The week's releases in Markdown…",
						}}
						saveLabel="Save release"
					/>
				</EditorLayout>
			</CMSLayout>
		);
	};
}
