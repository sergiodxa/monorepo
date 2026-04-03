import { css } from "remix/component";

import { BlogLayout } from "~/resources/components/layout/blog";
import routes from "~/routes/web";

export namespace ColorsView {
	export interface Token {
		name: string;
	}

	export interface Group {
		title: string;
		tokens: Array<Token>;
	}

	export interface Model {}
}

const accentColorTokens: Array<ColorsView.Token> = [
	{ name: "--color-accent-50" },
	{ name: "--color-accent-100" },
	{ name: "--color-accent-200" },
	{ name: "--color-accent-300" },
	{ name: "--color-accent-400" },
	{ name: "--color-accent-500" },
	{ name: "--color-accent-600" },
	{ name: "--color-accent-700" },
	{ name: "--color-accent-800" },
	{ name: "--color-accent-900" },
	{ name: "--color-accent-950" },
];

const neutralColorTokens: Array<ColorsView.Token> = [
	{ name: "--color-neutral-50" },
	{ name: "--color-neutral-100" },
	{ name: "--color-neutral-200" },
	{ name: "--color-neutral-300" },
	{ name: "--color-neutral-400" },
	{ name: "--color-neutral-500" },
	{ name: "--color-neutral-600" },
	{ name: "--color-neutral-700" },
	{ name: "--color-neutral-800" },
	{ name: "--color-neutral-900" },
	{ name: "--color-neutral-950" },
];

const uiNeutralTokens: Array<ColorsView.Token> = [
	{ name: "--ui-neutral-bg-tint" },
	{ name: "--ui-neutral-bg-tint-hover" },
	{ name: "--ui-neutral-bg-tint-pressed" },
	{ name: "--ui-neutral-bg-solid" },
	{ name: "--ui-neutral-bg-solid-hover" },
	{ name: "--ui-neutral-bg-solid-pressed" },
	{ name: "--ui-neutral-border" },
	{ name: "--ui-neutral-border-strong" },
	{ name: "--ui-neutral-ring" },
	{ name: "--ui-neutral-fg" },
	{ name: "--ui-neutral-fg-muted" },
	{ name: "--ui-neutral-fg-emphasis" },
	{ name: "--ui-neutral-fg-on-solid" },
];

const uiAccentTokens: Array<ColorsView.Token> = [
	{ name: "--ui-accent-bg-tint" },
	{ name: "--ui-accent-bg-tint-hover" },
	{ name: "--ui-accent-bg-tint-pressed" },
	{ name: "--ui-accent-bg-solid" },
	{ name: "--ui-accent-bg-solid-hover" },
	{ name: "--ui-accent-bg-solid-pressed" },
	{ name: "--ui-accent-border" },
	{ name: "--ui-accent-border-strong" },
	{ name: "--ui-accent-ring" },
	{ name: "--ui-accent-fg" },
	{ name: "--ui-accent-fg-muted" },
	{ name: "--ui-accent-fg-emphasis" },
	{ name: "--ui-accent-fg-on-solid" },
];

export function ColorsView() {
	return ({ model: _model }: { model: ColorsView.Model }) => {
		let groups: Array<ColorsView.Group> = [
			{ title: "Neutral", tokens: neutralColorTokens },
			{ title: "Accent", tokens: accentColorTokens },
			{ title: "UI Neutral", tokens: uiNeutralTokens },
			{ title: "UI Accent", tokens: uiAccentTokens },
		];

		return (
			<BlogLayout
				title="Color Palette"
				description="R3 Blog color tokens"
				activePath={routes.colors.href()}
			>
				<main mix={[css({ display: "grid", gap: "1.2rem" })]}>
					<h1 mix={[css({ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
						R3 Blog Palette
					</h1>
					<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>
						Color tokens from <code>colors.css</code> shown as 50x50 swatches.
					</p>

					<section
						mix={[
							css({
								display: "grid",
								gap: "0.9rem",
								gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
							}),
						]}
					>
						<article
							mix={[
								css({
									padding: "1rem",
									borderRadius: "0.8rem",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									border: "1px solid var(--ui-neutral-border)",
									color: "var(--ui-neutral-fg)",
									display: "grid",
									gap: "0.65rem",
								}),
							]}
						>
							<h3
								mix={[
									css({ margin: 0, color: "var(--ui-neutral-fg-emphasis)", fontSize: "1.1rem" }),
								]}
							>
								Neutral UI Card
							</h3>
							<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg-muted)" })]}>
								Uses tint, border, foreground, muted and emphasis variables.
							</p>
							<div mix={[css({ display: "flex", gap: "0.45rem", flexWrap: "wrap" })]}>
								<span
									mix={[
										css({
											padding: "0.3rem 0.5rem",
											backgroundColor: "var(--ui-neutral-bg-tint)",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "0.45rem",
										}),
									]}
								>
									Tint
								</span>
								<span
									mix={[
										css({
											padding: "0.3rem 0.5rem",
											backgroundColor: "var(--ui-neutral-bg-tint-hover)",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "0.45rem",
										}),
									]}
								>
									Hover
								</span>
								<span
									mix={[
										css({
											padding: "0.3rem 0.5rem",
											backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
											border: "1px solid var(--ui-neutral-border-strong)",
											borderRadius: "0.45rem",
										}),
									]}
								>
									Pressed
								</span>
							</div>
							<div
								mix={[
									css({
										borderTop: "1px solid var(--ui-neutral-border-strong)",
										paddingTop: "0.6rem",
										display: "flex",
										gap: "0.45rem",
										flexWrap: "wrap",
									}),
								]}
							>
								<button
									type="button"
									mix={[
										css({
											padding: "0.45rem 0.7rem",
											borderRadius: "0.5rem",
											border: "none",
											backgroundColor: "var(--ui-neutral-bg-solid)",
											color: "var(--ui-neutral-fg-on-solid)",
										}),
									]}
								>
									Solid
								</button>
								<button
									type="button"
									mix={[
										css({
											padding: "0.45rem 0.7rem",
											borderRadius: "0.5rem",
											border: "none",
											backgroundColor: "var(--ui-neutral-bg-solid-hover)",
											color: "var(--ui-neutral-fg-on-solid)",
										}),
									]}
								>
									Hover
								</button>
								<button
									type="button"
									mix={[
										css({
											padding: "0.45rem 0.7rem",
											borderRadius: "0.5rem",
											border: "none",
											backgroundColor: "var(--ui-neutral-bg-solid-pressed)",
											color: "var(--ui-neutral-fg-on-solid)",
										}),
									]}
								>
									Pressed
								</button>
								<span
									mix={[
										css({
											marginLeft: "auto",
											padding: "0.45rem 0.7rem",
											borderRadius: "0.5rem",
											border: "1px solid var(--ui-neutral-border)",
											boxShadow: "0 0 0 3px var(--ui-neutral-ring)",
										}),
									]}
								>
									Ring
								</span>
							</div>
						</article>

						<article
							mix={[
								css({
									padding: "1rem",
									borderRadius: "0.8rem",
									backgroundColor: "var(--ui-accent-bg-tint)",
									border: "1px solid var(--ui-accent-border)",
									color: "var(--ui-accent-fg)",
									display: "grid",
									gap: "0.65rem",
								}),
							]}
						>
							<h3
								mix={[
									css({ margin: 0, color: "var(--ui-accent-fg-emphasis)", fontSize: "1.1rem" }),
								]}
							>
								Accent UI Card
							</h3>
							<p mix={[css({ margin: 0, color: "var(--ui-accent-fg-muted)" })]}>
								Uses tint, border, foreground, muted and emphasis variables.
							</p>
							<div mix={[css({ display: "flex", gap: "0.45rem", flexWrap: "wrap" })]}>
								<span
									mix={[
										css({
											padding: "0.3rem 0.5rem",
											backgroundColor: "var(--ui-accent-bg-tint)",
											border: "1px solid var(--ui-accent-border)",
											borderRadius: "0.45rem",
										}),
									]}
								>
									Tint
								</span>
								<span
									mix={[
										css({
											padding: "0.3rem 0.5rem",
											backgroundColor: "var(--ui-accent-bg-tint-hover)",
											border: "1px solid var(--ui-accent-border)",
											borderRadius: "0.45rem",
										}),
									]}
								>
									Hover
								</span>
								<span
									mix={[
										css({
											padding: "0.3rem 0.5rem",
											backgroundColor: "var(--ui-accent-bg-tint-pressed)",
											border: "1px solid var(--ui-accent-border-strong)",
											borderRadius: "0.45rem",
										}),
									]}
								>
									Pressed
								</span>
							</div>
							<div
								mix={[
									css({
										borderTop: "1px solid var(--ui-accent-border-strong)",
										paddingTop: "0.6rem",
										display: "flex",
										gap: "0.45rem",
										flexWrap: "wrap",
									}),
								]}
							>
								<button
									type="button"
									mix={[
										css({
											padding: "0.45rem 0.7rem",
											borderRadius: "0.5rem",
											border: "none",
											backgroundColor: "var(--ui-accent-bg-solid)",
											color: "var(--ui-accent-fg-on-solid)",
										}),
									]}
								>
									Solid
								</button>
								<button
									type="button"
									mix={[
										css({
											padding: "0.45rem 0.7rem",
											borderRadius: "0.5rem",
											border: "none",
											backgroundColor: "var(--ui-accent-bg-solid-hover)",
											color: "var(--ui-accent-fg-on-solid)",
										}),
									]}
								>
									Hover
								</button>
								<button
									type="button"
									mix={[
										css({
											padding: "0.45rem 0.7rem",
											borderRadius: "0.5rem",
											border: "none",
											backgroundColor: "var(--ui-accent-bg-solid-pressed)",
											color: "var(--ui-accent-fg-on-solid)",
										}),
									]}
								>
									Pressed
								</button>
								<span
									mix={[
										css({
											marginLeft: "auto",
											padding: "0.45rem 0.7rem",
											borderRadius: "0.5rem",
											border: "1px solid var(--ui-accent-border)",
											boxShadow: "0 0 0 3px var(--ui-accent-ring)",
										}),
									]}
								>
									Ring
								</span>
							</div>
						</article>
					</section>

					{groups.map((group) => (
						<section key={group.title} mix={[css({ display: "grid", gap: "0.8rem" })]}>
							<h2
								mix={[
									css({ margin: 0, fontSize: "1.35rem", color: "var(--ui-neutral-fg-emphasis)" }),
								]}
							>
								{group.title}
							</h2>
							<ul
								mix={[
									css({
										margin: 0,
										padding: 0,
										listStyle: "none",
										display: "grid",
										gap: "0.7rem",
										gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
									}),
								]}
							>
								{group.tokens.map((token) => (
									<li
										key={token.name}
										mix={[css({ display: "flex", alignItems: "center", gap: "0.65rem" })]}
									>
										<span
											aria-hidden
											mix={[
												css({
													display: "inline-block",
													width: "50px",
													height: "50px",
													backgroundColor: `var(${token.name})`,
													border: "1px solid var(--ui-neutral-border)",
													borderRadius: "0.35rem",
													flexShrink: 0,
												}),
											]}
										/>
										<code mix={[css({ color: "var(--ui-neutral-fg)" })]}>{token.name}</code>
									</li>
								))}
							</ul>
						</section>
					))}
				</main>
			</BlogLayout>
		);
	};
}
