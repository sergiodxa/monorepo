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
	content: MarkdownView.Content | null;
	format?: string;
	publishedAt?: string | null;
	tags?: Array<string>;
	related?: Array<{ href: string; label: string; reason: string }>;
}

function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
}

export function FeedPage() {
	return ({ activity }: FeedPageProps) => (
		<BlogLayout title="Sergio Xalambrí" description="Sergio Xalambrí" activePath="/">
			<main css={{ display: "grid", gap: "0.95rem" }}>
				<h1 css={{ fontSize: "2.2rem", margin: 0, lineHeight: 1.05, color: "#242019" }}>
					Sergio Xalambrí
				</h1>
				<p
					css={{
						margin: 0,
						color: "#4b4338",
						maxWidth: "60ch",
						fontSize: "1.08rem",
						lineHeight: 1.4,
					}}
				>
					Web Developer from Buenos Aires with 10+ years of experience. I work at
					<strong> Daffy</strong> and maintain several open-source libraries around React Router and
					OAuth2.
				</p>
				<p css={{ margin: "0.2rem 0 0", color: "#4b4338", fontSize: "1.05rem" }}>
					Subscribe to my content using <a href="/atom.xml">RSS</a>.
				</p>

				<h2 css={{ margin: "0.5rem 0 0", fontSize: "1.4rem", color: "#2d271f" }}>Activity</h2>

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
							<p css={{ margin: 0, fontSize: "1.05rem", color: "#1a1917", lineHeight: 1.4 }}>
								<a href={item.href}>{item.label}</a>
								{item.preview && (
									<span css={{ marginLeft: "0.4rem", fontSize: "0.85rem", color: "#7c2d12" }}>
										Preview
									</span>
								)}
							</p>
							<time
								css={{
									color: "#7a6f5f",
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
					<h1 css={{ margin: 0, fontSize: "2rem", color: "#242019" }}>{title}</h1>
					{actionHref && actionLabel && (
						<a
							href={actionHref}
							css={{
								backgroundColor: "#1f4f62",
								color: "#fff",
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
						color: "#4b4338",
						maxWidth: "52ch",
						fontSize: "1.05rem",
						lineHeight: 1.35,
					}}
				>
					{description}
				</p>
				<p css={{ margin: 0, color: "#4b4338", fontSize: "1.05rem" }}>
					Subscribe to my {title.toLowerCase()} using <a href={rssPath}>RSS</a>.
				</p>
				{items.length === 0 ? (
					<p css={{ margin: 0, color: "#4b4338" }}>{emptyLabel}</p>
				) : (
					<ul
						css={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem" }}
					>
						{items.map((item) => (
							<li key={item.href} css={{ fontSize: "1.05rem", lineHeight: 1.25 }}>
								<a href={item.href} css={{ color: "#1c4f65" }}>
									{item.label}
								</a>
								{item.suffixHref && item.suffixLabel && (
									<>
										{" - "}
										<a href={item.suffixHref} css={{ color: "#1c4f65" }}>
											({item.suffixLabel})
										</a>
									</>
								)}
								{item.preview && (
									<span css={{ marginLeft: "0.35rem", color: "#7c2d12", fontSize: "0.8rem" }}>
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
				<h1 css={{ margin: 0, fontSize: "2rem", color: "#242019" }}>Glossary</h1>
				<p
					css={{
						margin: 0,
						color: "#4b4338",
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
								backgroundColor: "#fbf6eb",
								":target": {
									borderColor: "#bea98a",
									backgroundColor: "#f8f3e7",
								},
							}}
						>
							<dt css={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#242019" }}>
								<a href={`#${item.slug}`} css={{ color: "inherit", textDecoration: "none" }}>
									{item.term}
									{item.title && (
										<small css={{ marginLeft: "0.45rem", color: "#6b6257", fontSize: "0.9rem" }}>
											(aka {item.title})
										</small>
									)}
								</a>
							</dt>
							<dd
								css={{
									margin: "0.4rem 0 0",
									color: "#2f2a24",
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
										backgroundColor: "#dbeafe",
										color: "#075985",
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
							color: "#6e6558",
							fontWeight: 700,
						}}
					>
						{eyebrow}
					</p>
					<h1 css={{ margin: 0, fontSize: "2.1rem", lineHeight: 1.05, color: "#242019" }}>
						{title}
					</h1>

					<article
						css={{
							lineHeight: 1.7,
							color: "#2f2a24",
							fontSize: "1rem",
							padding: "1rem 1.1rem",
							border: "1px solid #d8c9b1",
							borderRadius: "0.6rem",
							backgroundColor: "#f9f3e7",
							margin: "0 -1.1rem",
						}}
					>
						{content ? <MarkdownView content={content} /> : <p css={{ margin: 0 }}>No content.</p>}
					</article>

					<section
						css={{
							margin: "0 -1.1rem",
							padding: "1rem 1.1rem",
							border: "1px solid #b7d5e6",
							borderRadius: "0.8rem",
							backgroundColor: "#eaf2f8",
							display: "grid",
							gridTemplateColumns: "1fr auto",
							gap: "0.8rem",
							alignItems: "center",
						}}
					>
						<div>
							<p css={{ margin: 0, color: "#214a60", fontSize: "1rem", fontWeight: 700 }}>
								Do you like my content?
							</p>
							<p css={{ margin: "0.2rem 0 0", color: "#355a6d", fontSize: "1rem" }}>
								Your sponsorship helps me create more tutorials, articles, and open-source tools.
							</p>
						</div>
						<a
							href="https://github.com/sponsors/sergiodxa"
							css={{
								textDecoration: "none",
								backgroundColor: "#1f4f62",
								color: "#fff",
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
							<h2 css={{ margin: 0, color: "#2d271f", fontSize: "1.5rem" }}>Related tutorials</h2>
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
											border: "1px solid #d8c9b1",
											borderRadius: "0.8rem",
											padding: "0.9rem",
											backgroundColor: "#fbf6eb",
										}}
									>
										<a
											href={item.href}
											css={{ fontSize: "1.05rem", fontWeight: 700, color: "#1c4f65" }}
										>
											{item.label}
										</a>
										<p css={{ margin: "0.6rem 0 0", color: "#4b4338" }}>{item.reason}</p>
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
							border: "1px solid #d8c9b1",
							borderRadius: "0.6rem",
							backgroundColor: "#f9f3e7",
						}}
					>
						<dt css={{ fontWeight: 700, color: "#4f463a" }}>Type</dt>
						<dd css={{ margin: 0 }}>{typePath}</dd>
						<dt css={{ fontWeight: 700, color: "#4f463a" }}>Slug</dt>
						<dd css={{ margin: 0 }}>{slug}</dd>
						<dt css={{ fontWeight: 700, color: "#4f463a" }}>Format</dt>
						<dd css={{ margin: 0 }}>{fileFormat}</dd>
						{publishedAt && (
							<>
								<dt css={{ fontWeight: 700, color: "#4f463a" }}>Published</dt>
								<dd css={{ margin: 0 }}>{formatDate(publishedAt)}</dd>
							</>
						)}
					</dl>
				</main>
			</BlogLayout>
		);
	};
}
