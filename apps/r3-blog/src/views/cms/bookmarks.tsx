import { css } from "remix/component";

import { Button } from "~/components/button";
import { Input } from "~/components/input";
import { Modal } from "~/components/modal";

export namespace CMSBookmarksIndexView {
	export interface Item {
		id: string;
		title: string;
		url: string;
		href: string;
		deleteAction: string;
	}

	export interface Props {
		items: Array<Item>;
	}
}

function normalizeBookmarkHref(rawHref: string) {
	if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
		return rawHref;
	}

	if (rawHref.startsWith("/")) {
		return rawHref;
	}

	return `https://${rawHref}`;
}

export namespace CMSBookmarksActionView {
	export interface FormValues {
		title: string;
		url: string;
	}

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

export function CMSBookmarksIndexView() {
	return ({ items }: CMSBookmarksIndexView.Props) => (
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
					mix={[css({ display: "flex", justifyContent: "space-between", alignItems: "center" })]}
				>
					<h2
						mix={[css({ margin: 0, fontSize: "1.1rem", color: "var(--ui-neutral-fg-emphasis)" })]}
					>
						Bookmarks
					</h2>
					<a
						href="/cms/bookmarks/new"
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
						New Bookmark
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
						No bookmarks found in the database yet.
					</p>
				) : (
					<div mix={[css({ overflowX: "auto" })]}>
						<table mix={[css({ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" })]}>
							<thead>
								<tr>
									<th
										mix={[
											css({
												width: "40%",
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
										URL
									</th>
									<th
										mix={[
											css({
												width: "7rem",
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
									let dialogId = `delete-bookmark-${String(index)}`;
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
												{item.title}
											</td>
											<td
												mix={[
													css({
														padding: "0.6rem 0.75rem",
														borderBottom: "1px solid var(--ui-neutral-border)",
														verticalAlign: "middle",
														color: "var(--ui-neutral-fg)",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}),
												]}
											>
												<a
													href={normalizeBookmarkHref(item.url)}
													mix={[css({ color: "var(--ui-accent-fg)" })]}
												>
													{normalizeBookmarkHref(item.url)}
												</a>
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
															Delete bookmark <strong>{item.title}</strong>? This action cannot be
															undone.
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
	);
}

export function CMSBookmarksActionView() {
	return ({
		action,
		description,
		mode,
		submitLabel,
		title,
		values,
	}: CMSBookmarksActionView.Props) => (
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
				<h2 mix={[css({ margin: 0, fontSize: "1.1rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
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
						<span mix={[css({ color: "var(--ui-neutral-fg)" })]}>URL</span>
						<Input name="url" value={values.url} required />
					</label>

					<div mix={[css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })]}>
						<Button type="submit">{submitLabel}</Button>
						<a
							href="/cms/bookmarks"
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
	);
}
