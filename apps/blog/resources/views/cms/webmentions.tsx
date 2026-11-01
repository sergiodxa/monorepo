/**
 * The CMS Webmention moderation queue: tabs for the pending, approved and rejected mentions
 * with their counts, a search, and per mention its author, kind, source, target post and
 * excerpt, with the decisions a moderator can take, including trusting or blocking its host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { lineClamp, text, truncate, weight } from "@sdxc/u/typography";
import { Badge, Button } from "@sdxc/ui";
import { setParamHref } from "@sdxc/ui/app";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { Table } from "@sdxc/ui/app/table";
import { HeadingScope } from "@sdxc/ui/heading-scope";

import { CMSLayout } from "~/resources/layouts/cms";
import { DateCell, PathCell } from "~/resources/views/cms/cells";
import {
	FILTER_LABELS,
	ListEmpty,
	ListKeys,
	matchesSearch,
	PAGINATION_LABELS,
	pageOf,
	readListQuery,
	sortRows,
} from "~/resources/views/cms/list";
import routes from "~/routes/web";

/** Types used by the moderation page. */
export namespace CMSWebmentionsView {
	/** A queue a moderator can look at. */
	export type Status = "pending" | "approved" | "rejected";

	/** How many mentions each queue holds. */
	export type Counts = Record<Status, number>;

	/** One mention as the moderation list shows it. */
	export interface Item {
		id: string;
		kind: string;
		source: string;
		sourceHost: string;
		target: string;
		authorName: string | null;
		/** The mention's content as plain text, so a moderator reads it without rendering it. */
		text: string | null;
		updatedAt: string;
		/** Where the decision form posts. */
		action: string;
	}

	/** Data required to render one queue. */
	export interface Model {
		status: Status;
		counts: Counts;
		items: Array<Item>;
	}
}

/** The filter bar's id, whose search field `/` focuses. */
const FILTER_ID = "webmentions-filters";

/** The queue tabs, in the order a moderator works through them. */
const QUEUES: Array<{ status: CMSWebmentionsView.Status; label: string }> = [
	{ status: "pending", label: "Pending" },
	{ status: "approved", label: "Approved" },
	{ status: "rejected", label: "Rejected" },
];

/** The queue's order: most recently changed first, or oldest first to work through a backlog. */
const SORT = {
	label: "Sort by",
	defaultValue: "",
	options: [
		{ value: "", label: "Newest first" },
		{ value: "date", label: "Oldest first" },
	],
};

/**
 * The decisions offered in each queue: a pending mention can take any, an approved one
 * can be withdrawn, and a rejected one can be approved after all. Blocking a domain is
 * destructive, so it is always last.
 */
const DECISIONS: Record<
	CMSWebmentionsView.Status,
	Array<{ value: string; label: string; danger?: boolean }>
> = {
	pending: [
		{ value: "approve", label: "Approve" },
		{ value: "reject", label: "Reject" },
		{ value: "allow", label: "Approve and trust domain" },
		{ value: "block", label: "Block domain", danger: true },
	],
	approved: [
		{ value: "reject", label: "Reject" },
		{ value: "block", label: "Block domain", danger: true },
	],
	rejected: [
		{ value: "approve", label: "Approve" },
		{ value: "block", label: "Block domain", danger: true },
	],
};

/**
 * The decisions about one mention, shown as buttons in its row. The domain-wide ones follow in
 * the row's actions, revealed on hover, since they reach every mention from that site.
 */
const MENTION_DECISIONS = new Set(["approve", "reject"]);

/** What an empty queue says when no search is applied, by the queue it is. */
const EMPTY_QUEUES: Record<
	Exclude<CMSWebmentionsView.Status, "pending">,
	{ title: string; description: string }
> = {
	approved: {
		title: "No approved mentions",
		description: "Mentions you approve show on their posts and are listed here.",
	},
	rejected: {
		title: "No rejected mentions",
		description: "Mentions you reject stay off the site and are listed here.",
	},
};

/**
 * The path of the post a mention targets, the part a moderator recognises; an unparsable
 * target reads as written.
 *
 * @param target The mention's target URL.
 */
function postPath(target: string): string {
	try {
		return new URL(target).pathname;
	} catch {
		return target;
	}
}

/** Props accepted by {@link QueueEmpty}. */
interface QueueEmptyProps {
	status: CMSWebmentionsView.Status;
}

/**
 * An empty queue with no search applied: the pending one is all caught up, and the approved
 * and rejected ones say what lands in them.
 */
function QueueEmpty(handle: Handle<QueueEmptyProps>) {
	return () => {
		let { status } = handle.props;
		if (status === "pending") {
			return (
				<Table.Empty>
					<HeadingScope level={2}>
						<Empty kind="cleared" size="compact">
							<Empty.Title>All caught up</Empty.Title>
							<Empty.Description>No mentions are waiting for review.</Empty.Description>
						</Empty>
					</HeadingScope>
				</Table.Empty>
			);
		}
		let copy = EMPTY_QUEUES[status];
		return (
			<Table.Empty>
				<HeadingScope level={2}>
					<Empty size="compact">
						<Empty.Title>{copy.title}</Empty.Title>
						<Empty.Description>{copy.description}</Empty.Description>
					</Empty>
				</HeadingScope>
			</Table.Empty>
		);
	};
}

/**
 * Builds the moderation page for one queue. Each row's decisions submit one hidden form,
 * posting `_method=PUT` with the queue it came from, so the moderator lands back on it.
 */
export function CMSWebmentionsView() {
	return ({ model, assets }: { model: CMSWebmentionsView.Model; assets: DocumentAssets }) => {
		let query = readListQuery();
		let searched = model.items.filter((item) =>
			matchesSearch(query.q, item.authorName, item.sourceHost, item.source, item.target, item.text),
		);
		let sorted = sortRows(searched, query.sort, {
			title: (item) => item.authorName ?? item.sourceHost,
			date: (item) => item.updatedAt,
		});
		let page = pageOf(sorted, query);

		return (
			<CMSLayout
				assets={assets}
				title="Webmentions"
				activePath={routes.cms.webmentions.index.href()}
			>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Webmentions"
						description="Replies, likes and links from other sites, waiting for your decision."
					/>
					<FilterBar
						id={FILTER_ID}
						url={query.url}
						tabs={QUEUES.map((queue) => ({
							label: queue.label,
							count: model.counts[queue.status],
							href: setParamHref(query.url, "status", queue.status),
							current: model.status === queue.status,
						}))}
						search={{ label: "Search mentions", placeholder: "Search by author, site or text…" }}
						sort={SORT}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 && query.q === "" ? <QueueEmpty status={model.status} /> : null}
					{page.rows.length === 0 && query.q !== "" ? (
						<ListEmpty query={query} noun="mentions" firstRun={false} />
					) : null}
					{page.rows.length > 0 ? (
						<>
							<div id="webmentions-table">
								<Table.Container>
									<ListKeys filterBar={FILTER_ID} />
									<Table aria-label="Webmentions" density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>Mention</Table.Column>
												<Table.Column
													mix={[
														raw({
															"@container ui-app-content (max-width: 40rem)": { display: "none" },
														}),
													]}
												>
													Kind
												</Table.Column>
												<Table.Column
													mix={[
														raw({
															"@container ui-app-content (max-width: 40rem)": { display: "none" },
														}),
													]}
												>
													Post
												</Table.Column>
												<Table.Column
													mix={[
														raw({
															"@container ui-app-content (max-width: 40rem)": { display: "none" },
														}),
													]}
												>
													Date
												</Table.Column>
												<Table.Column>Decision</Table.Column>
												<Table.ActionsColumn label="More decisions" />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{page.rows.map((item) => {
												let formId = `webmention-${item.id}`;
												return (
													<Table.Row key={item.id}>
														<Table.Cell mix={[raw({ maxInlineSize: "min(36rem, 55cqi)" })]}>
															<form id={formId} method="post" action={item.action} hidden>
																<input type="hidden" name="_method" value="PUT" />
																<input type="hidden" name="status" value={model.status} />
															</form>
															<span
																mix={[
																	vstack({ gap: 0.5, align: "stretch" }),
																	raw({ minInlineSize: "0" }),
																]}
															>
																<Table.RowLink
																	href={item.source}
																	target="_blank"
																	rel="noopener"
																	mix={[weight("semibold"), truncate()]}
																>
																	{item.authorName ?? item.sourceHost}
																</Table.RowLink>
																<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>
																	{item.source}
																</span>
																{item.text ? (
																	<span mix={[text("sm"), fg("neutral"), lineClamp(2)]}>
																		{item.text}
																	</span>
																) : null}
															</span>
														</Table.Cell>
														<Table.Cell
															mix={[
																raw({
																	"@container ui-app-content (max-width: 40rem)": {
																		display: "none",
																	},
																}),
															]}
														>
															<Badge color="neutral" variant="secondary">
																{item.kind}
															</Badge>
														</Table.Cell>
														<PathCell
															path={postPath(item.target)}
															href={item.target}
															maxInlineSize="16rem"
															hideNarrow
														/>
														<DateCell date={item.updatedAt} hideNarrow />
														<Table.Cell>
															<span mix={[hstack({ gap: 1, align: "center" })]}>
																{DECISIONS[model.status]
																	.filter((decision) => MENTION_DECISIONS.has(decision.value))
																	.map((decision, index) => (
																		<Button
																			key={decision.value}
																			type="submit"
																			form={formId}
																			name="decision"
																			value={decision.value}
																			size="sm"
																			variant={index === 0 ? "outline" : "ghost"}
																			color="neutral"
																		>
																			{decision.label}
																		</Button>
																	))}
															</span>
														</Table.Cell>
														<Table.Actions overflowLabel="More decisions">
															{DECISIONS[model.status]
																.filter((decision) => !MENTION_DECISIONS.has(decision.value))
																.map((decision) => (
																	<Table.Action
																		key={decision.value}
																		type="submit"
																		form={formId}
																		name="decision"
																		value={decision.value}
																		danger={decision.danger}
																	>
																		{decision.label}
																	</Table.Action>
																))}
														</Table.Actions>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table>
								</Table.Container>
							</div>
							<SelectionBar
								target="webmentions-table"
								pagination={page.pagination}
								locale="en-US"
								labels={PAGINATION_LABELS}
							/>
						</>
					) : null}
				</div>
			</CMSLayout>
		);
	};
}
