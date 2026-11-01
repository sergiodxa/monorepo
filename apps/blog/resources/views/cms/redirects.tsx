/**
 * Views for managing redirect rules in the CMS. `CMSRedirectsIndexView` lists every rule as
 * from → to with its status code, under code tabs and a search over both paths, each with a
 * confirmed delete; `CMSRedirectsNewView` is the form that creates one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { font, text, truncate } from "@sdxc/u/typography";
import { Badge, Input, LinkButton, Select } from "@sdxc/ui";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { SettingsSection } from "@sdxc/ui/app/settings-section";
import { Table } from "@sdxc/ui/app/table";

import { CMSLayout } from "~/resources/layouts/cms";
import {
	DeleteAction,
	FILTER_LABELS,
	ListEmpty,
	matchesSearch,
	PAGINATION_LABELS,
	pageOf,
	readListQuery,
	statusTab,
} from "~/resources/views/cms/list";
import routes from "~/routes/web";

/**
 * Types used by the redirects index view.
 */
export namespace CMSRedirectsIndexView {
	/**
	 * Redirect row displayed in the redirects table.
	 */
	export interface Item {
		from: string;
		to: string;
		status: number;
		deleteAction: string;
	}

	/**
	 * Data required to render the redirects index state.
	 */
	export interface Props {
		items: Array<Item>;
	}
}

/**
 * Types used by the create-redirect view.
 */
export namespace CMSRedirectsNewView {
	/**
	 * Heading and form target for the new redirect page.
	 */
	export interface Props {
		title: string;
		description: string;
		action: string;
	}
}

/** The filter bar's id, whose search field `/` focuses. */
const FILTER_ID = "redirects-filters";

/** Every status code a redirect can answer with, and the word that says what it means. */
const STATUS_CODES: Array<{ code: number; label: string }> = [
	{ code: 301, label: "Permanent" },
	{ code: 302, label: "Temporary" },
	{ code: 307, label: "Temporary, method kept" },
	{ code: 308, label: "Permanent, method kept" },
];

/**
 * The meaning of a status code, or an empty string for a code the form never writes.
 *
 * @param code The redirect's HTTP status.
 */
function statusLabel(code: number): string {
	return STATUS_CODES.find((entry) => entry.code === code)?.label ?? "";
}

/**
 * Lists every redirect under code tabs and a search over both paths, kept in the address so a
 * filtered list is a link. Each row deletes its rule after a confirmation naming the path.
 */
export function CMSRedirectsIndexView() {
	return ({ model, assets }: { model: CMSRedirectsIndexView.Props; assets: DocumentAssets }) => {
		let query = readListQuery();
		let searched = model.items.filter((item) => matchesSearch(query.q, item.from, item.to));
		let withCode = (code: string) =>
			searched.filter((item) => code === "all" || String(item.status) === code);
		let page = pageOf(withCode(query.status), query);
		let newRedirect = (
			<LinkButton href={routes.cms.redirects.new.href()} color="brand" size="sm">
				New redirect
			</LinkButton>
		);

		return (
			<CMSLayout assets={assets} title="Redirects" activePath={routes.cms.redirects.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Redirects"
						description="Old paths and the addresses they now send readers to."
						primaryAction={newRedirect}
					/>
					<FilterBar
						id={FILTER_ID}
						url={query.url}
						tabs={[
							statusTab(query, "all", "All", withCode("all").length),
							...STATUS_CODES.map(({ code }) =>
								statusTab(query, String(code), String(code), withCode(String(code)).length),
							),
						]}
						search={{ label: "Search redirects", placeholder: "Search by path…" }}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 ? (
						<ListEmpty
							query={query}
							noun="redirects"
							firstRun={model.items.length === 0}
							action={newRedirect}
						/>
					) : (
						<>
							<div id="redirects-table">
								<Table.Container>
									<Table aria-label="Redirects" density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>From</Table.Column>
												<Table.Column>To</Table.Column>
												<Table.Column>Status</Table.Column>
												<Table.ActionsColumn label="Actions" />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{page.rows.map((item) => (
												<Table.Row key={item.from}>
													<Table.Cell mix={[raw({ maxInlineSize: "min(24rem, 35cqi)" })]}>
														<span mix={[font("mono"), text("sm"), truncate()]} title={item.from}>
															{item.from}
														</span>
													</Table.Cell>
													<Table.Cell mix={[raw({ maxInlineSize: "min(28rem, 35cqi)" })]}>
														<span
															mix={[font("mono"), text("sm"), fg("neutral.muted"), truncate()]}
															title={item.to}
														>
															{item.to}
														</span>
													</Table.Cell>
													<Table.Cell>
														<span mix={[hstack({ gap: 2, align: "center" })]}>
															<Badge color="neutral" variant="secondary">
																{String(item.status)}
															</Badge>
															<span
																mix={[
																	text("sm"),
																	fg("neutral.muted"),
																	raw({
																		"@container ui-app-content (max-width: 40rem)": {
																			display: "none",
																		},
																	}),
																]}
															>
																{statusLabel(item.status)}
															</span>
														</span>
													</Table.Cell>
													<Table.Actions>
														<LinkButton
															href={item.from}
															target="_blank"
															rel="noopener"
															variant="ghost"
															color="neutral"
															size="sm"
														>
															Try redirect
														</LinkButton>
														<DeleteAction
															id={`redirect-${encodeURIComponent(item.from)}`}
															name={item.from}
															noun="redirect"
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
								target="redirects-table"
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
 * The form that creates a redirect: the path readers arrive at, where they are sent, and the
 * status code that tells browsers and crawlers whether the move is permanent.
 */
export function CMSRedirectsNewView() {
	return ({ model, assets }: { model: CMSRedirectsNewView.Props; assets: DocumentAssets }) => {
		let { title, description, action } = model;

		return (
			<CMSLayout assets={assets} title={title} activePath={routes.cms.redirects.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title={title}
						description={description}
						crumbs={[
							{ label: "Redirects", href: routes.cms.redirects.index.href() },
							{ label: title },
						]}
						crumbsLabel="Breadcrumb"
					/>
					<SettingsSection
						title="Redirect"
						description="A request for the old path answers with the status code and the new address."
						form={{ action }}
						labels={{ save: "Create redirect" }}
					>
						<SettingsSection.Row
							label="From"
							description="The old path on this site, such as /old-post."
							htmlFor="redirect-from"
						>
							<Input id="redirect-from" name="from" required />
						</SettingsSection.Row>
						<SettingsSection.Row
							label="To"
							description="A path on this site or a full URL."
							htmlFor="redirect-to"
						>
							<Input id="redirect-to" name="to" required />
						</SettingsSection.Row>
						<SettingsSection.Row label="Status" htmlFor="redirect-status">
							<Select id="redirect-status" name="status">
								{STATUS_CODES.map(({ code, label }) => (
									<Select.Option key={code} value={String(code)} selected={code === 302}>
										{`${String(code)} ${label}`}
									</Select.Option>
								))}
							</Select>
						</SettingsSection.Row>
					</SettingsSection>
				</div>
			</CMSLayout>
		);
	};
}
