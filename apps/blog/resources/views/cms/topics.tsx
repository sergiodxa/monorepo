/**
 * Views for managing topics in the CMS: `CMSTopicsIndexView` lists every topic, the kinds' and
 * the author's under their own tabs, with its public address and query, and `CMSTopicFormView`
 * is the form page, showing a kind's slug and query read-only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { ExternalLinkIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { font, text, truncate, weight } from "@sdxc/u/typography";
import { Alert, Input, LinkButton, TextArea } from "@sdxc/ui";
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

/** Type contracts for the topic index screen. */
export namespace CMSTopicsIndexView {
	/** One topic in the index table. */
	export interface Item {
		id: string;
		title: string;
		/** The topic's public page. */
		path: string;
		query: string;
		/** A kind's topic, which has no delete action. */
		builtIn: boolean;
		/** When the topic was created, as an ISO string. */
		createdAt: string;
		href: string;
		deleteAction: string;
	}

	/** Data required to render the topic index screen. */
	export interface Props {
		items: Array<Item>;
	}
}

/** Type contracts for the topic create and edit screen. */
export namespace CMSTopicFormView {
	/** The editable fields, as the form shows them. */
	export interface Values {
		title: string;
		slug: string;
		query: string;
		description: string;
	}

	/** Data required to render the topic form. */
	export interface Props {
		title: string;
		action: string;
		mode: "new" | "edit";
		/** A kind's topic, whose slug and query show read-only. */
		builtIn: boolean;
		/** The topic's public page, linked while editing a saved topic. */
		path?: string;
		/** The destroy route of an author's saved topic; absent for a kind's or a new one. */
		deleteAction?: string;
		values: Values;
		/** Why the last save was refused, or `null`. */
		error: string | null;
	}
}

/** The filter bar's id, whose search field `/` focuses. */
const FILTER_ID = "topics-filters";

/** The tabs' status values: every topic, a kind's, or one the author saved. */
type Status = "all" | "kind" | "author";

/** Hides a secondary column when the content pane is narrow. */
function secondary() {
	return raw({ "@container ui-app-content (max-width: 40rem)": { display: "none" } });
}

/**
 * Lists every topic, the kinds' and the author's under their own tabs. Search reads the title,
 * address and query; a kind's topic offers no delete, since its page always exists.
 */
export function CMSTopicsIndexView() {
	return ({ model, assets }: { model: CMSTopicsIndexView.Props; assets: DocumentAssets }) => {
		let query = readListQuery();
		let searched = model.items.filter((item) =>
			matchesSearch(query.q, item.title, item.path, item.query),
		);
		let inStatus = (status: Status) =>
			searched.filter((item) => status === "all" || (status === "kind") === item.builtIn);
		let sorted = sortRows(inStatus(query.status as Status), query.sort, {
			title: (item) => item.title,
			date: (item) => item.createdAt,
		});
		let page = pageOf(sorted, query);
		let newTopic = (
			<LinkButton href={routes.cms.topics.new.href()} color="brand" size="sm">
				New topic
			</LinkButton>
		);

		return (
			<CMSLayout assets={assets} title="Topics" activePath={routes.cms.topics.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Topics"
						description="Saved searches, each listed on its own page with its feeds."
						primaryAction={newTopic}
					/>
					<FilterBar
						id={FILTER_ID}
						url={query.url}
						tabs={[
							statusTab(query, "all", "All", inStatus("all").length),
							statusTab(query, "kind", "Kinds", inStatus("kind").length),
							statusTab(query, "author", "Yours", inStatus("author").length),
						]}
						search={{ label: "Search topics", placeholder: "Search by title or query…" }}
						sort={SORT_OPTIONS}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 ? (
						<ListEmpty
							query={query}
							noun="topics"
							firstRun={model.items.length === 0}
							action={newTopic}
						/>
					) : (
						<>
							<div id="topics-table">
								<Table.Container>
									<ListKeys filterBar={FILTER_ID} />
									<Table aria-label="Topics" density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>Title</Table.Column>
												<Table.Column>Type</Table.Column>
												<Table.Column mix={[secondary()]}>Query</Table.Column>
												<Table.ActionsColumn label="Actions" />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{page.rows.map((item) => (
												<Table.Row key={item.id}>
													<Table.Cell mix={[raw({ maxInlineSize: "min(28rem, 45cqi)" })]}>
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
																{item.path}
															</span>
														</span>
													</Table.Cell>
													<Table.StatusCell color={item.builtIn ? "neutral" : "brand"}>
														{item.builtIn ? "Kind" : "Yours"}
													</Table.StatusCell>
													<Table.Cell
														mix={[
															secondary(),
															font("mono"),
															text("xs"),
															fg("neutral.muted"),
															truncate(),
															raw({ maxInlineSize: "20rem" }),
														]}
													>
														{item.query}
													</Table.Cell>
													<Table.Actions>
														<LinkButton href={item.href} variant="ghost" color="neutral" size="sm">
															Edit
														</LinkButton>
														<LinkButton href={item.path} variant="ghost" color="neutral" size="sm">
															View
														</LinkButton>
														{item.builtIn ? null : (
															<DeleteAction
																id={`topic-${item.id}`}
																name={item.title}
																noun="topic"
																action={item.deleteAction}
															/>
														)}
													</Table.Actions>
												</Table.Row>
											))}
										</Table.Body>
									</Table>
								</Table.Container>
							</div>
							<SelectionBar
								target="topics-table"
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
 * The topic form page. A kind's topic shows its slug and query read-only and unnamed, so the
 * browser submits only its title and description; a refused save shows why above the fields,
 * which keep what was typed.
 */
export function CMSTopicFormView() {
	return ({ model, assets }: { model: CMSTopicFormView.Props; assets: DocumentAssets }) => {
		let { values, builtIn } = model;
		let editing = model.mode === "edit";

		return (
			<CMSLayout assets={assets} title={model.title} activePath={routes.cms.topics.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						crumbs={[
							{ label: "Topics", href: routes.cms.topics.index.href() },
							{ label: model.title },
						]}
						crumbsLabel="Breadcrumb"
						title={model.title}
						description={
							model.path
								? `Listed at ${model.path}.`
								: "A saved search with its own page and feeds."
						}
						actions={
							<>
								{model.path ? (
									<LinkButton
										href={model.path}
										target="_blank"
										rel="noopener"
										variant="outline"
										color="neutral"
										size="sm"
									>
										<ExternalLinkIcon size={16} aria-hidden="true" />
										View
									</LinkButton>
								) : null}
								{model.deleteAction && !builtIn ? (
									<DeleteAction
										id="topic"
										name={values.title}
										noun="topic"
										action={model.deleteAction}
										prominent
									/>
								) : null}
							</>
						}
					/>
					{model.error ? (
						<Alert id="topic-error" color="danger">
							<Alert.Content>
								<Alert.Description>{model.error}</Alert.Description>
							</Alert.Content>
						</Alert>
					) : null}
					<SettingsSection
						title="Topic"
						description={
							builtIn
								? "A kind's topic keeps its address and query; its title and description are yours."
								: "The search the topic lists, and how its page introduces it."
						}
						form={{
							action: model.action,
							fields: editing ? <input type="hidden" name="_method" value="PUT" /> : undefined,
						}}
						labels={{ save: editing ? "Save topic" : "Create topic" }}
					>
						<SettingsSection.Row label="Title" htmlFor="topic-title">
							<Input
								id="topic-title"
								name="title"
								defaultValue={values.title}
								autoComplete="off"
								required
							/>
						</SettingsSection.Row>
						<SettingsSection.Row
							label="Slug"
							description={builtIn ? "Fixed for a kind." : "Derived from the title when blank."}
							htmlFor="topic-slug"
						>
							<Input
								id="topic-slug"
								name={builtIn ? undefined : "slug"}
								defaultValue={values.slug}
								autoComplete="off"
								placeholder="Derived from the title when blank"
								readOnly={builtIn}
								disabled={builtIn}
							/>
						</SettingsSection.Row>
						<SettingsSection.Row
							label="Query"
							description={builtIn ? "Fixed for a kind." : "The search the topic lists."}
							htmlFor="topic-query"
						>
							<Input
								id="topic-query"
								name={builtIn ? undefined : "query"}
								defaultValue={values.query}
								autoComplete="off"
								placeholder="tag:remix -kind:bookmark order:desc"
								required={!builtIn}
								readOnly={builtIn}
								disabled={builtIn}
								mix={[font("mono")]}
							/>
						</SettingsSection.Row>
						<SettingsSection.Row
							layout="stacked"
							label="Description"
							description="Markdown, shown under the title on the topic's page."
							htmlFor="topic-description"
						>
							<TextArea
								id="topic-description"
								name="description"
								rows={6}
								defaultValue={values.description}
							/>
						</SettingsSection.Row>
					</SettingsSection>
				</div>
			</CMSLayout>
		);
	};
}
