/**
 * Views for managing bookmarks in the CMS: the list with its quick add, edit and
 * modal-confirmed delete actions, the create/edit form, and the quick add form itself,
 * which the dashboard shows too so a URL can be saved from the first page of the CMS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, hstack } from "@sdxc/u/layout";
import { is, m, mis, p } from "@sdxc/u/size";
import { truncate, weight } from "@sdxc/u/typography";
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
	TextArea,
	Badge,
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
		/** The open flag the weekly check raised, until a save reviews it. */
		flag?: "moved" | "gone";
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
	 * Form field values used to prefill bookmark inputs; an empty title or description is
	 * read from the page when the form is saved.
	 */
	export interface FormValues {
		title: string;
		url: string;
		description: string;
	}

	/** The latest read of the bookmarked page, as the edit page reports it. */
	export interface Check {
		status: "ok" | "moved" | "gone" | "blocked" | "flaky";
		httpStatus: number | null;
		/** When the page was read, already formatted for reading. */
		checkedOn: string;
		finalUrl: string | null;
		/** Whether the read raised a flag that no save has reviewed yet. */
		open: boolean;
		/** The edit page with the moved page's new address filled in. */
		useFinalHref?: string;
	}

	/** Another bookmark already holding the URL the form tried to save. */
	export interface Conflict {
		label: string;
		href: string;
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
		/** Shown above the form, such as why a save landed on an existing bookmark. */
		notice?: string;
		/** Set when a save was refused because another bookmark holds the URL. */
		conflict?: Conflict;
		/** The latest read of the page, absent until it was read. */
		check?: Check | undefined;
	}
}

/**
 * Saves a bookmark from a URL alone: the title and description are read from the page,
 * and a URL already saved opens the existing bookmark instead.
 */
export function QuickBookmarkForm() {
	return () => (
		<Form method="post" action={routes.cms.bookmarks.index.href()}>
			<div mix={[grid(), gap(1)]}>
				<Label htmlFor="quick-bookmark-url">Quick add</Label>
				<div mix={[hstack({ gap: 2, align: "center" }), flexWrap("wrap")]}>
					<Input
						id="quick-bookmark-url"
						name="url"
						type="text"
						inputMode="url"
						autoComplete="off"
						placeholder="https://"
						required
					/>
					<Button type="submit" color="brand">
						Bookmark
					</Button>
				</div>
			</div>
		</Form>
	);
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
					<Card mix={[p(4), grid(), gap(3)]}>
						<div mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}>
							<Heading level={2}>Bookmarks</Heading>
							<LinkButton href={routes.cms.bookmarks.new.href()} color="brand" size="sm">
								New Bookmark
							</LinkButton>
						</div>
						<QuickBookmarkForm />
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
													<Table.Cell>
														{item.title}
														{item.flag ? (
															<Badge
																color={item.flag === "gone" ? "danger" : "warning"}
																variant="secondary"
																mix={[mis(2)]}
															>
																{item.flag === "gone" ? "Gone" : "Moved"}
															</Badge>
														) : null}
													</Table.Cell>
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

/** How each outcome reads on the edit page. */
const CHECK_SUMMARIES: Record<CMSBookmarksActionView.Check["status"], string> = {
	ok: "The page answered",
	moved: "The page redirects elsewhere",
	gone: "The page is gone",
	blocked: "The site refused the check, so it could not tell",
	flaky: "The site did not answer, so it could not tell",
};

/**
 * What the latest read of the page found. An open flag reads as an alert, with what saving
 * the form does about it, and a moved page offers its new address for the form.
 */
function CheckReport(handle: Handle<{ check: CMSBookmarksActionView.Check }>) {
	return () => {
		let { check } = handle.props;
		let status = check.httpStatus === null ? "" : ` (${String(check.httpStatus)})`;

		return (
			<div mix={[grid(), gap(2)]}>
				<p
					role={check.open ? "alert" : "status"}
					mix={[
						m(0),
						fg(check.open ? (check.status === "gone" ? "danger" : "warning") : "neutral"),
						weight(check.open ? "medium" : "normal"),
					]}
				>
					{CHECK_SUMMARIES[check.status]}
					{status} when checked on {check.checkedOn}.
					{check.open ? " Saving this bookmark marks it reviewed." : null}
				</p>
				{check.status === "moved" && check.finalUrl ? (
					<p mix={[m(0), fg("neutral"), truncate()]}>
						Now at <Link href={check.finalUrl}>{check.finalUrl}</Link>
					</p>
				) : null}
				{check.useFinalHref ? (
					<div>
						<LinkButton href={check.useFinalHref} color="warning" variant="outline" size="sm">
							Use the new address
						</LinkButton>
					</div>
				) : null}
			</div>
		);
	};
}

/**
 * Builds the CMS page used to create or edit a bookmark.
 */
export function CMSBookmarksActionView() {
	return ({ model }: { model: CMSBookmarksActionView.Props }) => {
		let { action, check, conflict, description, mode, notice, submitLabel, title, values } = model;

		return (
			<CMSLayout title={title} activePath={routes.cms.bookmarks.index.href()}>
				<main>
					<Card mix={[p(4), grid(), gap(3)]}>
						<Heading level={2}>{title}</Heading>
						<p mix={[m(0), fg("neutral")]}>{description}</p>

						{notice ? (
							<p role="status" mix={[m(0), fg("warning"), weight("medium")]}>
								{notice}
							</p>
						) : null}

						{check ? <CheckReport check={check} /> : null}

						{conflict ? (
							<p role="alert" mix={[m(0), fg("danger"), weight("medium")]}>
								This URL is already bookmarked as <Link href={conflict.href}>{conflict.label}</Link>
								.
							</p>
						) : null}

						<Form method="post" action={action}>
							{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

							<Label mix={[grid(), gap(1)]}>
								URL
								<Input name="url" type="text" inputMode="url" value={values.url} required />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								Title
								<Input name="title" value={values.title} placeholder="Read from the page" />
							</Label>

							<Label mix={[grid(), gap(1)]}>
								Description
								<TextArea
									name="description"
									rows={3}
									defaultValue={values.description}
									placeholder="Read from the page"
								/>
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
