/**
 * Views for managing bookmarks in the CMS. `CMSBookmarksIndexView` renders a
 * table of bookmarks with normalized URL links and edit plus modal-confirmed
 * delete actions, and `CMSBookmarksActionView` renders the create/edit form.
 * Includes a URL-normalizing helper. Exist to power the admin CRUD for bookmarks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, hstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { truncate } from "@sdxc/u/typography";
import {
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

import { CMSLayout } from "~/resources/layouts/cms";
import routes from "~/routes/web";

/**
 * Types used to render the CMS bookmarks list page.
 */
export namespace CMSBookmarksIndexView {
	/**
	 * Single bookmark row displayed in the index table.
	 */
	export interface Item {
		id: string;
		title: string;
		url: string;
		href: string;
		deleteAction: string;
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
	 * Form field values used to prefill bookmark inputs.
	 */
	export interface FormValues {
		title: string;
		url: string;
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
	}
}

/**
 * Builds the CMS page that lists bookmarks and row actions. A fixed table
 * layout keeps the URL column ellipsized inside the panel, applied raw since
 * `table-layout` sits outside the `u` utilities.
 */
export function CMSBookmarksIndexView() {
	return ({ model }: { model: CMSBookmarksIndexView.Props }) => {
		let { items } = model;

		return (
			<CMSLayout title="Bookmarks" activePath={routes.cms.bookmarks.index.href()}>
				<main mix={[grid(), gap(4)]}>
					<Card mix={[p(4)]}>
						<div mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}>
							<Heading level={2}>Bookmarks</Heading>
							<LinkButton href={routes.cms.bookmarks.new.href()} color="brand" size="sm">
								New Bookmark
							</LinkButton>
						</div>
					</Card>
					<Card mix={[p(4)]}>
						{items.length === 0 ? (
							<p mix={[m(0), fg("neutral")]}>No bookmarks found in the database yet.</p>
						) : (
							<Table.Container>
								<Table aria-label="Bookmarks" mix={[raw({ tableLayout: "fixed" })]}>
									<Table.Header>
										<Table.Row>
											<Table.Column mix={[is("40%")]}>Title</Table.Column>
											<Table.Column>URL</Table.Column>
											<Table.Column align="end" mix={[is("7rem")]}>
												Actions
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{items.map((item, index) => {
											let dialogId = `delete-bookmark-${String(index)}`;
											return (
												<Table.Row key={item.id}>
													<Table.Cell>{item.title}</Table.Cell>
													<Table.Cell mix={[fg("neutral"), truncate()]}>
														<Link href={normalizeBookmarkHref(item.url)}>
															{normalizeBookmarkHref(item.url)}
														</Link>
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
																	Delete bookmark <strong>{item.title}</strong>? This action cannot
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
 * Builds the CMS page used to create or edit a bookmark.
 */
export function CMSBookmarksActionView() {
	return ({ model }: { model: CMSBookmarksActionView.Props }) => {
		let { action, description, mode, submitLabel, title, values } = model;

		return (
			<CMSLayout title={title} activePath={routes.cms.bookmarks.index.href()}>
				<main>
					<Card mix={[p(4), grid(), gap(3)]}>
						<Heading level={2}>{title}</Heading>
						<p mix={[m(0), fg("neutral")]}>{description}</p>

						<Form method="post" action={action}>
							{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

							<Label mix={[grid(), gap(1)]}>
								Title
								<Input name="title" value={values.title} required />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								URL
								<Input name="url" value={values.url} required />
							</Label>

							<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
								<Button type="submit" color="brand">
									{submitLabel}
								</Button>
								<LinkButton
									href={routes.cms.bookmarks.index.href()}
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
