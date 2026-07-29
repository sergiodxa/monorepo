/**
 * Views for managing redirect rules in the CMS. `CMSRedirectsIndexView` renders a
 * table of from/to/status rules with modal-confirmed delete actions, and
 * `CMSRedirectsNewView` renders the form to create a redirect with a status-code
 * select. Exist to power the admin screens for KV-stored redirect rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Heading, Input, LinkButton, Modal, Select, Table, Text } from "@pkg/r3-ui";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flexWrap, gap, grid, hstack } from "@pkg/u/layout";
import { m, p } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";

import { CMSLayout } from "~/resources/layouts/cms";
import routes from "~/routes/web";

/**
 * Types used by the redirects index view.
 */
export namespace CMSRedirectsIndexView {
	/**
	 * Redirect row displayed in the redirects table.
	 */
	export interface Item {
		from: string;
		to: string;
		status: number;
		deleteAction: string;
	}

	/**
	 * Data required to render the redirects index state.
	 */
	export interface Props {
		items: Array<Item>;
	}
}

/**
 * Types used by the create-redirect view.
 */
export namespace CMSRedirectsNewView {
	/**
	 * Heading and form target for the new redirect page.
	 */
	export interface Props {
		title: string;
		description: string;
		action: string;
	}
}

/**
 * Builds the redirects listing page with delete actions.
 */
export function CMSRedirectsIndexView() {
	return ({ model }: { model: CMSRedirectsIndexView.Props }) => {
		let { items } = model;

		return (
			<CMSLayout title="Redirects" activePath={routes.cms.redirects.index.href()}>
				<main mix={[grid(), gap(4)]}>
					<section
						mix={[p(4), rounded("lg"), border({ width: 1, color: "neutral" }), bg("neutral.tint")]}
					>
						<div mix={[hstack({ justify: "between", align: "center" })]}>
							<Heading level={2}>Redirects</Heading>
							<LinkButton href={routes.cms.redirects.new.href()} color="brand">
								New Redirect
							</LinkButton>
						</div>
					</section>
					<section
						mix={[p(4), rounded("lg"), border({ width: 1, color: "neutral" }), bg("neutral.tint")]}
					>
						{items.length === 0 ? (
							<p mix={[m(0), fg("neutral")]}>No redirects found in KV yet.</p>
						) : (
							<Table.Container>
								<Table aria-label="Redirects">
									<Table.Header>
										<Table.Row>
											<Table.Column>From</Table.Column>
											<Table.Column>To</Table.Column>
											<Table.Column align="center">Status</Table.Column>
											<Table.Column align="end">Actions</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{items.map((item, index) => {
											let dialogId = `delete-redirect-${String(index)}`;
											return (
												<Table.Row key={item.from}>
													<Table.Cell>{item.from}</Table.Cell>
													<Table.Cell mix={[fg("neutral")]}>{item.to}</Table.Cell>
													<Table.Cell mix={[textAlign("center"), fg("neutral")]}>
														{String(item.status)}
													</Table.Cell>
													<Table.Cell mix={[textAlign("end")]}>
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

														<Modal id={dialogId}>
															<form method="post" action={item.deleteAction} mix={[grid(), gap(3)]}>
																<input type="hidden" name="_method" value="DELETE" />
																<Modal.Description mix={[m(0)]}>
																	Delete redirect <strong>{item.from}</strong>? This action cannot
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
					</section>
				</main>
			</CMSLayout>
		);
	};
}

/**
 * Builds the form page for creating a redirect.
 */
export function CMSRedirectsNewView() {
	return ({ model }: { model: CMSRedirectsNewView.Props }) => {
		let { title, description, action } = model;

		return (
			<CMSLayout title={title} activePath={routes.cms.redirects.index.href()}>
				<main>
					<section
						mix={[
							grid(),
							gap(3),
							p(4),
							rounded("lg"),
							border({ width: 1, color: "neutral" }),
							bg("neutral.tint"),
						]}
					>
						<Heading level={2}>{title}</Heading>
						<p mix={[m(0), fg("neutral")]}>{description}</p>

						<form method="post" action={action} mix={[grid(), gap(3)]}>
							<label mix={[grid(), gap(1)]}>
								<Text>From</Text>
								<Input name="from" aria-label="From" required />
							</label>

							<label mix={[grid(), gap(1)]}>
								<Text>To</Text>
								<Input name="to" aria-label="To" required />
							</label>

							<label mix={[grid(), gap(1)]}>
								<Text>Status</Text>
								<Select name="status">
									<Select.Option value="301">301 Permanent</Select.Option>
									<Select.Option value="302" selected>
										302 Temporary
									</Select.Option>
									<Select.Option value="307">307 Temporary (Method Preserved)</Select.Option>
									<Select.Option value="308">308 Permanent (Method Preserved)</Select.Option>
								</Select>
							</label>

							<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
								<Button type="submit" color="brand">
									Create Redirect
								</Button>
								<LinkButton
									href={routes.cms.redirects.index.href()}
									color="brand"
									variant="outline"
								>
									Back to list
								</LinkButton>
							</div>
						</form>
					</section>
				</main>
			</CMSLayout>
		);
	};
}
