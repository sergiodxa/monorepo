/**
 * Views for managing bookmarks in the CMS: the list, whose "Needs review" tab is the queue of
 * pages the weekly check found moved or gone, the create/edit form page, and the quick add,
 * which the dashboard shows too so a URL can be saved from the first page of the CMS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle } from "remix/component";

import { ExternalLinkIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Alert, Button, Form, Input, Label, Link, LinkButton, TextArea } from "@sdxc/ui";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { SettingsSection } from "@sdxc/ui/app/settings-section";
import { Table } from "@sdxc/ui/app/table";

import { CMSLayout } from "~/resources/layouts/cms";
import { DateCell } from "~/resources/views/cms/cells";
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
 * Types used to render the CMS bookmarks list page.
 */
export namespace CMSBookmarksIndexView {
	/** What the latest read of a bookmarked page came to, `null` while it was never read. */
	export type Status = "ok" | "moved" | "gone" | "blocked" | "flaky" | null;

	/**
	 * Single bookmark row displayed in the index table.
	 */
	export interface Item {
		id: string;
		title: string;
		url: string;
		href: string;
		deleteAction: string;
		/** When it was saved, as an ISO string. */
		savedAt: string;
		status: Status;
		/** The status code the latest read answered, when it got one. */
		httpStatus: number | null;
		/** Where a moved page now lives, when the read followed it. */
		finalUrl: string | null;
		/** The open flag the weekly check raised, until a save reviews it. */
		flag?: "moved" | "gone";
	}

	/**
	 * Data required by the bookmarks index view.
	 */
	export interface Props {
		items: Array<Item>;
	}
}

/**
 * Normalizes a bookmark URL to a link-safe href.
 *
 * @param rawHref User-provided URL text.
 * @returns Absolute or root-relative href for rendering.
 */
function normalizeBookmarkHref(rawHref: string) {
	if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
		return rawHref;
	}

	if (rawHref.startsWith("/")) {
		return rawHref;
	}

	return `https://${rawHref}`;
}

/**
 * Types used by the bookmark create/edit form view.
 */
export namespace CMSBookmarksActionView {
	/**
	 * Form field values used to prefill bookmark inputs; an empty title or description is
	 * read from the page when the form is saved.
	 */
	export interface FormValues {
		title: string;
		url: string;
		description: string;
	}

	/** The latest read of the bookmarked page, as the edit page reports it. */
	export interface Check {
		status: "ok" | "moved" | "gone" | "blocked" | "flaky";
		httpStatus: number | null;
		/** When the page was read, already formatted for reading. */
		checkedOn: string;
		finalUrl: string | null;
		/** Whether the read raised a flag that no save has reviewed yet. */
		open: boolean;
		/** The edit page with the moved page's new address filled in. */
		useFinalHref?: string;
	}

	/** Another bookmark already holding the URL the form tried to save. */
	export interface Conflict {
		label: string;
		href: string;
	}

	/**
	 * Content and actions required by the bookmark form page.
	 */
	export interface Props {
		title: string;
		description: string;
		mode: "new" | "edit";
		action: string;
		submitLabel: string;
		deleteAction?: string;
		values: FormValues;
		/** Shown above the form, such as why a save landed on an existing bookmark. */
		notice?: string;
		/** Set when a save was refused because another bookmark holds the URL. */
		conflict?: Conflict;
		/** The latest read of the page, absent until it was read. */
		check?: Check | undefined;
	}
}

/** The filter bar's id, whose search field `/` focuses. */
const FILTER_ID = "bookmarks-filters";

/** The status param of the review queue, which the dashboard links to. */
const REVIEW = "review";

/**
 * Saves a bookmark from a URL alone: the title and description are read from the page,
 * and a URL already saved opens the existing bookmark instead.
 */
export function QuickBookmarkForm() {
	return () => (
		<Form method="post" action={routes.cms.bookmarks.index.href()}>
			<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
				<Label htmlFor="quick-bookmark-url">Quick add</Label>
				<div mix={[hstack({ gap: 2, align: "center" }), flexWrap("wrap")]}>
					<Input
						id="quick-bookmark-url"
						name="url"
						type="text"
						inputMode="url"
						autoComplete="off"
						placeholder="https://"
						required
						mix={[raw({ flex: "1 1 16rem", minInlineSize: "0" })]}
					/>
					<Button type="submit" color="brand" size="sm">
						Add bookmark
					</Button>
				</div>
			</div>
		</Form>
	);
}

/** Hides a secondary column when the content pane is narrow. */
function secondary() {
	return raw({ "@container ui-app-content (max-width: 40rem)": { display: "none" } });
}

/** The status cell's tone and word for a row: an open flag first, then the latest read. */
function statusOf(item: CMSBookmarksIndexView.Item) {
	if (item.flag === "gone") return { color: "danger" as const, label: "Gone" };
	if (item.flag === "moved") return { color: "warning" as const, label: "Moved" };
	if (item.status === "ok") return { color: "success" as const, label: "OK" };
	if (item.status === "moved" || item.status === "gone") {
		return { color: "neutral" as const, label: "Reviewed" };
	}
	if (item.status === "blocked") return { color: "neutral" as const, label: "Blocked" };
	if (item.status === "flaky") return { color: "neutral" as const, label: "No answer" };
	return { color: "neutral" as const, label: "Not checked" };
}

/** A row's state with the status code the page answered, muted after it when known. */
function BookmarkStatusCell(handle: Handle<{ item: CMSBookmarksIndexView.Item }>) {
	return () => {
		let { item } = handle.props;
		let status = statusOf(item);
		return (
			<Table.StatusCell color={status.color}>
				{status.label}
				{item.httpStatus === null ? null : (
					<span mix={[fg("neutral.muted"), raw({ fontVariantNumeric: "tabular-nums" })]}>
						{" "}
						· {String(item.httpStatus)}
					</span>
				)}
			</Table.StatusCell>
		);
	};
}

/**
 * Lists every bookmark, newest first, under two tabs: All, and the review queue of bookmarks
 * whose moved or gone flag awaits a save. A moved row names where the page went.
 */
export function CMSBookmarksIndexView() {
	return ({ model, assets }: { model: CMSBookmarksIndexView.Props; assets: DocumentAssets }) => {
		let query = readListQuery();
		let searched = model.items.filter((item) => matchesSearch(query.q, item.title, item.url));
		let inStatus = (status: string) =>
			searched.filter((item) => status !== REVIEW || item.flag !== undefined);
		let sorted = sortRows(inStatus(query.status), query.sort, {
			title: (item) => item.title,
			date: (item) => item.savedAt,
		});
		let page = pageOf(sorted, query);
		let newBookmark = (
			<LinkButton href={routes.cms.bookmarks.new.href()} color="brand" size="sm">
				New bookmark
			</LinkButton>
		);

		return (
			<CMSLayout assets={assets} title="Bookmarks" activePath={routes.cms.bookmarks.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Bookmarks"
						description="Pages worth keeping, checked every week for moves and dead links."
						primaryAction={newBookmark}
					/>
					<QuickBookmarkForm />
					<FilterBar
						id={FILTER_ID}
						url={query.url}
						tabs={[
							statusTab(query, "all", "All", inStatus("all").length),
							statusTab(query, REVIEW, "Needs review", inStatus(REVIEW).length),
						]}
						search={{ label: "Search bookmarks", placeholder: "Search by title or URL…" }}
						sort={SORT_OPTIONS}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 ? (
						<ListEmpty
							query={query}
							noun="bookmarks"
							firstRun={model.items.length === 0}
							action={newBookmark}
						/>
					) : (
						<>
							<div id="bookmarks-table">
								<Table.Container>
									<ListKeys filterBar={FILTER_ID} />
									<Table aria-label="Bookmarks" density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>Title</Table.Column>
												<Table.Column>Check</Table.Column>
												<Table.Column mix={[secondary()]}>Saved</Table.Column>
												<Table.ActionsColumn label="Actions" />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{page.rows.map((item) => {
												let href = normalizeBookmarkHref(item.url);
												return (
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
																	{href}
																</span>
																{item.flag === "moved" && item.finalUrl ? (
																	<span mix={[text("xs"), fg("warning"), truncate()]}>
																		Now at {item.finalUrl}
																	</span>
																) : null}
															</span>
														</Table.Cell>
														<BookmarkStatusCell item={item} />
														<DateCell date={item.savedAt} hideNarrow />
														<Table.Actions>
															<LinkButton
																href={item.href}
																variant="ghost"
																color="neutral"
																size="sm"
															>
																{item.flag ? "Review" : "Edit"}
															</LinkButton>
															<LinkButton
																href={href}
																target="_blank"
																rel="noopener"
																variant="ghost"
																color="neutral"
																size="sm"
															>
																Visit
															</LinkButton>
															<DeleteAction
																id={`bookmark-${item.id}`}
																name={item.title}
																noun="bookmark"
																action={item.deleteAction}
															/>
														</Table.Actions>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table>
								</Table.Container>
							</div>
							<SelectionBar
								target="bookmarks-table"
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

/** How each outcome reads on the edit page. */
const CHECK_SUMMARIES: Record<CMSBookmarksActionView.Check["status"], string> = {
	ok: "The page answered",
	moved: "The page redirects elsewhere",
	gone: "The page is gone",
	blocked: "The site refused the check, so it could not tell",
	flaky: "The site did not answer, so it could not tell",
};

/**
 * What the latest read of the page found. An open flag reads as an alert, with what saving
 * the form does about it, and a moved page offers its new address for the form.
 */
function CheckReport(handle: Handle<{ check: CMSBookmarksActionView.Check }>) {
	return () => {
		let { check } = handle.props;
		let status = check.httpStatus === null ? "" : ` (${String(check.httpStatus)})`;
		let color = iife(() => {
			if (!check.open) return "neutral" as const;
			if (check.status === "gone") return "danger" as const;
			return "warning" as const;
		});

		return (
			<Alert color={color} role={check.open ? "alert" : "status"}>
				<Alert.Content>
					<Alert.Description>
						{CHECK_SUMMARIES[check.status]}
						{status} when checked on {check.checkedOn}.
						{check.open ? " Saving this bookmark marks it reviewed." : null}
					</Alert.Description>
					{check.status === "moved" && check.finalUrl ? (
						<Alert.Description mix={[truncate()]}>
							Now at <Link href={check.finalUrl}>{check.finalUrl}</Link>
						</Alert.Description>
					) : null}
				</Alert.Content>
				{check.useFinalHref ? (
					<Alert.Action>
						<LinkButton href={check.useFinalHref} color="neutral" variant="outline" size="sm">
							Use the new address
						</LinkButton>
					</Alert.Action>
				) : null}
			</Alert>
		);
	};
}

/**
 * The page that creates or edits a bookmark: a header with Visit and Delete, what the latest
 * read found, then one card of fields. Delete's confirm sits in the header, outside the
 * card's form, since forms cannot nest.
 */
export function CMSBookmarksActionView() {
	return ({ model, assets }: { model: CMSBookmarksActionView.Props; assets: DocumentAssets }) => {
		let { action, check, conflict, deleteAction, description, mode, notice, submitLabel, values } =
			model;
		let editing = mode === "edit";

		return (
			<CMSLayout assets={assets} title={model.title} activePath={routes.cms.bookmarks.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						crumbs={[
							{ label: "Bookmarks", href: routes.cms.bookmarks.index.href() },
							{ label: model.title },
						]}
						crumbsLabel="Breadcrumb"
						title={model.title}
						description={description}
						actions={
							<>
								{editing && values.url ? (
									<LinkButton
										href={normalizeBookmarkHref(values.url)}
										target="_blank"
										rel="noopener"
										variant="outline"
										color="neutral"
										size="sm"
									>
										<ExternalLinkIcon size={16} aria-hidden="true" />
										Visit
									</LinkButton>
								) : null}
								{deleteAction ? (
									<DeleteAction
										id="bookmark"
										name={values.title || values.url}
										noun="bookmark"
										action={deleteAction}
										prominent
									/>
								) : null}
							</>
						}
					/>

					{notice ? (
						<Alert color="warning" role="status">
							<Alert.Content>
								<Alert.Description>{notice}</Alert.Description>
							</Alert.Content>
						</Alert>
					) : null}

					{check ? <CheckReport check={check} /> : null}

					{conflict ? (
						<Alert color="danger">
							<Alert.Content>
								<Alert.Description mix={[weight("medium")]}>
									This URL is already bookmarked as{" "}
									<Link href={conflict.href}>{conflict.label}</Link>. Open that bookmark or use
									another URL.
								</Alert.Description>
							</Alert.Content>
						</Alert>
					) : null}

					<SettingsSection
						title="Bookmark"
						description="A title or description left empty is read from the page when you save."
						form={{
							action,
							fields: editing ? <input type="hidden" name="_method" value="PUT" /> : undefined,
						}}
						labels={{ save: submitLabel }}
					>
						<SettingsSection.Row label="URL" htmlFor="bookmark-url">
							<Input
								id="bookmark-url"
								name="url"
								type="text"
								inputMode="url"
								autoComplete="off"
								defaultValue={values.url}
								required
							/>
						</SettingsSection.Row>
						<SettingsSection.Row label="Title" htmlFor="bookmark-title">
							<Input
								id="bookmark-title"
								name="title"
								defaultValue={values.title}
								placeholder="Read from the page"
							/>
						</SettingsSection.Row>
						<SettingsSection.Row
							layout="stacked"
							label="Description"
							htmlFor="bookmark-description"
						>
							<TextArea
								id="bookmark-description"
								name="description"
								rows={3}
								defaultValue={values.description}
								placeholder="Read from the page"
							/>
						</SettingsSection.Row>
					</SettingsSection>
				</div>
			</CMSLayout>
		);
	};
}
