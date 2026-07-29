/**
 * Views for managing tutorials in the CMS. `CMSTutorialsIndexView` renders a
 * table of tutorials with tag chips, publish-state badges, and edit plus
 * modal-confirmed delete actions, and `CMSTutorialsActionView` renders the
 * create/edit form. Exist to power the admin CRUD screens for tutorials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	Badge,
	Button,
	Card,
	Form,
	Heading,
	Input,
	Label,
	Link,
	LinkButton,
	Modal,
	Table,
	TextArea,
} from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flexWrap, gap, grid, hstack } from "@pkg/u/layout";
import { minBs, p } from "@pkg/u/size";
import { font, textAlign } from "@pkg/u/typography";

import { CMSLayout } from "~/resources/components/layout/cms";
import routes from "~/routes/web";

/**
 * Groups types used by the CMS tutorials list view.
 */
export namespace CMSTutorialsIndexView {
	/**
	 * Describes one tutorial row shown in the list table.
	 */
	export interface Item {
		id: string;
		title: string;
		publicHref: string;
		preview: boolean;
		tags: string;
		href: string;
		deleteAction: string;
	}

	/**
	 * Provides the tutorials rendered by the list view.
	 */
	export interface Props {
		items: Array<Item>;
	}
}

/**
 * Groups types used by the CMS tutorial create/edit form.
 */
export namespace CMSTutorialsActionView {
	/**
	 * Holds editable tutorial fields used to prefill the form.
	 */
	export interface FormValues {
		title: string;
		slug: string;
		excerpt: string;
		tags: string;
		content: string;
		published_at: string;
	}

	/**
	 * Configures the tutorial form heading, behavior, and values.
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
 * Builds the CMS tutorials list page with edit and delete actions.
 */
export function CMSTutorialsIndexView() {
	return ({ model }: { model: CMSTutorialsIndexView.Props }) => {
		let { items } = model;

		return (
			<CMSLayout title="Tutorials" activePath={routes.cms.tutorials.index.href()}>
				<main mix={[grid(), gap(4)]}>
					<Card mix={[p(4)]}>
						<div mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}>
							<Heading level={2}>Tutorials</Heading>
							<LinkButton href={routes.cms.tutorials.new.href()} color="brand" variant="outline">
								New Tutorial
							</LinkButton>
						</div>
					</Card>
					<Card mix={[p(4)]}>
						{items.length === 0 ? (
							<p mix={[fg("neutral")]}>No tutorials found in the database yet.</p>
						) : (
							<Table.Container>
								<Table aria-label="Tutorials">
									<Table.Header>
										<Table.Row>
											<Table.Column>Title</Table.Column>
											<Table.Column>Tags</Table.Column>
											<Table.Column align="center">Status</Table.Column>
											<Table.Column align="end">Actions</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{items.map((item, index) => {
											let dialogId = `delete-tutorial-${String(index)}`;
											return (
												<Table.Row key={item.id}>
													<Table.Cell>
														<Link href={item.publicHref}>{item.title}</Link>
													</Table.Cell>
													<Table.Cell>
														{item.tags ? (
															<div mix={[hstack({ gap: 1 }), flexWrap("wrap")]}>
																{item.tags
																	.split(", ")
																	.filter(Boolean)
																	.map((tag) => (
																		<Badge key={tag} color="brand" variant="secondary">
																			{tag}
																		</Badge>
																	))}
															</div>
														) : null}
													</Table.Cell>
													{/* A future `published_at` reads as a draft still being worked
													on, so it takes the warning tone, while anything already public
													takes success — the same publish-state contract the public pages
													use, spelled out in words instead of an emoji. */}
													<Table.Cell mix={[textAlign("center")]}>
														<Badge color={item.preview ? "warning" : "success"} variant="secondary">
															{item.preview ? "Preview" : "Published"}
														</Badge>
													</Table.Cell>
													<Table.Cell>
														<div mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
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
															<form method="post" action={item.deleteAction} mix={[grid(), gap(4)]}>
																<input type="hidden" name="_method" value="DELETE" />
																<Modal.Description>
																	Delete tutorial <strong>{item.title}</strong>? This action cannot
																	be undone.
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
															</form>
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
 * Builds the CMS tutorial form page for create and edit flows.
 */
export function CMSTutorialsActionView() {
	return ({ model }: { model: CMSTutorialsActionView.Props }) => {
		let { action, description, mode, submitLabel, title, values } = model;

		return (
			<CMSLayout title={title} activePath={routes.cms.tutorials.index.href()}>
				<main>
					<Card mix={[p(4), grid(), gap(3)]}>
						<Heading level={2}>{title}</Heading>
						<p mix={[fg("neutral")]}>{description}</p>

						<Form method="post" action={action} mix={[gap(3)]}>
							{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

							<Label mix={[grid(), gap(1)]}>
								<span>Title</span>
								<Input name="title" value={values.title} required />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Slug</span>
								<Input name="slug" value={values.slug} required readOnly={mode === "edit"} />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Excerpt</span>
								<TextArea name="excerpt" rows={3} required defaultValue={values.excerpt} />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Tags (comma separated)</span>
								<Input name="tags" value={values.tags} />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Published At</span>
								<Input type="date" name="published_at" value={values.published_at} />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Content</span>
								{/* The Markdown body is the one field worth many lines of room, so it
								keeps a monospaced face and a tall floor on top of the control's own
								content-driven sizing. */}
								<TextArea
									name="content"
									rows={16}
									required
									defaultValue={values.content}
									mix={[font("mono"), minBs("24rem")]}
								/>
							</Label>

							<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
								<Button type="submit" color="brand">
									{submitLabel}
								</Button>
								<LinkButton
									href={routes.cms.tutorials.index.href()}
									color="brand"
									variant="outline"
								>
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
