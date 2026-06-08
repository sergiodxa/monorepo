import { css } from "remix/ui";

import { Button } from "~/resources/components/button";
import { Input } from "~/resources/components/input";
import { CMSLayout } from "~/resources/components/layout/cms";
import { Modal } from "~/resources/components/modal";
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
								Tutorials
							</h2>
							<a
								href={routes.cms.tutorials.new.href()}
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
								New Tutorial
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
								No tutorials found in the database yet.
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
														color: "var(--ui-neutral-fg)",
														fontSize: "0.9rem",
														fontWeight: 600,
													}),
												]}
											>
												Title
											</th>
											<th
												mix={[
													css({
														textAlign: "left",
														padding: "0.6rem 0.75rem",
														borderBottom: "1px solid var(--ui-neutral-border)",
														color: "var(--ui-neutral-fg)",
														fontSize: "0.9rem",
														fontWeight: 600,
													}),
												]}
											>
												Tags
											</th>
											<th
												mix={[
													css({
														textAlign: "center",
														padding: "0.6rem 0.75rem",
														borderBottom: "1px solid var(--ui-neutral-border)",
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
											let dialogId = `delete-tutorial-${String(index)}`;
											return (
												<tr key={item.id}>
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
														<a
															href={item.publicHref}
															mix={[css({ color: "var(--ui-accent-fg)", textDecoration: "none" })]}
														>
															{item.title}
														</a>
													</td>
													<td
														mix={[
															css({
																padding: "0.6rem 0.75rem",
																borderBottom: "1px solid var(--ui-neutral-border)",
																verticalAlign: "middle",
															}),
														]}
													>
														{item.tags ? (
															<div
																mix={[css({ display: "flex", gap: "0.3rem", flexWrap: "wrap" })]}
															>
																{item.tags
																	.split(", ")
																	.filter(Boolean)
																	.map((tag) => (
																		<span
																			key={tag}
																			mix={[
																				css({
																					padding: "0.15rem 0.5rem",
																					borderRadius: "999px",
																					backgroundColor: "var(--ui-accent-bg-tint)",
																					color: "var(--ui-accent-fg-emphasis)",
																					fontSize: "0.78rem",
																				}),
																			]}
																		>
																			{tag}
																		</span>
																	))}
															</div>
														) : null}
													</td>
													<td
														mix={[
															css({
																padding: "0.6rem 0.75rem",
																borderBottom: "1px solid var(--ui-neutral-border)",
																verticalAlign: "middle",
																textAlign: "center",
															}),
														]}
													>
														{item.preview ? "📝" : "✅"}
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
														<div
															mix={[
																css({
																	display: "flex",
																	gap: "0.35rem",
																	justifyContent: "end",
																	alignItems: "center",
																}),
															]}
														>
															<a
																href={item.href}
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
																		border: "1px solid var(--ui-accent-border)",
																		color: "var(--ui-accent-fg-emphasis)",
																		textDecoration: "none",
																	}),
																]}
															>
																Edit
															</a>
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
														</div>

														<Modal id={dialogId}>
															<form
																method="post"
																action={item.deleteAction}
																mix={[css({ display: "grid", gap: "0.75rem" })]}
															>
																<input type="hidden" name="_method" value="DELETE" />
																<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>
																	Delete tutorial <strong>{item.title}</strong>? This action cannot
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
 * Builds the CMS tutorial form page for create and edit flows.
 */
export function CMSTutorialsActionView() {
	return ({ model }: { model: CMSTutorialsActionView.Props }) => {
		let { action, description, mode, submitLabel, title, values } = model;

		return (
			<CMSLayout title={title} activePath={routes.cms.tutorials.index.href()}>
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
							{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>Title</span>
								<Input name="title" value={values.title} required />
							</label>

							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>Slug</span>
								<Input name="slug" value={values.slug} required readOnly={mode === "edit"} />
							</label>

							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>Excerpt</span>
								<textarea
									name="excerpt"
									rows={3}
									required
									defaultValue={values.excerpt}
									mix={[
										css({
											padding: "0.45rem 0.55rem",
											fontSize: "0.9rem",
											borderRadius: "0.4rem",
											border: "1px solid var(--ui-neutral-border)",
											backgroundColor: "var(--ui-neutral-bg-tint)",
											color: "var(--ui-neutral-fg-emphasis)",
											fontFamily: "inherit",
										}),
									]}
								/>
							</label>

							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>Tags (comma separated)</span>
								<Input name="tags" value={values.tags} />
							</label>

							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>Published At</span>
								<Input type="date" name="published_at" value={values.published_at} />
							</label>

							<label mix={[css({ display: "grid", gap: "0.25rem" })]}>
								<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>Content</span>
								<textarea
									name="content"
									rows={16}
									required
									defaultValue={values.content}
									mix={[
										css({
											padding: "0.45rem 0.55rem",
											fontSize: "0.9rem",
											borderRadius: "0.4rem",
											border: "1px solid var(--ui-neutral-border)",
											backgroundColor: "var(--ui-neutral-bg-tint)",
											color: "var(--ui-neutral-fg-emphasis)",
											fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
										}),
									]}
								/>
							</label>

							<div mix={[css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })]}>
								<Button type="submit">{submitLabel}</Button>
								<a
									href={routes.cms.tutorials.index.href()}
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
