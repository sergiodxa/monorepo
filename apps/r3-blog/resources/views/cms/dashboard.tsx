import { css } from "remix/component";

import { CMSLayout } from "~/resources/components/layout/cms";
import routes from "~/routes/web";

export namespace CMSDashboardView {
	export interface Stats {
		articles: number;
		likes: number;
		tutorials: number;
		glossary: number;
	}

	export interface Props {
		stats: Stats;
	}
}

export function CMSDashboardView() {
	return ({ model }: { model: CMSDashboardView.Props }) => {
		let { stats } = model;

		return (
			<CMSLayout title="Dashboard" activePath={routes.cms.dashboard.href()}>
				<main mix={[css({ display: "grid", gap: "0.9rem" })]}>
					<h2
						mix={[
							css({
								position: "absolute",
								width: "1px",
								height: "1px",
								padding: 0,
								margin: "-1px",
								overflow: "hidden",
								clip: "rect(0,0,0,0)",
								whiteSpace: "nowrap",
								borderWidth: 0,
							}),
						]}
					>
						Post Stats
					</h2>
					<div
						mix={[
							css({
								display: "grid",
								gap: "0.65rem",
								gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
							}),
						]}
					>
						<article
							mix={[
								css({
									backgroundColor: "var(--ui-neutral-bg-tint)",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "0.6rem",
									padding: "0.8rem",
									display: "grid",
									gap: "0.25rem",
								}),
							]}
						>
							<p mix={[css({ margin: 0, fontSize: "0.85rem", color: "var(--ui-neutral-fg)" })]}>
								Total Articles
							</p>
							<p
								mix={[
									css({
										margin: 0,
										fontSize: "1.8rem",
										fontWeight: 700,
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{stats.articles}
							</p>
							<a
								href={routes.cms.articles.index.href()}
								mix={[css({ fontSize: "0.85rem", color: "var(--ui-accent-fg)" })]}
							>
								View all
							</a>
						</article>
						<article
							mix={[
								css({
									backgroundColor: "var(--ui-neutral-bg-tint)",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "0.6rem",
									padding: "0.8rem",
									display: "grid",
									gap: "0.25rem",
								}),
							]}
						>
							<p mix={[css({ margin: 0, fontSize: "0.85rem", color: "var(--ui-neutral-fg)" })]}>
								Total Likes
							</p>
							<p
								mix={[
									css({
										margin: 0,
										fontSize: "1.8rem",
										fontWeight: 700,
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{stats.likes}
							</p>
							<a
								href={routes.cms.bookmarks.index.href()}
								mix={[css({ fontSize: "0.85rem", color: "var(--ui-accent-fg)" })]}
							>
								View all
							</a>
						</article>
						<article
							mix={[
								css({
									backgroundColor: "var(--ui-neutral-bg-tint)",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "0.6rem",
									padding: "0.8rem",
									display: "grid",
									gap: "0.25rem",
								}),
							]}
						>
							<p mix={[css({ margin: 0, fontSize: "0.85rem", color: "var(--ui-neutral-fg)" })]}>
								Total Tutorials
							</p>
							<p
								mix={[
									css({
										margin: 0,
										fontSize: "1.8rem",
										fontWeight: 700,
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{stats.tutorials}
							</p>
							<a
								href={routes.cms.tutorials.index.href()}
								mix={[css({ fontSize: "0.85rem", color: "var(--ui-accent-fg)" })]}
							>
								View all
							</a>
						</article>
						<article
							mix={[
								css({
									backgroundColor: "var(--ui-neutral-bg-tint)",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "0.6rem",
									padding: "0.8rem",
									display: "grid",
									gap: "0.25rem",
								}),
							]}
						>
							<p mix={[css({ margin: 0, fontSize: "0.85rem", color: "var(--ui-neutral-fg)" })]}>
								Total Glossary Terms
							</p>
							<p
								mix={[
									css({
										margin: 0,
										fontSize: "1.8rem",
										fontWeight: 700,
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{stats.glossary}
							</p>
							<a
								href={routes.cms.glossary.index.href()}
								mix={[css({ fontSize: "0.85rem", color: "var(--ui-accent-fg)" })]}
							>
								View all
							</a>
						</article>
					</div>
				</main>
			</CMSLayout>
		);
	};
}
