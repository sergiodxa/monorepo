/**
 * View for the about page: a portrait beside the greeting, a row of figures, what the author
 * works on now, his story with a timeline of milestones, what he cares about, his open-source
 * projects and the ways to work with him, in either language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import {
	absolute,
	container,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	hstack,
	insIs,
	insTop,
	items,
	relative,
	repeat,
	vstack,
} from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import {
	aspect,
	bleed,
	circle,
	fit,
	is,
	m,
	maxIs,
	minIs,
	p,
	pb,
	pbe,
	pi,
	pis,
	width,
} from "@sdxc/u/size";
import {
	balance,
	leading,
	pretty,
	tabularNums,
	text,
	textTransform,
	tracking,
	weight,
} from "@sdxc/u/typography";
import { Badge, Heading, Link, LinkButton } from "@sdxc/ui";

import type { AboutPage } from "~/app/services/about-page";

import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * Types used by the about page renderer.
 */
export namespace AboutView {
	/** Data required to render the page. */
	export interface Model {
		page: AboutPage;
	}

	/** Props of a titled section of the page. */
	export interface SectionProps {
		id: string;
		title: string;
		/** A line under the title, such as how the author answers messages. */
		note?: string;
		children?: RemixNode;
	}
}

/** The page's URL in `locale`, which a shared link keeps regardless of the reader's browser. */
function pageHref(locale: string): string {
	return `${routes.about.href()}?lang=${locale}`;
}

/** A link's URL as a reader would type it: no scheme, no `www.`, no trailing slash. */
function displayUrl(href: string): string {
	let url = new URL(href);
	return `${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
}

/**
 * A section of the page: a heading the page's outline lists, an optional note, and its
 * content. Each anchors on its `id`, so a link can point a reader at one part.
 */
function Section(handle: Handle<AboutView.SectionProps>) {
	return () => {
		let { id, title, note, children } = handle.props;
		return (
			<section aria-labelledby={id} id={`${id}-section`} mix={[grid(), gap(5), minIs(0)]}>
				<div mix={[grid(), gap(1)]}>
					<Heading level={2} id={id} mix={[m(0), text("2xl")]}>
						{title}
					</Heading>
					{note ? <p mix={[m(0), fg("neutral.muted")]}>{note}</p> : null}
				</div>
				{children}
			</section>
		);
	};
}

/**
 * The hero: the portrait on a brand-tinted disc, then the name, tagline, greeting and quick
 * facts. The portrait comes first so it leads on a phone, and sits beside the text on wider
 * screens.
 */
function Hero(handle: Handle<{ page: AboutPage }>) {
	return () => {
		let { page } = handle.props;
		let portrait = page.portrait;

		return (
			<header mix={[grid(), gap(6)]}>
				<div mix={[hstack({ gap: 4, justify: "end", align: "center" }), flexWrap("wrap")]}>
					<Link
						href={pageHref(page.otherLanguage.locale)}
						hreflang={page.otherLanguage.locale}
						lang={page.otherLanguage.locale}
						mix={[text("sm")]}
					>
						{page.otherLanguage.label}
					</Link>
					<Link href={`${routes.aboutMarkdown.href()}?lang=${page.locale}`} mix={[text("sm")]}>
						{page.labels.viewMarkdown}
					</Link>
				</div>

				<div
					mix={[
						grid(),
						gap(6),
						at("md", gridTemplate({ columns: "auto minmax(0, 1fr)" })),
						at("md", gap(10)),
						at("md", items("center")),
					]}
				>
					<img
						src={portrait.src}
						alt={portrait.alt}
						width={portrait.width}
						height={portrait.height}
						mix={[
							circle(),
							is(32),
							at("md", is(48)),
							bg("brand.tint"),
							border({ width: 4, color: "brand" }),
							shadow("lg"),
							fit("cover"),
						]}
					/>
					<div mix={[grid(), gap(3), minIs(0)]}>
						<p
							mix={[
								m(0),
								text("sm"),
								weight("semibold"),
								tracking("wide"),
								fg("brand.emphasis"),
								textTransform("uppercase"),
							]}
						>
							{page.title}
						</p>
						<Heading level={1} mix={[m(0), text("5xl"), tracking("tight"), balance()]}>
							Sergio Xalambrí
						</Heading>
						<p mix={[m(0), text("xl"), fg("neutral.muted"), balance()]}>{page.tagline}</p>
					</div>
				</div>

				<div mix={[grid(), gap(4), maxIs("65ch")]}>
					{page.intro.map((paragraph) => (
						<p mix={[m(0), text("lg"), leading("relaxed"), pretty()]}>{paragraph}</p>
					))}
				</div>

				<dl mix={[m(0), hstack({ gap: 2 }), flexWrap("wrap")]}>
					{page.facts.map((fact) => (
						<div
							key={fact.label}
							mix={[
								hstack({ gap: 2, align: "baseline" }),
								pi(3),
								pb(1),
								rounded("full"),
								border({ width: 1, color: "neutral" }),
								bg("neutral.bg-tint-hover"),
								text("sm"),
							]}
						>
							<dt mix={[fg("neutral.muted")]}>{fact.label}</dt>
							<dd mix={[m(0), weight("medium")]}>{fact.value}</dd>
						</div>
					))}
				</dl>

				<div mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap")]}>
					<LinkButton href={routes.articles.href()} color="brand">
						{page.labels.readPosts}
					</LinkButton>
					<LinkButton href={`${routes.press.index.href()}?lang=${page.locale}`} variant="outline">
						{page.labels.pressKit}
					</LinkButton>
				</div>
			</header>
		);
	};
}

/** The figures as a row of tiles, each number large in the brand color above what it counts. */
function Stats(handle: Handle<{ stats: ReadonlyArray<AboutPage.Stat> }>) {
	return () => (
		<dl
			mix={[
				m(0),
				grid(),
				gap(3),
				gridTemplate({ columns: repeat("auto-fit", "minmax(min(100%, 9rem), 1fr)") }),
			]}
		>
			{handle.props.stats.map((stat) => (
				<div
					key={stat.label}
					mix={[
						vstack({ gap: 1 }),
						p(4),
						rounded("lg"),
						border({ width: 1, color: "neutral" }),
						bg("neutral.bg-tint-hover"),
					]}
				>
					<dd
						mix={[
							m(0),
							text("4xl"),
							weight("bold"),
							tracking("tight"),
							tabularNums(),
							fg("brand.emphasis"),
						]}
					>
						{stat.value}
					</dd>
					<dt mix={[text("sm"), fg("neutral.muted"), pretty()]}>{stat.label}</dt>
				</div>
			))}
		</dl>
	);
}

/**
 * The milestones as a vertical line of dated stops, newest last, so the list reads in the
 * order the story above it tells.
 */
function Timeline(handle: Handle<{ milestones: ReadonlyArray<AboutPage.Milestone> }>) {
	return () => (
		<ol
			mix={[
				m(0),
				p(0),
				grid(),
				gap(5),
				pis(6),
				borderEdge("inline-start", { color: "brand.border", width: 2, style: "solid" }),
				raw({ listStyle: "none" }),
			]}
		>
			{handle.props.milestones.map((milestone) => (
				<li key={milestone.year} mix={[relative(), grid(), gap(1)]}>
					<span
						aria-hidden="true"
						mix={[
							absolute(),
							circle(),
							is(3),
							insIs(-7.5),
							insTop(1.5),
							bg("brand.solid"),
							border({ width: 2, color: "neutral.bg" }),
						]}
					/>
					<div mix={[hstack({ gap: 2, align: "baseline" }), flexWrap("wrap")]}>
						<span mix={[weight("bold"), tabularNums(), fg("brand.emphasis")]}>
							{milestone.year}
						</span>
						<span mix={[weight("semibold")]}>{milestone.title}</span>
					</div>
					<span mix={[text("sm"), fg("neutral.muted")]}>{milestone.detail}</span>
				</li>
			))}
		</ol>
	);
}

/**
 * The page.
 *
 * @returns View function rendering the about page in the model's language.
 */
export function AboutView() {
	return ({ model, assets }: { model: AboutView.Model; assets: DocumentAssets }) => {
		let { page } = model;
		let labels = page.labels;

		return (
			<BlogLayout
				assets={assets}
				locale={page.locale}
				title={page.title}
				description={page.description}
			>
				<main mix={[container("about"), grid(), gap(12), minIs(0)]}>
					<Hero page={page} />

					<Stats stats={page.stats} />

					<Section id="now" title={labels.now}>
						<ul
							mix={[
								m(0),
								p(0),
								grid(),
								gap(3),
								at("md", gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") })),
								raw({ listStyle: "none" }),
							]}
						>
							{page.now.map((focus) => (
								<li
									key={focus.title}
									mix={[
										grid(),
										gap(1),
										p(5),
										rounded("lg"),
										border({ width: 1, color: "neutral" }),
										raw({ alignContent: "start" }),
									]}
								>
									{focus.href ? (
										<Link href={focus.href} mix={[weight("semibold"), text("lg")]}>
											{focus.title}
										</Link>
									) : (
										<span mix={[weight("semibold"), text("lg")]}>{focus.title}</span>
									)}
									<span mix={[fg("neutral.muted"), pretty()]}>{focus.detail}</span>
								</li>
							))}
						</ul>
					</Section>

					<Section id="story" title={labels.story}>
						<div mix={[grid(), gap(4), maxIs("65ch")]}>
							{page.story.map((paragraph) => (
								<p mix={[m(0), leading("relaxed"), pretty()]}>{paragraph}</p>
							))}
						</div>
						<div mix={[grid(), gap(4)]}>
							<Heading level={3} mix={[m(0), text("lg")]}>
								{labels.timeline}
							</Heading>
							<Timeline milestones={page.timeline} />
						</div>
					</Section>

					<figure mix={[m(0), grid(), gap(3), bleed(4)]}>
						<img
							src={page.feature.src}
							alt={page.feature.alt}
							width={page.feature.width}
							height={page.feature.height}
							loading="lazy"
							mix={[
								width("100%"),
								aspect("widescreen"),
								rounded("xl"),
								shadow("md"),
								fit("cover"),
								raw({ display: "block" }),
							]}
						/>
						<figcaption mix={[pi(4), text("sm"), fg("neutral.muted")]}>
							{page.feature.caption}
						</figcaption>
					</figure>

					<Section id="values" title={labels.values}>
						<ol
							mix={[
								m(0),
								p(0),
								grid(),
								gap(3),
								gridTemplate({ columns: repeat("auto-fit", "minmax(min(100%, 14rem), 1fr)") }),
								raw({ listStyle: "none" }),
							]}
						>
							{page.values.map((value, index) => (
								<li
									key={value.title}
									mix={[
										grid(),
										gap(2),
										p(5),
										rounded("lg"),
										border({ width: 1, color: "brand" }),
										bg("brand.tint"),
										raw({ alignContent: "start" }),
									]}
								>
									<span
										aria-hidden="true"
										mix={[text("sm"), weight("bold"), tabularNums(), fg("brand.emphasis")]}
									>
										{String(index + 1).padStart(2, "0")}
									</span>
									<span mix={[weight("semibold"), text("lg"), fg("brand.emphasis")]}>
										{value.title}
									</span>
									<span mix={[text("sm"), leading("relaxed"), pretty()]}>{value.detail}</span>
								</li>
							))}
						</ol>
					</Section>

					<Section id="projects" title={labels.projects}>
						<ul mix={[m(0), p(0), grid(), raw({ listStyle: "none" })]}>
							{page.projects.map((project) => (
								<li
									key={project.name}
									mix={[
										grid(),
										gap(1),
										pbe(3),
										m(0),
										borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
										at("md", gridTemplate({ columns: "13rem minmax(0, 1fr)" })),
										at("md", gap(4)),
									]}
								>
									<div mix={[hstack({ gap: 2, align: "center" })]}>
										<Link href={project.href} mix={[weight("semibold")]}>
											{project.name}
										</Link>
										<Badge variant="outline">{project.since}</Badge>
									</div>
									<span mix={[fg("neutral.muted")]}>{project.description}</span>
								</li>
							))}
						</ul>
					</Section>

					<section
						aria-labelledby="connect"
						mix={[
							grid(),
							gap(5),
							p(5),
							bleed(4),
							minIs(0),
							border({ width: 1, color: "neutral" }),
							rounded("xl"),
							bg("neutral.bg-tint-hover"),
						]}
					>
						<div mix={[vstack({ gap: 1 })]}>
							<Heading level={2} id="connect" mix={[m(0), text("2xl")]}>
								{labels.connect}
							</Heading>
							<p mix={[m(0), fg("neutral.muted")]}>{labels.connectNote}</p>
						</div>
						<ul
							mix={[
								m(0),
								p(0),
								grid(),
								gap(4),
								gridTemplate({ columns: repeat("auto-fit", "minmax(min(100%, 13rem), 1fr)") }),
								raw({ listStyle: "none" }),
							]}
						>
							{page.connect.map((invitation) => (
								<li
									key={invitation.title}
									mix={[
										grid(),
										gap(2),
										p(4),
										rounded("lg"),
										bg("neutral.bg"),
										border({ width: 1, color: "neutral" }),
										gridTemplate({ rows: "auto 1fr auto" }),
									]}
								>
									<span mix={[weight("semibold")]}>{invitation.title}</span>
									<span mix={[text("sm"), fg("neutral.muted"), pretty()]}>{invitation.detail}</span>
									<LinkButton href={invitation.href} size="sm" variant="outline">
										{invitation.action}
									</LinkButton>
								</li>
							))}
						</ul>
					</section>

					<Section id="links" title={labels.links}>
						<ul
							mix={[m(0), p(0), hstack({ gap: 5 }), flexWrap("wrap"), raw({ listStyle: "none" })]}
						>
							{page.links.map((link) => (
								<li key={link.href}>
									<Link href={link.href} mix={[weight("medium")]}>
										{link.label}
									</Link>{" "}
									<span mix={[text("sm"), fg("neutral.muted")]}>{displayUrl(link.href)}</span>
								</li>
							))}
						</ul>
					</Section>
				</main>
			</BlogLayout>
		);
	};
}
