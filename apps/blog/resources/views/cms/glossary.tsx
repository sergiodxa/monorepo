/**
 * Views for managing glossary terms in the CMS. `CMSGlossaryIndexView` renders a
 * table of terms with their in-page slug anchors and edit plus modal-confirmed
 * delete actions, and `CMSGlossaryActionView` renders the create/edit form.
 * Exist to power the admin CRUD screens for glossary entries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@pkg/u/color";
import { flexWrap, gap, grid, hstack } from "@pkg/u/layout";
import { m, p } from "@pkg/u/size";
import {
	Button,
	Card,
	Form,
	Heading,
	Input,
	Label,
	LinkButton,
	Modal,
	Table,
	TextArea,
} from "@pkg/ui";

import { CMSLayout } from "~/resources/layouts/cms";
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
		href: string;
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
		values: FormValues;
	}
}

/**
 * Renders the CMS glossary index with table actions.
 */
export function CMSGlossaryIndexView() {
	return ({ model }: { model: CMSGlossaryIndexView.Props }) => {
		let { items } = model;

		return (
			<CMSLayout title="Glossary" activePath={routes.cms.glossary.index.href()}>
				<main mix={[grid(), gap(4)]}>
					<Card mix={[p(4)]}>
						<div mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}>
							<Heading level={2}>Glossary</Heading>
							<LinkButton href={routes.cms.glossary.new.href()} color="brand" size="sm">
								New Glossary
							</LinkButton>
						</div>
					</Card>
					<Card mix={[p(4)]}>
						{items.length === 0 ? (
							<p mix={[m(0), fg("neutral")]}>No glossary terms found in the database yet.</p>
						) : (
							<Table.Container>
								<Table aria-label="Glossary">
									<Table.Header>
										<Table.Row>
											<Table.Column>Term</Table.Column>
											<Table.Column>Slug</Table.Column>
											<Table.Column align="end">Actions</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{items.map((item, index) => {
											let dialogId = `delete-glossary-${String(index)}`;
											return (
												<Table.Row key={item.id}>
													<Table.Cell>{item.term}</Table.Cell>
													<Table.Cell mix={[fg("neutral")]}>
														<code>{`/glossary#${item.slug}`}</code>
													</Table.Cell>
													<Table.Cell>
														<div mix={[hstack({ gap: 1, align: "center", justify: "end" })]}>
															<LinkButton
																href={item.href}
																color="brand"
																variant="outline"
																size="sm"
															>
																Edit
															</LinkButton>
															<Button
																type="button"
																commandfor={dialogId}
																command="show-modal"
																color="danger"
																variant="outline"
																size="sm"
															>
																Delete
															</Button>
														</div>

														<Modal id={dialogId}>
															<Form method="post" action={item.deleteAction}>
																<input type="hidden" name="_method" value="DELETE" />
																<Modal.Description>
																	Delete glossary term <strong>{item.term}</strong>? This action
																	cannot be undone.
																</Modal.Description>
																<Modal.Footer>
																	<Button type="submit" color="danger">
																		Confirm delete
																	</Button>
																	<Button
																		type="button"
																		commandfor={dialogId}
																		command="close"
																		color="neutral"
																		variant="outline"
																	>
																		Cancel
																	</Button>
																</Modal.Footer>
															</Form>
														</Modal>
													</Table.Cell>
												</Table.Row>
											);
										})}
									</Table.Body>
								</Table>
							</Table.Container>
						)}
					</Card>
				</main>
			</CMSLayout>
		);
	};
}

/**
 * Renders the CMS glossary form for creating or editing a term.
 */
export function CMSGlossaryActionView() {
	return ({ model }: { model: CMSGlossaryActionView.Props }) => {
		let { action, description, mode, submitLabel, title, values } = model;

		return (
			<CMSLayout title={title} activePath={routes.cms.glossary.index.href()}>
				<main>
					<Card mix={[p(4), grid(), gap(3)]}>
						<Heading level={2}>{title}</Heading>
						<p mix={[m(0), fg("neutral")]}>{description}</p>

						<Form method="post" action={action}>
							{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

							{/* Every field stays nested inside its `Label`, so the controls keep
							the implicit label association they already had — no `id`/`for` pair
							needed — and each one's original `aria-label` rides along untouched. */}
							<Label mix={[grid(), gap(1)]}>
								Term
								<Input name="term" aria-label="Term" value={values.term} required />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								Title
								<Input name="title" aria-label="Title" value={values.title} />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								Slug
								<Input
									name="slug"
									aria-label="Slug"
									value={values.slug}
									required
									readOnly={mode === "edit"}
								/>
							</Label>

							<Label mix={[grid(), gap(1)]}>
								Definition
								<TextArea name="definition" rows={8} required defaultValue={values.definition} />
							</Label>

							<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
								<Button type="submit" color="brand">
									{submitLabel}
								</Button>
								<LinkButton href={routes.cms.glossary.index.href()} color="brand" variant="outline">
									Back to list
								</LinkButton>
							</div>
						</Form>
					</Card>
				</main>
			</CMSLayout>
		);
	};
}
