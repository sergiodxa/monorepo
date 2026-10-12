/**
 * Views for the weekly releases posts in the CMS. `CMSReleasesIndexView` lists them with their
 * publish state and "Post on X", edit and modal-confirmed delete actions, and
 * `CMSReleasesEditView` edits a post's title and Markdown content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

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

/** Type contracts for the releases index screen. */
export namespace CMSReleasesIndexView {
	/** One releases post as a row of the index. */
	export interface Item {
		id: string;
		title: string;
		/** The ISO week the post covers, which is also its permalink's last segment. */
		slug: string;
		preview: boolean;
		publicHref: string;
		/** The author's "Post on X" link, prefilled with the post's share text. */
		shareHref: string;
		href: string;
		deleteAction: string;
	}

	/** Data required to render the releases index. */
	export interface Props {
		items: Array<Item>;
	}
}

/** Type contracts for the releases edit screen. */
export namespace CMSReleasesEditView {
	/** Data required to render the edit form. */
	export interface Props {
		title: string;
		description: string;
		action: string;
		/** The "Post on X" link of the saved post. */
		shareHref: string;
		values: { title: string; content: string };
	}
}

/**
 * Renders the releases index. Posts come from the weekly job, so the screen offers no way to
 * create one.
 */
export function CMSReleasesIndexView() {
	return ({ model, assets }: { model: CMSReleasesIndexView.Props; assets: DocumentAssets }) => {
		let { items } = model;

		return (
			<CMSLayout assets={assets} title="Releases" activePath={routes.cms.releases.index.href()}>
				<main mix={[grid(), gap(4)]}>
					<Card mix={[p(4)]}>
						<Heading level={2}>Releases</Heading>
						<p mix={[fg("neutral")]}>
							Written every Friday from the week's GitHub releases; edit one to change its title or
							list.
						</p>
					</Card>
					<Card mix={[p(4)]}>
						{items.length === 0 ? (
							<p mix={[fg("neutral")]}>No releases posts yet.</p>
						) : (
							<Table.Container>
								<Table aria-label="Releases">
									<Table.Header>
										<Table.Row>
											<Table.Column>Week</Table.Column>
											<Table.Column>Title</Table.Column>
											<Table.Column align="center">Status</Table.Column>
											<Table.Column align="end">Actions</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{items.map((item, index) => {
											let dialogId = `delete-release-${String(index)}`;
											return (
												<Table.Row key={item.id}>
													<Table.Cell mix={[fg("neutral")]}>
														<code>{item.slug}</code>
													</Table.Cell>
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
															<Form method="post" action={item.deleteAction}>
																<input type="hidden" name="_method" value="DELETE" />
																<Modal.Description>
																	Delete the releases post for <strong>{item.slug}</strong>? The
																	weekly job will not write that week again.
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
 * Renders the edit form for a releases post's title and Markdown content, with its
 * "Post on X" link.
 */
export function CMSReleasesEditView() {
	return ({ model, assets }: { model: CMSReleasesEditView.Props; assets: DocumentAssets }) => {
		let { action, description, shareHref, title, values } = model;

		return (
			<CMSLayout assets={assets} title={title} activePath={routes.cms.releases.index.href()}>
				<main>
					<Card mix={[p(4), grid(), gap(3)]}>
						<Heading level={2}>{title}</Heading>
						<p mix={[fg("neutral")]}>{description}</p>

						<Form method="post" action={action} mix={[gap(3)]}>
							<input type="hidden" name="_method" value="PUT" />

							<Label mix={[grid(), gap(1)]}>
								<span>Title</span>
								<Input name="title" aria-label="Title" value={values.title} required />
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
									Save Release
								</Button>
								<LinkButton
									href={shareHref}
									target="_blank"
									rel="noopener"
									color="neutral"
									variant="outline"
								>
									Post on X
								</LinkButton>
								<LinkButton href={routes.cms.releases.index.href()} color="brand" variant="outline">
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
