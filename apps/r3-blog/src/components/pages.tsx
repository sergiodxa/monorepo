import type { Markdown } from "@pkg/markdown/server";

import { MarkdownView } from "@pkg/markdown/client/remix";

import { BlogLayout } from "~/components/layout";
import prismStyles from "~/styles/prism.css?url";

interface LinkItem {
	href: string;
	label: string;
	meta?: string;
	preview?: boolean;
	suffixHref?: string;
	suffixLabel?: string;
}

interface FeedActivityItem {
	href: string;
	label: string;
	date: string;
	preview?: boolean;
	icon: string;
}

interface FeedPageProps {
	activity: Array<FeedActivityItem>;
}

interface PostListPageProps {
	title: string;
	description: string;
	activePath: string;
	rssPath: string;
	items: Array<LinkItem>;
	emptyLabel: string;
	actionHref?: string;
	actionLabel?: string;
}

interface GlossaryEntry {
	id: string;
	slug: string;
	term: string;
	title?: string;
	definition: string;
}

interface GlossaryPageProps {
	entries: Array<GlossaryEntry>;
}

interface PostPageProps {
	typePath: string;
	title: string;
	eyebrow: string;
	slug: string;
	content: Markdown.AST | null;
	format?: string;
	publishedAt?: string | null;
	tags?: Array<string>;
	related?: Array<{ href: string; label: string; reason: string }>;
}

interface ColorToken {
	name: string;
}

const accentColorTokens: Array<ColorToken> = [
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

const neutralColorTokens: Array<ColorToken> = [
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

const uiNeutralTokens: Array<ColorToken> = [
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

const uiAccentTokens: Array<ColorToken> = [
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

function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
}

export function FeedPage() {
	return ({ activity }: FeedPageProps) => (
		<BlogLayout title="Sergio Xalambrí" description="Sergio Xalambrí" activePath="/">
			<main css={{ display: "grid", gap: "0.95rem" }}>
				<h1
					css={{
						fontSize: "2.2rem",
						margin: 0,
						lineHeight: 1.05,
						color: "var(--ui-neutral-fg-emphasis)",
					}}
				>
					Sergio Xalambrí
				</h1>
				<p
					css={{
						margin: 0,
						color: "var(--ui-neutral-fg)",
						maxWidth: "60ch",
						fontSize: "1.08rem",
						lineHeight: 1.4,
					}}
				>
					Web Developer from Buenos Aires with 10+ years of experience. I work at
					<strong> Daffy</strong> and maintain several open-source libraries around React Router and
					OAuth2.
				</p>
				<p css={{ margin: "0.2rem 0 0", color: "var(--ui-neutral-fg)", fontSize: "1.05rem" }}>
					Subscribe to my content using <a href="/atom.xml">RSS</a>.
				</p>

				<h2
					css={{ margin: "0.5rem 0 0", fontSize: "1.4rem", color: "var(--ui-neutral-fg-emphasis)" }}
				>
					Activity
				</h2>

				<ol css={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.9rem" }}>
					{activity.map((item, index) => (
						<li
							key={item.href + String(index)}
							css={{
								display: "grid",
								gridTemplateColumns: "1.8rem 1fr auto",
								gap: "0.8rem",
								alignItems: "start",
							}}
						>
							<span
								aria-hidden
								css={{
									display: "inline-flex",
									justifyContent: "center",
									alignItems: "center",
									width: "1.8rem",
									height: "1.8rem",
									fontSize: "1.25rem",
								}}
							>
								{item.icon}
							</span>
							<p
								css={{
									margin: 0,
									fontSize: "1.05rem",
									color: "var(--ui-neutral-fg-emphasis)",
									lineHeight: 1.4,
								}}
							>
								<a href={item.href}>{item.label}</a>
								{item.preview && (
									<span
										css={{
											marginLeft: "0.4rem",
											fontSize: "0.85rem",
											color: "var(--ui-accent-fg-emphasis)",
										}}
									>
										Preview
									</span>
								)}
							</p>
							<time
								css={{
									color: "var(--ui-neutral-fg-muted)",
									fontSize: "0.95rem",
									whiteSpace: "nowrap",
									marginTop: "0.1rem",
								}}
							>
								{formatDate(item.date)}
							</time>
						</li>
					))}
				</ol>
			</main>
		</BlogLayout>
	);
}

export function PostListPage() {
	return ({
		actionHref,
		actionLabel,
		activePath,
		description,
		emptyLabel,
		items,
		rssPath,
		title,
	}: PostListPageProps) => (
		<BlogLayout title={title} description={description} activePath={activePath}>
			<main css={{ display: "grid", gap: "0.85rem" }}>
				<div
					css={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "1rem",
						flexWrap: "wrap",
					}}
				>
					<h1 css={{ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" }}>
						{title}
					</h1>
					{actionHref && actionLabel && (
						<a
							href={actionHref}
							css={{
								backgroundColor: "var(--ui-accent-bg-solid)",
								color: "var(--ui-neutral-fg-on-solid)",
								padding: "0.55rem 1rem",
								borderRadius: "0.65rem",
								textDecoration: "none",
								fontWeight: 700,
							}}
						>
							{actionLabel}
						</a>
					)}
				</div>
				<p
					css={{
						margin: 0,
						color: "var(--ui-neutral-fg)",
						maxWidth: "52ch",
						fontSize: "1.05rem",
						lineHeight: 1.35,
					}}
				>
					{description}
				</p>
				<p css={{ margin: 0, color: "var(--ui-neutral-fg)", fontSize: "1.05rem" }}>
					Subscribe to my {title.toLowerCase()} using <a href={rssPath}>RSS</a>.
				</p>
				{items.length === 0 ? (
					<p css={{ margin: 0, color: "var(--ui-neutral-fg)" }}>{emptyLabel}</p>
				) : (
					<ul
						css={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem" }}
					>
						{items.map((item) => (
							<li key={item.href} css={{ fontSize: "1.05rem", lineHeight: 1.25 }}>
								<a href={item.href} css={{ color: "var(--ui-accent-fg)" }}>
									{item.label}
								</a>
								{item.suffixHref && item.suffixLabel && (
									<>
										{" - "}
										<a href={item.suffixHref} css={{ color: "var(--ui-accent-fg)" }}>
											({item.suffixLabel})
										</a>
									</>
								)}
								{item.preview && (
									<span
										css={{
											marginLeft: "0.35rem",
											color: "var(--ui-accent-fg-emphasis)",
											fontSize: "0.8rem",
										}}
									>
										Preview
									</span>
								)}
							</li>
						))}
					</ul>
				)}
			</main>
		</BlogLayout>
	);
}

export function GlossaryPage() {
	return ({ entries }: GlossaryPageProps) => (
		<BlogLayout title="Glossary" description="My definition of some terms." activePath="/glossary">
			<main css={{ display: "grid", gap: "1rem" }}>
				<h1 css={{ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" }}>
					Glossary
				</h1>
				<p
					css={{
						margin: 0,
						color: "var(--ui-neutral-fg)",
						maxWidth: "52ch",
						fontSize: "1.05rem",
						lineHeight: 1.35,
					}}
				>
					My definition of some terms.
				</p>
				<dl css={{ margin: 0, display: "grid", gap: "1.1rem" }}>
					{entries.map((item) => (
						<div
							key={item.id}
							id={item.slug}
							css={{
								padding: "1rem",
								borderRadius: "0.65rem",
								border: "2px solid transparent",
								backgroundColor: "var(--ui-neutral-bg-tint)",
								":target": {
									borderColor: "var(--ui-neutral-border-strong)",
									backgroundColor: "var(--ui-neutral-bg-tint-hover)",
								},
							}}
						>
							<dt
								css={{
									margin: 0,
									fontSize: "1.5rem",
									fontWeight: 700,
									color: "var(--ui-neutral-fg-emphasis)",
								}}
							>
								<a href={`#${item.slug}`} css={{ color: "inherit", textDecoration: "none" }}>
									{item.term}
									{item.title && (
										<small
											css={{
												marginLeft: "0.45rem",
												color: "var(--ui-neutral-fg-muted)",
												fontSize: "0.9rem",
											}}
										>
											(aka {item.title})
										</small>
									)}
								</a>
							</dt>
							<dd
								css={{
									margin: "0.4rem 0 0",
									color: "var(--ui-neutral-fg-emphasis)",
									fontSize: "1.05rem",
									lineHeight: 1.5,
								}}
							>
								{item.definition}
							</dd>
						</div>
					))}
				</dl>
			</main>
		</BlogLayout>
	);
}

export function PostPage() {
	return ({
		content,
		eyebrow,
		format,
		publishedAt,
		related = [],
		slug,
		tags = [],
		title,
		typePath,
	}: PostPageProps) => {
		let heading = `${typePath} / ${slug}`;
		let fileFormat = format ?? "html";

		return (
			<BlogLayout
				title={title}
				description={heading}
				activePath={`/${typePath}`}
				stylesheets={[{ href: prismStyles }]}
			>
				<main css={{ display: "grid", gap: "0.9rem", margin: "0 auto" }}>
					{tags.length > 0 && (
						<div css={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
							{tags.map((tag) => (
								<span
									key={tag}
									css={{
										padding: "0.2rem 0.6rem",
										borderRadius: "999px",
										backgroundColor: "var(--ui-accent-bg-tint)",
										color: "var(--ui-accent-fg-emphasis)",
										fontSize: "0.9rem",
									}}
								>
									{tag}
								</span>
							))}
						</div>
					)}

					<p
						css={{
							margin: 0,
							textTransform: "uppercase",
							letterSpacing: "0.12em",
							fontSize: "0.8rem",
							color: "var(--ui-neutral-fg-muted)",
							fontWeight: 700,
						}}
					>
						{eyebrow}
					</p>
					<h1
						css={{
							margin: 0,
							fontSize: "2.1rem",
							lineHeight: 1.05,
							color: "var(--ui-neutral-fg-emphasis)",
						}}
					>
						{title}
					</h1>

					<article
						css={{
							lineHeight: 1.7,
							color: "var(--ui-neutral-fg-emphasis)",
							fontSize: "1rem",
							padding: "1rem 1.1rem",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "0.6rem",
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
							margin: "0 -1.1rem",
						}}
					>
						{content ? <MarkdownView content={content} /> : <p css={{ margin: 0 }}>No content.</p>}
					</article>

					<section
						css={{
							margin: "0 -1.1rem",
							padding: "1rem 1.1rem",
							border: "1px solid var(--ui-accent-border)",
							borderRadius: "0.8rem",
							backgroundColor: "var(--ui-accent-bg-tint)",
							display: "grid",
							gridTemplateColumns: "1fr auto",
							gap: "0.8rem",
							alignItems: "center",
						}}
					>
						<div>
							<p
								css={{
									margin: 0,
									color: "var(--ui-accent-fg-muted)",
									fontSize: "1rem",
									fontWeight: 700,
								}}
							>
								Do you like my content?
							</p>
							<p
								css={{ margin: "0.2rem 0 0", color: "var(--ui-accent-fg-muted)", fontSize: "1rem" }}
							>
								Your sponsorship helps me create more tutorials, articles, and open-source tools.
							</p>
						</div>
						<a
							href="https://github.com/sponsors/sergiodxa"
							css={{
								textDecoration: "none",
								backgroundColor: "var(--ui-accent-bg-solid)",
								color: "var(--ui-neutral-fg-on-solid)",
								padding: "0.7rem 1.1rem",
								borderRadius: "0.65rem",
								fontWeight: 700,
							}}
						>
							Sponsor me on GitHub
						</a>
					</section>

					{related.length > 0 && (
						<section css={{ display: "grid", gap: "1rem" }}>
							<h2 css={{ margin: 0, color: "var(--ui-neutral-fg-emphasis)", fontSize: "1.5rem" }}>
								Related tutorials
							</h2>
							<div
								css={{
									display: "grid",
									gap: "0.9rem",
									gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
								}}
							>
								{related.map((item) => (
									<article
										key={item.href}
										css={{
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "0.8rem",
											padding: "0.9rem",
											backgroundColor: "var(--ui-neutral-bg-tint)",
										}}
									>
										<a
											href={item.href}
											css={{
												fontSize: "1.05rem",
												fontWeight: 700,
												color: "var(--ui-accent-fg)",
											}}
										>
											{item.label}
										</a>
										<p css={{ margin: "0.6rem 0 0", color: "var(--ui-neutral-fg)" }}>
											{item.reason}
										</p>
									</article>
								))}
							</div>
						</section>
					)}

					<dl
						css={{
							margin: 0,
							display: "grid",
							gridTemplateColumns: "max-content 1fr",
							gap: "0.5rem 0.9rem",
							padding: "0.9rem 1rem",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "0.6rem",
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						}}
					>
						<dt css={{ fontWeight: 700, color: "var(--ui-neutral-fg)" }}>Type</dt>
						<dd css={{ margin: 0 }}>{typePath}</dd>
						<dt css={{ fontWeight: 700, color: "var(--ui-neutral-fg)" }}>Slug</dt>
						<dd css={{ margin: 0 }}>{slug}</dd>
						<dt css={{ fontWeight: 700, color: "var(--ui-neutral-fg)" }}>Format</dt>
						<dd css={{ margin: 0 }}>{fileFormat}</dd>
						{publishedAt && (
							<>
								<dt css={{ fontWeight: 700, color: "var(--ui-neutral-fg)" }}>Published</dt>
								<dd css={{ margin: 0 }}>{formatDate(publishedAt)}</dd>
							</>
						)}
					</dl>
				</main>
			</BlogLayout>
		);
	};
}

export function ColorsPage() {
	return () => {
		let groups = [
			{ title: "Neutral", tokens: neutralColorTokens },
			{ title: "Accent", tokens: accentColorTokens },
			{ title: "UI Neutral", tokens: uiNeutralTokens },
			{ title: "UI Accent", tokens: uiAccentTokens },
		];

		return (
			<BlogLayout title="Color Palette" description="R3 Blog color tokens" activePath="/colors">
				<main css={{ display: "grid", gap: "1.2rem" }}>
					<h1 css={{ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" }}>
						R3 Blog Palette
					</h1>
					<p css={{ margin: 0, color: "var(--ui-neutral-fg)" }}>
						Color tokens from <code>colors.css</code> shown as 50x50 swatches.
					</p>

					<section
						css={{
							display: "grid",
							gap: "0.9rem",
							gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
						}}
					>
						<article
							css={{
								padding: "1rem",
								borderRadius: "0.8rem",
								backgroundColor: "var(--ui-neutral-bg-tint)",
								border: "1px solid var(--ui-neutral-border)",
								color: "var(--ui-neutral-fg)",
								display: "grid",
								gap: "0.65rem",
							}}
						>
							<h3 css={{ margin: 0, color: "var(--ui-neutral-fg-emphasis)", fontSize: "1.1rem" }}>
								Neutral UI Card
							</h3>
							<p css={{ margin: 0, color: "var(--ui-neutral-fg-muted)" }}>
								Uses tint, border, foreground, muted and emphasis variables.
							</p>
							<div css={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
								<span
									css={{
										padding: "0.3rem 0.5rem",
										backgroundColor: "var(--ui-neutral-bg-tint)",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "0.45rem",
									}}
								>
									Tint
								</span>
								<span
									css={{
										padding: "0.3rem 0.5rem",
										backgroundColor: "var(--ui-neutral-bg-tint-hover)",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "0.45rem",
									}}
								>
									Hover
								</span>
								<span
									css={{
										padding: "0.3rem 0.5rem",
										backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
										border: "1px solid var(--ui-neutral-border-strong)",
										borderRadius: "0.45rem",
									}}
								>
									Pressed
								</span>
							</div>
							<div
								css={{
									borderTop: "1px solid var(--ui-neutral-border-strong)",
									paddingTop: "0.6rem",
									display: "flex",
									gap: "0.45rem",
									flexWrap: "wrap",
								}}
							>
								<button
									type="button"
									css={{
										padding: "0.45rem 0.7rem",
										borderRadius: "0.5rem",
										border: "none",
										backgroundColor: "var(--ui-neutral-bg-solid)",
										color: "var(--ui-neutral-fg-on-solid)",
									}}
								>
									Solid
								</button>
								<button
									type="button"
									css={{
										padding: "0.45rem 0.7rem",
										borderRadius: "0.5rem",
										border: "none",
										backgroundColor: "var(--ui-neutral-bg-solid-hover)",
										color: "var(--ui-neutral-fg-on-solid)",
									}}
								>
									Hover
								</button>
								<button
									type="button"
									css={{
										padding: "0.45rem 0.7rem",
										borderRadius: "0.5rem",
										border: "none",
										backgroundColor: "var(--ui-neutral-bg-solid-pressed)",
										color: "var(--ui-neutral-fg-on-solid)",
									}}
								>
									Pressed
								</button>
								<span
									css={{
										marginLeft: "auto",
										padding: "0.45rem 0.7rem",
										borderRadius: "0.5rem",
										border: "1px solid var(--ui-neutral-border)",
										boxShadow: "0 0 0 3px var(--ui-neutral-ring)",
									}}
								>
									Ring
								</span>
							</div>
						</article>

						<article
							css={{
								padding: "1rem",
								borderRadius: "0.8rem",
								backgroundColor: "var(--ui-accent-bg-tint)",
								border: "1px solid var(--ui-accent-border)",
								color: "var(--ui-accent-fg)",
								display: "grid",
								gap: "0.65rem",
							}}
						>
							<h3 css={{ margin: 0, color: "var(--ui-accent-fg-emphasis)", fontSize: "1.1rem" }}>
								Accent UI Card
							</h3>
							<p css={{ margin: 0, color: "var(--ui-accent-fg-muted)" }}>
								Uses tint, border, foreground, muted and emphasis variables.
							</p>
							<div css={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
								<span
									css={{
										padding: "0.3rem 0.5rem",
										backgroundColor: "var(--ui-accent-bg-tint)",
										border: "1px solid var(--ui-accent-border)",
										borderRadius: "0.45rem",
									}}
								>
									Tint
								</span>
								<span
									css={{
										padding: "0.3rem 0.5rem",
										backgroundColor: "var(--ui-accent-bg-tint-hover)",
										border: "1px solid var(--ui-accent-border)",
										borderRadius: "0.45rem",
									}}
								>
									Hover
								</span>
								<span
									css={{
										padding: "0.3rem 0.5rem",
										backgroundColor: "var(--ui-accent-bg-tint-pressed)",
										border: "1px solid var(--ui-accent-border-strong)",
										borderRadius: "0.45rem",
									}}
								>
									Pressed
								</span>
							</div>
							<div
								css={{
									borderTop: "1px solid var(--ui-accent-border-strong)",
									paddingTop: "0.6rem",
									display: "flex",
									gap: "0.45rem",
									flexWrap: "wrap",
								}}
							>
								<button
									type="button"
									css={{
										padding: "0.45rem 0.7rem",
										borderRadius: "0.5rem",
										border: "none",
										backgroundColor: "var(--ui-accent-bg-solid)",
										color: "var(--ui-accent-fg-on-solid)",
									}}
								>
									Solid
								</button>
								<button
									type="button"
									css={{
										padding: "0.45rem 0.7rem",
										borderRadius: "0.5rem",
										border: "none",
										backgroundColor: "var(--ui-accent-bg-solid-hover)",
										color: "var(--ui-accent-fg-on-solid)",
									}}
								>
									Hover
								</button>
								<button
									type="button"
									css={{
										padding: "0.45rem 0.7rem",
										borderRadius: "0.5rem",
										border: "none",
										backgroundColor: "var(--ui-accent-bg-solid-pressed)",
										color: "var(--ui-accent-fg-on-solid)",
									}}
								>
									Pressed
								</button>
								<span
									css={{
										marginLeft: "auto",
										padding: "0.45rem 0.7rem",
										borderRadius: "0.5rem",
										border: "1px solid var(--ui-accent-border)",
										boxShadow: "0 0 0 3px var(--ui-accent-ring)",
									}}
								>
									Ring
								</span>
							</div>
						</article>
					</section>

					{groups.map((group) => (
						<section key={group.title} css={{ display: "grid", gap: "0.8rem" }}>
							<h2 css={{ margin: 0, fontSize: "1.35rem", color: "var(--ui-neutral-fg-emphasis)" }}>
								{group.title}
							</h2>
							<ul
								css={{
									margin: 0,
									padding: 0,
									listStyle: "none",
									display: "grid",
									gap: "0.7rem",
									gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
								}}
							>
								{group.tokens.map((token) => (
									<li
										key={token.name}
										css={{ display: "flex", alignItems: "center", gap: "0.65rem" }}
									>
										<span
											aria-hidden
											css={{
												display: "inline-block",
												width: "50px",
												height: "50px",
												backgroundColor: `var(${token.name})`,
												border: "1px solid var(--ui-neutral-border)",
												borderRadius: "0.35rem",
											}}
										/>
										<code css={{ color: "var(--ui-neutral-fg)" }}>{token.name}</code>
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
