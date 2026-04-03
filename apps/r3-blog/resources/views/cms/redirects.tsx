import { css } from "remix/component";

import { Button } from "~/resources/components/button";
import { Input } from "~/resources/components/input";
import { CMSLayout } from "~/resources/components/layout/cms";
import { Modal } from "~/resources/components/modal";
import { Select } from "~/resources/components/select";
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
				<main mix={[css({ display: "grid", gap: "0.9rem" })]}>
					<section
						mix={[
							css({
								backgroundColor: "var(--ui-neutral-bg-tint)",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "0.7rem",
								padding: "1rem",
							}),
						]}
					>
						<div
							mix={[
								css({ display: "flex", justifyContent: "space-between", alignItems: "center" }),
							]}
						>
							<h2
								mix={[
									css({ margin: 0, fontSize: "1.1rem", color: "var(--ui-neutral-fg-emphasis)" }),
								]}
							>
								Redirects
							</h2>
							<a
								href={routes.cms.redirects.new.href()}
								mix={[
									css({
										boxSizing: "border-box",
										display: "inline-flex",
										alignItems: "center",
										height: "2.25rem",
										padding: "0 0.7rem",
										fontSize: "0.9rem",
										borderRadius: "0.4rem",
										border: "1px solid var(--ui-accent-border)",
										backgroundColor: "var(--ui-accent-bg-tint)",
										color: "var(--ui-accent-fg-emphasis)",
										textDecoration: "none",
									}),
								]}
							>
								New Redirect
							</a>
						</div>
					</section>
					<section
						mix={[
							css({
								backgroundColor: "var(--ui-neutral-bg-tint)",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "0.7rem",
								padding: "1rem",
							}),
						]}
					>
						{items.length === 0 ? (
							<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>
								No redirects found in KV yet.
							</p>
						) : (
							<div mix={[css({ overflowX: "auto" })]}>
								<table mix={[css({ width: "100%", borderCollapse: "collapse" })]}>
									<thead>
										<tr>
											<th
												mix={[
													css({
														textAlign: "left",
														padding: "0.6rem 0.75rem",
														borderBottom: "1px solid var(--ui-neutral-border)",
														verticalAlign: "middle",
														color: "var(--ui-neutral-fg)",
														fontSize: "0.9rem",
														fontWeight: 600,
													}),
												]}
											>
												From
											</th>
											<th
												mix={[
													css({
														textAlign: "left",
														padding: "0.6rem 0.75rem",
														borderBottom: "1px solid var(--ui-neutral-border)",
														verticalAlign: "middle",
														color: "var(--ui-neutral-fg)",
														fontSize: "0.9rem",
														fontWeight: 600,
													}),
												]}
											>
												To
											</th>
											<th
												mix={[
													css({
														textAlign: "center",
														padding: "0.6rem 0.75rem",
														borderBottom: "1px solid var(--ui-neutral-border)",
														verticalAlign: "middle",
														color: "var(--ui-neutral-fg)",
														fontSize: "0.9rem",
														fontWeight: 600,
													}),
												]}
											>
												Status
											</th>
											<th
												mix={[
													css({
														textAlign: "right",
														padding: "0.6rem 0.75rem",
														borderBottom: "1px solid var(--ui-neutral-border)",
														verticalAlign: "middle",
														color: "var(--ui-neutral-fg)",
														fontSize: "0.9rem",
														fontWeight: 600,
													}),
												]}
											>
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{items.map((item, index) => {
											let dialogId = `delete-redirect-${String(index)}`;
											return (
												<tr key={item.from}>
													<td
														mix={[
															css({
																padding: "0.6rem 0.75rem",
																borderBottom: "1px solid var(--ui-neutral-border)",
																verticalAlign: "middle",
																color: "var(--ui-neutral-fg-emphasis)",
															}),
														]}
													>
														{item.from}
													</td>
													<td
														mix={[
															css({
																padding: "0.6rem 0.75rem",
																borderBottom: "1px solid var(--ui-neutral-border)",
																verticalAlign: "middle",
																color: "var(--ui-neutral-fg)",
															}),
														]}
													>
														{item.to}
													</td>
													<td
														mix={[
															css({
																padding: "0.6rem 0.75rem",
																borderBottom: "1px solid var(--ui-neutral-border)",
																verticalAlign: "middle",
																textAlign: "center",
																color: "var(--ui-neutral-fg)",
															}),
														]}
													>
														{String(item.status)}
													</td>
													<td
														mix={[
															css({
																padding: "0.6rem 0.75rem",
																borderBottom: "1px solid var(--ui-neutral-border)",
																verticalAlign: "middle",
																textAlign: "right",
															}),
														]}
													>
														<button
															type="button"
															commandfor={dialogId}
															command="show-modal"
															mix={[
																css({
																	boxSizing: "border-box",
																	display: "inline-flex",
																	alignItems: "center",
																	justifyContent: "center",
																	height: "1.8rem",
																	padding: "0 0.55rem",
																	fontSize: "0.82rem",
																	fontFamily: "inherit",
																	borderRadius: "0.35rem",
																	border: "1px solid var(--ui-neutral-border)",
																	backgroundColor: "transparent",
																	color: "var(--ui-neutral-fg)",
																	cursor: "pointer",
																}),
															]}
														>
															Delete
														</button>

														<Modal id={dialogId}>
															<form
																method="post"
																action={item.deleteAction}
																mix={[css({ display: "grid", gap: "0.75rem" })]}
															>
																<input type="hidden" name="_method" value="DELETE" />
																<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>
																	Delete redirect <strong>{item.from}</strong>? This action cannot
																	be undone.
																</p>
																<div mix={[css({ display: "flex", gap: "0.5rem" })]}>
																	<Button type="submit">Confirm delete</Button>
																	<button
																		type="button"
																		commandfor={dialogId}
																		command="close"
																		mix={[
																			css({
																				padding: "0.45rem 0.7rem",
																				fontSize: "0.9rem",
																				borderRadius: "0.4rem",
																				border: "1px solid var(--ui-neutral-border)",
																				backgroundColor: "transparent",
																				color: "var(--ui-neutral-fg)",
																				cursor: "pointer",
																				fontFamily: "inherit",
																			}),
																		]}
																	>
																		Cancel
																	</button>
																</div>
															</form>
														</Modal>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
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
							css({
								backgroundColor: "var(--ui-neutral-bg-tint)",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "0.7rem",
								padding: "1rem",
								display: "grid",
								gap: "0.8rem",
							}),
						]}
					>
						<h2
							mix={[css({ margin: 0, fontSize: "1.1rem", color: "var(--ui-neutral-fg-emphasis)" })]}
						>
							{title}
						</h2>
						<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>{description}</p>

						<form method="post" action={action} mix={[css({ display: "grid", gap: "0.65rem" })]}>
							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>From</span>
								<Input name="from" required />
							</label>

							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>To</span>
								<Input name="to" required />
							</label>

							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>Status</span>
								<Select name="status">
									<option value="301">301 Permanent</option>
									<option value="302" selected>
										302 Temporary
									</option>
									<option value="307">307 Temporary (Method Preserved)</option>
									<option value="308">308 Permanent (Method Preserved)</option>
								</Select>
							</label>

							<div mix={[css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })]}>
								<Button type="submit">Create Redirect</Button>
								<a
									href={routes.cms.redirects.index.href()}
									mix={[
										css({
											padding: "0.45rem 0.7rem",
											fontSize: "0.9rem",
											borderRadius: "0.4rem",
											border: "1px solid var(--ui-accent-border)",
											color: "var(--ui-accent-fg-emphasis)",
											textDecoration: "none",
										}),
									]}
								>
									Back to list
								</a>
							</div>
						</form>
					</section>
				</main>
			</CMSLayout>
		);
	};
}
