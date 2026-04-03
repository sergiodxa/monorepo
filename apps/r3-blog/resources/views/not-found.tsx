import { css } from "remix/component";

import { BlogLayout } from "~/resources/components/layout/blog";

export namespace NotFoundView {
	export interface Model {
		title: string;
		description: string;
		emoji: string;
	}
}

export function NotFoundView() {
	return ({ model }: { model: NotFoundView.Model }) => (
		<BlogLayout title={model.title} description={model.description}>
			<main
				mix={[
					css({
						display: "grid",
						gap: "1rem",
						justifyItems: "center",
						textAlign: "center",
						paddingTop: "3rem",
					}),
				]}
			>
				<div
					aria-hidden
					mix={[
						css({
							width: "4.5rem",
							height: "4.5rem",
							borderRadius: "999px",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: "2.2rem",
							backgroundColor: "var(--ui-accent-bg-tint)",
							color: "var(--ui-accent-fg-emphasis)",
							border: "1px solid var(--ui-accent-border)",
						}),
					]}
				>
					{model.emoji}
				</div>
				<h1 mix={[css({ margin: 0, fontSize: "2.7rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
					{model.title}
				</h1>
				<p
					mix={[
						css({
							margin: 0,
							maxWidth: "56ch",
							color: "var(--ui-neutral-fg)",
							lineHeight: 1.4,
							fontSize: "1.35rem",
						}),
					]}
				>
					{model.description}
				</p>
			</main>
		</BlogLayout>
	);
}
