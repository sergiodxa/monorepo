/**
 * Views for managing topics in the CMS: `CMSTopicsIndexView` lists every topic with its public
 * address and query, with edit and modal-confirmed delete actions, and `CMSTopicFormView`
 * renders the create and edit form, showing a kind's slug and query read-only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { fg } from "@sdxc/u/color";
import { flexWrap, gap, grid, hstack } from "@sdxc/u/layout";
import { m, mis, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import {
	Badge,
	Button,
	Card,
	FieldError,
	Form,
	Heading,
	Input,
	Label,
	Link,
	LinkButton,
	Modal,
	Table,
	TextArea,
} from "@sdxc/ui";

import { CMSLayout } from "~/resources/layouts/cms";
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
		values: Values;
		/** Why the last save was refused, or `null`. */
		error: string | null;
	}
}

/** Renders the CMS topic index with table actions. */
export function CMSTopicsIndexView() {
	return ({ model, assets }: { model: CMSTopicsIndexView.Props; assets: DocumentAssets }) => (
		<CMSLayout assets={assets} title="Topics" activePath={routes.cms.topics.index.href()}>
			<main mix={[grid(), gap(4)]}>
				<Card mix={[p(4)]}>
					<div mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}>
						<Heading level={2}>Topics</Heading>
						<LinkButton href={routes.cms.topics.new.href()} color="brand" size="sm">
							New Topic
						</LinkButton>
					</div>
				</Card>
				<Card mix={[p(4)]}>
					{model.items.length === 0 ? (
						<p mix={[m(0), fg("neutral")]}>No topics yet.</p>
					) : (
						<Table.Container>
							<Table aria-label="Topics">
								<Table.Header>
									<Table.Row>
										<Table.Column>Title</Table.Column>
										<Table.Column>Address</Table.Column>
										<Table.Column>Query</Table.Column>
										<Table.Column align="end">Actions</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{model.items.map((item, index) => {
										let dialogId = `delete-topic-${String(index)}`;
										return (
											<Table.Row key={item.id}>
												<Table.Cell>
													{item.title}
													{item.builtIn ? (
														<Badge color="neutral" variant="secondary" mix={[mis(2), text("xs")]}>
															Kind
														</Badge>
													) : null}
												</Table.Cell>
												<Table.Cell mix={[fg("neutral")]}>
													<Link href={item.path}>
														<code>{item.path}</code>
													</Link>
												</Table.Cell>
												<Table.Cell mix={[fg("neutral")]}>
													<code>{item.query}</code>
												</Table.Cell>
												<Table.Cell>
													<div mix={[hstack({ gap: 1, align: "center", justify: "end" })]}>
														<LinkButton href={item.href} color="brand" variant="outline" size="sm">
															Edit
														</LinkButton>
														{item.builtIn ? null : (
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
														)}
													</div>
													{item.builtIn ? null : (
														<Modal id={dialogId}>
															<Form method="post" action={item.deleteAction}>
																<input type="hidden" name="_method" value="DELETE" />
																<Modal.Description>
																	Delete the topic <strong>{item.title}</strong>? Its page and feeds
																	stop answering.
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
													)}
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
}

/**
 * Renders the topic form. A kind's topic shows its slug and query read-only and unnamed, so
 * the browser submits only its title and description.
 */
export function CMSTopicFormView() {
	return ({ model, assets }: { model: CMSTopicFormView.Props; assets: DocumentAssets }) => {
		let { values, builtIn } = model;

		return (
			<CMSLayout assets={assets} title={model.title} activePath={routes.cms.topics.index.href()}>
				<main>
					<Card mix={[p(4), grid(), gap(3)]}>
						<Heading level={2}>{model.title}</Heading>
						{model.path ? (
							<p mix={[m(0), fg("neutral")]}>
								Listed at <Link href={model.path}>{model.path}</Link>.
							</p>
						) : null}
						{model.error ? <FieldError id="topic-error">{model.error}</FieldError> : null}

						<Form method="post" action={model.action}>
							{model.mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

							<Label mix={[grid(), gap(1)]}>
								Title
								<Input name="title" aria-label="Title" value={values.title} required />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								Slug
								<Input
									name={builtIn ? undefined : "slug"}
									aria-label="Slug"
									value={values.slug}
									placeholder="Derived from the title when blank"
									readOnly={builtIn}
									disabled={builtIn}
								/>
							</Label>

							<Label mix={[grid(), gap(1)]}>
								Query
								<Input
									name={builtIn ? undefined : "query"}
									aria-label="Query"
									value={values.query}
									placeholder="tag:remix -kind:bookmark order:desc"
									required={!builtIn}
									readOnly={builtIn}
									disabled={builtIn}
								/>
							</Label>

							<Label mix={[grid(), gap(1)]}>
								Description (Markdown)
								<TextArea name="description" rows={6} defaultValue={values.description} />
							</Label>

							<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
								<Button type="submit" color="brand">
									{model.mode === "edit" ? "Save Topic" : "Create Topic"}
								</Button>
								<LinkButton href={routes.cms.topics.index.href()} color="brand" variant="outline">
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
