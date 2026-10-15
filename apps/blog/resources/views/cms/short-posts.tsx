/**
 * Views for managing notes and TILs in the CMS: a list with publish-state badges and "Post on
 * X", edit and modal-confirmed delete actions per row, and the create/edit form whose content
 * field counts what is left of X's limit. One pair serves both kinds; a TIL adds title and tags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { fg } from "@sdxc/u/color";
import { flexWrap, gap, grid, hstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { textAlign, whiteSpace } from "@sdxc/u/typography";
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
} from "@sdxc/ui";

import type { ShortPostViewModel } from "~/app/http/view-models/cms/short-posts";

import { POST_KINDS } from "~/app/models/kinds";
import { ShortField } from "~/resources/components/short-field";
import { CMSLayout } from "~/resources/layouts/cms";
import routes from "~/routes/web";

/**
 * Types used by the notes and TILs list view.
 */
export namespace CMSShortPostsIndexView {
	/** Which kind the list shows, and its rows. */
	export interface Props {
		kind: ShortPostViewModel.Kind;
		items: Array<ShortPostViewModel.Row>;
	}
}

/**
 * Types used by the note and TIL form.
 */
export namespace CMSShortPostsActionView {
	/** The form's heading, behavior and values. */
	export interface Props extends ShortPostViewModel.Form {}
}

/** The CMS routes of a kind's screens. */
function routesOf(kind: ShortPostViewModel.Kind) {
	return kind === "note" ? routes.cms.notes : routes.cms.tils;
}

/**
 * Builds the list page of notes or TILs, each row linking to its permalink.
 */
export function CMSShortPostsIndexView() {
	return ({ model, assets }: { model: CMSShortPostsIndexView.Props; assets: DocumentAssets }) => {
		let { items, kind } = model;
		let { label, plural } = POST_KINDS[kind];
		let cms = routesOf(kind);

		return (
			<CMSLayout assets={assets} title={plural} activePath={cms.index.href()}>
				<main mix={[grid(), gap(4)]}>
					<Card mix={[p(4)]}>
						<div mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}>
							<Heading level={2}>{plural}</Heading>
							<LinkButton href={cms.new.href()} color="brand" variant="outline">
								New {label}
							</LinkButton>
						</div>
					</Card>
					<Card mix={[p(4)]}>
						{items.length === 0 ? (
							<p mix={[fg("neutral")]}>No {plural} found in the database yet.</p>
						) : (
							<Table.Container>
								<Table aria-label={plural}>
									<Table.Header>
										<Table.Row>
											<Table.Column>{kind === "til" ? "Title" : "Note"}</Table.Column>
											{kind === "til" ? <Table.Column>Tags</Table.Column> : null}
											<Table.Column align="center">Status</Table.Column>
											<Table.Column align="end">Actions</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{items.map((item, index) => {
											let dialogId = `delete-${kind}-${String(index)}`;
											return (
												<Table.Row key={item.id}>
													<Table.Cell>
														<Link href={item.publicHref}>{item.label}</Link>
													</Table.Cell>
													{kind === "til" ? (
														<Table.Cell>
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
														</Table.Cell>
													) : null}
													<Table.Cell mix={[textAlign("center")]}>
														<Badge color={item.preview ? "warning" : "success"} variant="secondary">
															{item.preview ? "Preview" : "Published"}
														</Badge>
													</Table.Cell>
													<Table.Cell>
														<div
															mix={[
																hstack({ gap: 2, align: "center", justify: "end" }),
																whiteSpace("nowrap"),
															]}
														>
															<LinkButton
																href={item.shareHref}
																target="_blank"
																rel="noopener"
																color="neutral"
																variant="outline"
																size="sm"
															>
																Post on X
															</LinkButton>
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
																	Delete {label} <strong>{item.label}</strong>? Its permalink will
																	answer that it was deleted.
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
 * Builds the note or TIL form for create and edit flows. A TIL's slug is typed or taken from
 * its title and fixed once saved; a note's comes from its publish date, so the form has none.
 */
export function CMSShortPostsActionView() {
	return ({ model, assets }: { model: CMSShortPostsActionView.Props; assets: DocumentAssets }) => {
		let {
			action,
			contentError,
			description,
			publicHref,
			kind,
			mode,
			shareHref,
			submitLabel,
			title,
			values,
		} = model;
		let cms = routesOf(kind);

		return (
			<CMSLayout assets={assets} title={title} activePath={cms.index.href()}>
				<main>
					<Card mix={[p(4), grid(), gap(3)]}>
						<Heading level={2}>{title}</Heading>
						<p mix={[fg("neutral")]}>
							{description}
							{publicHref ? (
								<>
									{" "}
									<Link href={publicHref}>{publicHref}</Link>.
								</>
							) : null}
						</p>

						<Form method="post" action={action} mix={[gap(3)]}>
							{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

							{kind === "til" ? (
								<>
									<Label mix={[grid(), gap(1)]}>
										<span>Title</span>
										<Input name="title" value={values.title} required />
									</Label>

									<Label mix={[grid(), gap(1)]}>
										<span>Slug</span>
										<Input name="slug" value={values.slug} readOnly={mode === "edit"} />
									</Label>
								</>
							) : null}

							<div mix={[grid(), gap(1)]}>
								<Label htmlFor="content">{kind === "til" ? "TIL…" : "Content"}</Label>
								<ShortField
									id="content"
									kind={kind}
									content={values.content}
									error={contentError ?? ""}
								/>
							</div>

							{kind === "til" ? (
								<Label mix={[grid(), gap(1)]}>
									<span>Tags (comma separated)</span>
									<Input name="tags" value={values.tags} />
								</Label>
							) : null}

							<Label mix={[grid(), gap(1)]}>
								<span>Published At</span>
								<Input type="date" name="published_at" value={values.published_at} />
							</Label>

							<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
								<Button type="submit" color="brand">
									{submitLabel}
								</Button>
								{shareHref ? (
									<LinkButton
										href={shareHref}
										target="_blank"
										rel="noopener"
										color="neutral"
										variant="outline"
									>
										Post on X
									</LinkButton>
								) : null}
								<LinkButton href={cms.index.href()} color="brand" variant="outline">
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
