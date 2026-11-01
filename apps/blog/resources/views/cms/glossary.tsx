/**
 * Views for managing glossary terms in the CMS. `CMSGlossaryIndexView` lists every term with
 * its anchor on the public glossary and the start of its definition, and
 * `CMSGlossaryActionView` is the plain form page that creates or edits one.
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
import { Input, LinkButton, TextArea } from "@sdxc/ui";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { SettingsSection } from "@sdxc/ui/app/settings-section";
import { Table } from "@sdxc/ui/app/table";

import { CMSLayout } from "~/resources/layouts/cms";
import { TextCell } from "~/resources/views/cms/cells";
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
} from "~/resources/views/cms/list";
import routes from "~/routes/web";

/**
 * Type contracts for the glossary index screen.
 */
export namespace CMSGlossaryIndexView {
	/**
	 * One glossary entry shown in the index table.
	 */
	export interface Item {
		id: string;
		term: string;
		slug: string;
		/** The Markdown definition, which the row shows the start of. */
		definition: string;
		/** When the term was added, as an ISO string. */
		createdAt: string;
		href: string;
		/** The term's anchor on the public glossary page. */
		publicHref: string;
		deleteAction: string;
	}

	/**
	 * Data required to render the glossary index screen.
	 */
	export interface Props {
		items: Array<Item>;
	}
}

/**
 * Type contracts for the glossary create and edit screen.
 */
export namespace CMSGlossaryActionView {
	/**
	 * Editable glossary field values bound to the form inputs.
	 */
	export interface FormValues {
		term: string;
		title: string;
		slug: string;
		definition: string;
	}

	/**
	 * Data required to render the glossary create or edit form.
	 */
	export interface Props {
		title: string;
		description: string;
		mode: "new" | "edit";
		action: string;
		submitLabel: string;
		deleteAction?: string;
		/** The term's anchor on the public glossary page, once it is saved. */
		publicHref?: string;
		values: FormValues;
	}
}

/** The filter bar's id, whose search field `/` focuses. */
const FILTER_ID = "glossary-filters";

/** Hides a secondary column when the content pane is narrow. */
function secondary() {
	return raw({ "@container ui-app-content (max-width: 40rem)": { display: "none" } });
}

/**
 * Lists every term, newest first; the search reads the term, slug and definition, and lives in
 * the address with the sort, so a filtered list is a link.
 */
export function CMSGlossaryIndexView() {
	return ({ model, assets }: { model: CMSGlossaryIndexView.Props; assets: DocumentAssets }) => {
		let query = readListQuery();
		let searched = model.items.filter((item) =>
			matchesSearch(query.q, item.term, item.slug, item.definition),
		);
		let sorted = sortRows(searched, query.sort, {
			title: (item) => item.term,
			date: (item) => item.createdAt,
		});
		let page = pageOf(sorted, query);
		let newTerm = (
			<LinkButton href={routes.cms.glossary.new.href()} color="brand" size="sm">
				New term
			</LinkButton>
		);

		return (
			<CMSLayout assets={assets} title="Glossary" activePath={routes.cms.glossary.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Glossary"
						description="Terms the posts use, each with an anchor on the public glossary."
						primaryAction={newTerm}
					/>
					<FilterBar
						id={FILTER_ID}
						url={query.url}
						search={{ label: "Search terms", placeholder: "Search by term or definition…" }}
						sort={SORT_OPTIONS}
						locale="en-US"
						labels={FILTER_LABELS}
					/>
					{page.rows.length === 0 ? (
						<ListEmpty
							query={query}
							noun="terms"
							firstRun={model.items.length === 0}
							action={newTerm}
						/>
					) : (
						<>
							<div id="glossary-table">
								<Table.Container>
									<ListKeys filterBar={FILTER_ID} />
									<Table aria-label="Glossary" density="comfortable">
										<Table.Header>
											<Table.Row>
												<Table.Column>Term</Table.Column>
												<Table.Column mix={[secondary()]}>Definition</Table.Column>
												<Table.ActionsColumn label="Actions" />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{page.rows.map((item) => (
												<Table.Row key={item.id}>
													<Table.Cell mix={[raw({ maxInlineSize: "min(20rem, 40cqi)" })]}>
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
																{item.term}
															</Table.RowLink>
															<span
																mix={[text("xs"), font("mono"), fg("neutral.muted"), truncate()]}
															>
																#{item.slug}
															</span>
														</span>
													</Table.Cell>
													<TextCell
														value={item.definition}
														maxInlineSize="28rem"
														hideBelow="40rem"
													/>
													<Table.Actions>
														<LinkButton href={item.href} variant="ghost" color="neutral" size="sm">
															Edit
														</LinkButton>
														<LinkButton
															href={item.publicHref}
															variant="ghost"
															color="neutral"
															size="sm"
														>
															View
														</LinkButton>
														<DeleteAction
															id={`term-${item.id}`}
															name={item.term}
															noun="term"
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
								target="glossary-table"
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
 * The page that creates or edits a term: a header with View and Delete, then one card of
 * fields. The slug is fixed once saved, so the term's anchor keeps working; Delete's confirm
 * sits in the header, outside the card's form, since forms cannot nest.
 */
export function CMSGlossaryActionView() {
	return ({ model, assets }: { model: CMSGlossaryActionView.Props; assets: DocumentAssets }) => {
		let { action, deleteAction, description, mode, publicHref, submitLabel, title, values } = model;
		let editing = mode === "edit";

		return (
			<CMSLayout assets={assets} title={title} activePath={routes.cms.glossary.index.href()}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						crumbs={[
							{ label: "Glossary", href: routes.cms.glossary.index.href() },
							{ label: title },
						]}
						crumbsLabel="Breadcrumb"
						title={title}
						description={description}
						actions={
							<>
								{publicHref && editing ? (
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
								) : null}
								{deleteAction && editing ? (
									<DeleteAction
										id="term"
										name={values.term}
										noun="term"
										action={deleteAction}
										prominent
									/>
								) : null}
							</>
						}
					/>
					<SettingsSection
						title="Term"
						description="The term as posts use it, and the definition the glossary shows."
						form={{
							action,
							fields: editing ? <input type="hidden" name="_method" value="PUT" /> : undefined,
						}}
						labels={{ save: submitLabel }}
					>
						<SettingsSection.Row label="Term" htmlFor="glossary-term">
							<Input
								id="glossary-term"
								name="term"
								defaultValue={values.term}
								autoComplete="off"
								required
							/>
						</SettingsSection.Row>
						<SettingsSection.Row
							label="Title"
							description="A longer name, such as what an acronym stands for."
							htmlFor="glossary-title"
						>
							<Input
								id="glossary-title"
								name="title"
								defaultValue={values.title}
								autoComplete="off"
							/>
						</SettingsSection.Row>
						<SettingsSection.Row
							label="Slug"
							description={
								editing
									? "Fixed once saved, so links to the term keep working."
									: "The term's anchor on the glossary page."
							}
							htmlFor="glossary-slug"
						>
							<Input
								id="glossary-slug"
								name="slug"
								defaultValue={values.slug}
								autoComplete="off"
								required
								readOnly={editing}
							/>
						</SettingsSection.Row>
						<SettingsSection.Row
							layout="stacked"
							label="Definition"
							description="Markdown."
							htmlFor="glossary-definition"
						>
							<TextArea
								id="glossary-definition"
								name="definition"
								rows={8}
								required
								defaultValue={values.definition}
							/>
						</SettingsSection.Row>
					</SettingsSection>
				</div>
			</CMSLayout>
		);
	};
}
