/**
 * Views for managing articles in the CMS. `CMSArticlesIndexView` renders a table
 * of articles with publish-state badges plus edit and modal-confirmed delete
 * actions, and `CMSArticlesActionView` renders the create/edit form for an
 * article's fields. Exist to power the admin CRUD screens for articles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { flexWrap, gap, grid, hstack } from "@sdxc/u/layout";
import { minBs, p } from "@sdxc/u/size";
import { font, textAlign } from "@sdxc/u/typography";
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
} from "@sdxc/ui";

import { CMSLayout } from "~/resources/layouts/cms";
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
		publicHref: string;
		preview: boolean;
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
		mode: "new" | "edit";
		action: string;
		submitLabel: string;
		deleteAction?: string;
		values: FormValues;
	}
}

/**
 * Renders the CMS page that lists articles and provides row actions.
 */
export function CMSArticlesIndexView() {
	return ({ model }: { model: CMSArticlesIndexView.Props }) => {
		let { items } = model;

		return (
			<CMSLayout title="Articles" activePath={routes.cms.articles.index.href()}>
				<main mix={[grid(), gap(4)]}>
					<Card mix={[p(4)]}>
						<div mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}>
							<Heading level={2}>Articles</Heading>
							<LinkButton href={routes.cms.articles.new.href()} color="brand" variant="outline">
								New Article
							</LinkButton>
						</div>
					</Card>
					<Card mix={[p(4)]}>
						{items.length === 0 ? (
							<p mix={[fg("neutral")]}>No articles found in the database yet.</p>
						) : (
							<Table.Container>
								<Table aria-label="Articles">
									<Table.Header>
										<Table.Row>
											<Table.Column>Title</Table.Column>
											<Table.Column align="center">Status</Table.Column>
											<Table.Column align="end">Actions</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{items.map((item, index) => {
											let dialogId = `delete-article-${String(index)}`;
											return (
												<Table.Row key={item.id}>
													<Table.Cell>
														<Link href={item.publicHref}>{item.title}</Link>
													</Table.Cell>
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
															<form
																method={routes.cms.articles.destroy.method}
																action={item.deleteAction}
																mix={[grid(), gap(4)]}
															>
																<Modal.Description>
																	Delete article <strong>{item.title}</strong>? This action cannot
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
 * Renders the CMS form used to create or edit an article. The content field
 * carries Markdown source, so it renders monospaced with room for many lines.
 */
export function CMSArticlesActionView() {
	return ({ model }: { model: CMSArticlesActionView.Props }) => {
		let { action, description, mode, submitLabel, title, values } = model;

		return (
			<CMSLayout title={title} activePath={routes.cms.articles.index.href()}>
				<main>
					<Card mix={[p(4), grid(), gap(3)]}>
						<Heading level={2}>{title}</Heading>
						<p mix={[fg("neutral")]}>{description}</p>

						<Form method="post" action={action} mix={[gap(3)]}>
							{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

							<Label mix={[grid(), gap(1)]}>
								<span>Title</span>
								<Input name="title" aria-label="Title" value={values.title} required />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Slug</span>
								<Input
									name="slug"
									aria-label="Slug"
									value={values.slug}
									required
									readOnly={mode === "edit"}
								/>
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Locale</span>
								<Input name="locale" aria-label="Locale" value={values.locale} required />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Excerpt</span>
								<TextArea name="excerpt" rows={3} defaultValue={values.excerpt} />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Canonical URL</span>
								<Input
									name="canonical_url"
									aria-label="Canonical URL"
									value={values.canonical_url}
								/>
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Published At</span>
								<Input
									type="date"
									name="published_at"
									aria-label="Published At"
									value={values.published_at}
								/>
							</Label>

							<Label mix={[grid(), gap(1)]}>
								<span>Content</span>
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
								<LinkButton href={routes.cms.articles.index.href()} color="brand" variant="outline">
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
