import { Button } from "~/components/button";
import { Input } from "~/components/input";
import { Modal } from "~/components/modal";
import routes from "~/routes";

export namespace CMSArticlesIndexView {
	export interface Item {
		id: string;
		title: string;
		publicHref: string;
		preview: boolean;
		href: string;
		deleteAction: string;
	}

	export interface Props {
		items: Array<Item>;
	}
}

export namespace CMSArticlesActionView {
	export interface FormValues {
		title: string;
		slug: string;
		locale: string;
		excerpt: string;
		canonical_url: string;
		content: string;
		published_at: string;
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

export function CMSArticlesIndexView() {
	return ({ items }: CMSArticlesIndexView.Props) => (
		<main css={{ display: "grid", gap: "0.9rem" }}>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
				}}
			>
				<div css={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<h2 css={{ margin: 0, fontSize: "1.1rem", color: "var(--ui-neutral-fg-emphasis)" }}>
						Articles
					</h2>
					<a
						href={routes.cms.articles.new.href()}
						css={{
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
						}}
					>
						New Article
					</a>
				</div>
			</section>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
				}}
			>
				{items.length === 0 ? (
					<p css={{ margin: 0, color: "var(--ui-neutral-fg)" }}>
						No articles found in the database yet.
					</p>
				) : (
					<div css={{ overflowX: "auto" }}>
						<table css={{ width: "100%", borderCollapse: "collapse" }}>
							<thead>
								<tr>
									<th
										css={{
											textAlign: "left",
											padding: "0.6rem 0.75rem",
											borderBottom: "1px solid var(--ui-neutral-border)",
											color: "var(--ui-neutral-fg)",
											fontSize: "0.9rem",
											fontWeight: 600,
										}}
									>
										Title
									</th>
									<th
										css={{
											textAlign: "center",
											padding: "0.6rem 0.75rem",
											borderBottom: "1px solid var(--ui-neutral-border)",
											color: "var(--ui-neutral-fg)",
											fontSize: "0.9rem",
											fontWeight: 600,
										}}
									>
										Status
									</th>
									<th
										css={{
											textAlign: "right",
											padding: "0.6rem 0.75rem",
											borderBottom: "1px solid var(--ui-neutral-border)",
											color: "var(--ui-neutral-fg)",
											fontSize: "0.9rem",
											fontWeight: 600,
										}}
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{items.map((item, index) => {
									let dialogId = `delete-article-${String(index)}`;
									return (
										<tr key={item.id}>
											<td
												css={{
													padding: "0.6rem 0.75rem",
													borderBottom: "1px solid var(--ui-neutral-border)",
													verticalAlign: "middle",
													color: "var(--ui-neutral-fg-emphasis)",
												}}
											>
												<a
													href={item.publicHref}
													css={{ color: "var(--ui-accent-fg)", textDecoration: "none" }}
												>
													{item.title}
												</a>
											</td>
											<td
												css={{
													padding: "0.6rem 0.75rem",
													borderBottom: "1px solid var(--ui-neutral-border)",
													verticalAlign: "middle",
													textAlign: "center",
												}}
											>
												{item.preview ? "📝" : "✅"}
											</td>
											<td
												css={{
													padding: "0.6rem 0.75rem",
													borderBottom: "1px solid var(--ui-neutral-border)",
													verticalAlign: "middle",
													textAlign: "right",
												}}
											>
												<div
													css={{
														display: "flex",
														gap: "0.35rem",
														justifyContent: "end",
														alignItems: "center",
													}}
												>
													<a
														href={item.href}
														css={{
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
														}}
													>
														Edit
													</a>
													<button
														type="button"
														commandfor={dialogId}
														command="show-modal"
														css={{
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
														}}
													>
														Delete
													</button>
												</div>

												<Modal id={dialogId}>
													<form
														method={routes.cms.articles.destroy.method}
														action={item.deleteAction}
														css={{ display: "grid", gap: "0.75rem" }}
													>
														<p css={{ margin: 0, color: "var(--ui-neutral-fg)" }}>
															Delete article <strong>{item.title}</strong>? This action cannot be
															undone.
														</p>
														<div css={{ display: "flex", gap: "0.5rem" }}>
															<Button type="submit">Confirm delete</Button>
															<button
																type="button"
																commandfor={dialogId}
																command="close"
																css={{
																	padding: "0.45rem 0.7rem",
																	fontSize: "0.9rem",
																	borderRadius: "0.4rem",
																	border: "1px solid var(--ui-neutral-border)",
																	backgroundColor: "transparent",
																	color: "var(--ui-neutral-fg)",
																	cursor: "pointer",
																	fontFamily: "inherit",
																}}
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

export function CMSArticlesActionView() {
	return ({
		action,
		description,
		mode,
		submitLabel,
		title,
		values,
	}: CMSArticlesActionView.Props) => (
		<main>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
					display: "grid",
					gap: "0.8rem",
				}}
			>
				<h2 css={{ margin: 0, fontSize: "1.1rem", color: "var(--ui-neutral-fg-emphasis)" }}>
					{title}
				</h2>
				<p css={{ margin: 0, color: "var(--ui-neutral-fg)" }}>{description}</p>

				<form method="post" action={action} css={{ display: "grid", gap: "0.65rem" }}>
					{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span css={{ color: "var(--ui-neutral-fg)" }}>Title</span>
						<Input name="title" value={values.title} required />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span css={{ color: "var(--ui-neutral-fg)" }}>Slug</span>
						<Input name="slug" value={values.slug} required readOnly={mode === "edit"} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span css={{ color: "var(--ui-neutral-fg)" }}>Locale</span>
						<Input name="locale" value={values.locale} required />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span css={{ color: "var(--ui-neutral-fg)" }}>Excerpt</span>
						<textarea
							name="excerpt"
							rows={3}
							css={{
								padding: "0.45rem 0.55rem",
								fontSize: "0.9rem",
								borderRadius: "0.4rem",
								border: "1px solid var(--ui-neutral-border)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
								color: "var(--ui-neutral-fg-emphasis)",
								fontFamily: "inherit",
							}}
						>
							{values.excerpt}
						</textarea>
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span css={{ color: "var(--ui-neutral-fg)" }}>Canonical URL</span>
						<Input name="canonical_url" value={values.canonical_url} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span css={{ color: "var(--ui-neutral-fg)" }}>Published At</span>
						<Input type="date" name="published_at" value={values.published_at} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span css={{ color: "var(--ui-neutral-fg)" }}>Content</span>
						<textarea
							name="content"
							rows={16}
							required
							css={{
								padding: "0.45rem 0.55rem",
								fontSize: "0.9rem",
								borderRadius: "0.4rem",
								border: "1px solid var(--ui-neutral-border)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
								color: "var(--ui-neutral-fg-emphasis)",
								fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
							}}
						>
							{values.content}
						</textarea>
					</label>

					<div css={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
						<Button type="submit">{submitLabel}</Button>
						<a
							href={routes.cms.articles.index.href()}
							css={{
								padding: "0.45rem 0.7rem",
								fontSize: "0.9rem",
								borderRadius: "0.4rem",
								border: "1px solid var(--ui-accent-border)",
								color: "var(--ui-accent-fg-emphasis)",
								textDecoration: "none",
							}}
						>
							Back to list
						</a>
					</div>
				</form>
			</section>
		</main>
	);
}
