/**
 * View for the résumé: a header with the author's name, contact links and the PDF download,
 * then the summary, experience as a timeline, open-source projects with their reach, talks,
 * skills, education and languages, in either language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, gridTemplate, hstack, repeat, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, maxIs, minIs, p, pb, pis } from "@sdxc/u/size";
import { balance, leading, overflowWrap, text, tracking, weight } from "@sdxc/u/typography";
import { Badge, Heading, Link, LinkButton } from "@sdxc/ui";

import type { Resume } from "~/app/services/resume";

import { period } from "~/app/services/resume";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * Types used by the résumé renderer.
 */
export namespace ResumeView {
	/** Data required to render the page. */
	export interface Model {
		resume: Resume;
	}

	/** Props of a titled section of the résumé. */
	export interface SectionProps {
		id: string;
		title: string;
		children?: RemixNode;
	}
}

/** The résumé's URL in `locale`, which a shared link keeps regardless of the reader's browser. */
function resumeHref(locale: string): string {
	return `${routes.resume.href()}?lang=${locale}`;
}

/**
 * A section of the résumé with a heading the page's outline lists. Each anchors on its `id`,
 * so a link can point a recruiter at one part.
 */
function Section(handle: Handle<ResumeView.SectionProps>) {
	return () => {
		let { id, title, children } = handle.props;
		return (
			<section aria-labelledby={id} mix={[grid(), gap(4), minIs(0)]}>
				<Heading
					level={2}
					id={id}
					mix={[
						m(0),
						pb(2),
						text("sm"),
						weight("semibold"),
						tracking("wide"),
						fg("neutral.muted"),
						borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
						raw({ textTransform: "uppercase" }),
					]}
				>
					{title}
				</Heading>
				{children}
			</section>
		);
	};
}

/**
 * The header: name, headline and location, the ways to reach the author, and the PDF
 * download beside the language switcher and the Markdown twin.
 */
function Header(handle: Handle<{ resume: Resume }>) {
	return () => {
		let { resume } = handle.props;
		let { labels } = resume;

		return (
			<header mix={[grid(), gap(5)]}>
				<div mix={[grid(), gap(2)]}>
					<Heading level={1} mix={[m(0), text("5xl"), tracking("tight"), balance()]}>
						{resume.name}
					</Heading>
					<p mix={[m(0), text("xl"), fg("neutral.muted"), balance()]}>
						{resume.headline} · {resume.location}
					</p>
				</div>

				<ul
					aria-label={labels.contact}
					mix={[
						m(0),
						p(0),
						hstack({ gap: 4, align: "center" }),
						flexWrap("wrap"),
						raw({ listStyle: "none" }),
					]}
				>
					{resume.contact.map((item) => (
						<li key={item.href} mix={[overflowWrap("anywhere")]}>
							<Link href={item.href} aria-label={`${item.label}: ${item.text}`}>
								{item.text}
							</Link>
						</li>
					))}
				</ul>

				<p mix={[m(0), text("lg"), leading("relaxed"), maxIs("65ch")]}>{resume.summary}</p>

				<div mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap")]}>
					<LinkButton
						href={resume.pdf.href}
						download={resume.pdf.filename}
						type="application/pdf"
						color="brand"
					>
						{labels.downloadPdf}
					</LinkButton>
					<LinkButton
						href={resumeHref(resume.otherLanguage.locale)}
						hreflang={resume.otherLanguage.locale}
						lang={resume.otherLanguage.locale}
						variant="outline"
					>
						{resume.otherLanguage.label}
					</LinkButton>
					<Link href={`${routes.resumeMarkdown.href()}?lang=${resume.locale}`} mix={[text("sm")]}>
						{labels.viewMarkdown}
					</Link>
				</div>
			</header>
		);
	};
}

/**
 * One position: its dates in a column of their own on a wide screen, then the title, the
 * company with its earlier name, and what the work achieved.
 */
function RoleEntry(handle: Handle<{ role: Resume.Role; present: string }>) {
	return () => {
		let { role, present } = handle.props;

		return (
			<li
				mix={[
					grid(),
					gap(2),
					minIs(0),
					at("md", gridTemplate({ columns: "9rem minmax(0, 1fr)" })),
					at("md", gap(6)),
				]}
			>
				<span
					mix={[text("sm"), fg("neutral.muted"), weight("medium"), raw({ whiteSpace: "nowrap" })]}
				>
					{period(role, present)}
				</span>
				<div mix={[grid(), gap(2), minIs(0)]}>
					<Heading level={3} mix={[m(0), text("lg")]}>
						{role.role}
						<span mix={[weight("normal"), fg("neutral.muted")]}>
							{" · "}
							<Link href={role.href}>{role.company}</Link>
							{role.formerly ? ` (${role.formerly})` : null}
						</span>
					</Heading>
					<ul
						mix={[m(0), pis(5), grid(), gap(1), leading("relaxed"), raw({ listStyleType: "disc" })]}
					>
						{role.highlights.map((highlight) => (
							<li key={highlight}>{highlight}</li>
						))}
					</ul>
				</div>
			</li>
		);
	};
}

/**
 * The page.
 *
 * @returns View function rendering the résumé in its language.
 */
export function ResumeView() {
	return ({ model, assets }: { model: ResumeView.Model; assets: DocumentAssets }) => {
		let { resume } = model;
		let { labels } = resume;

		return (
			<BlogLayout
				assets={assets}
				locale={resume.locale}
				title={resume.title}
				description={resume.description}
			>
				<main mix={[grid(), gap(12), minIs(0)]}>
					<Header resume={resume} />

					<Section id="experience" title={labels.experience}>
						<ol mix={[m(0), p(0), grid(), gap(8), raw({ listStyle: "none" })]}>
							{resume.experience.map((role) => (
								<RoleEntry key={role.company} role={role} present={labels.present} />
							))}
						</ol>
					</Section>

					<Section id="open-source" title={labels.openSource}>
						<ul
							mix={[
								m(0),
								p(0),
								grid(),
								gap(3),
								gridTemplate({ columns: repeat("auto-fill", "minmax(min(100%, 16rem), 1fr)") }),
								raw({ listStyle: "none" }),
							]}
						>
							{resume.openSource.map((project) => (
								<li
									key={project.name}
									mix={[
										vstack({ gap: 2 }),
										p(4),
										rounded("lg"),
										border({ width: 1, color: "neutral" }),
										bg("neutral.bg-tint-hover"),
									]}
								>
									<Link href={project.href} mix={[weight("semibold")]}>
										{project.name}
									</Link>
									<span mix={[text("sm")]}>{project.detail}</span>
									{project.metric ? (
										<span>
											<Badge variant="secondary">{project.metric}</Badge>
										</span>
									) : null}
								</li>
							))}
						</ul>
						<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{labels.metricsNote}</p>
					</Section>

					<Section id="speaking" title={labels.speaking}>
						<ul mix={[m(0), p(0), grid(), gap(3), raw({ listStyle: "none" })]}>
							{resume.speaking.map((talk) => (
								<li
									key={talk.href}
									mix={[
										hstack({ gap: 2, align: "baseline", justify: "between" }),
										flexWrap("wrap"),
									]}
								>
									<span>
										<Link href={talk.href} mix={[weight("medium")]}>
											{talk.title}
										</Link>
										<span mix={[fg("neutral.muted")]}> · {talk.event}</span>
									</span>
									<span mix={[text("sm"), fg("neutral.muted")]}>{talk.date}</span>
								</li>
							))}
						</ul>
					</Section>

					<Section id="skills" title={labels.skills}>
						<dl mix={[m(0), grid(), gap(3)]}>
							{resume.skills.map((group) => (
								<div
									key={group.label}
									mix={[
										grid(),
										gap(1),
										at("md", gridTemplate({ columns: "12rem minmax(0, 1fr)" })),
										at("md", gap(6)),
									]}
								>
									<dt mix={[weight("semibold")]}>{group.label}</dt>
									<dd mix={[m(0), leading("relaxed")]}>{group.items}</dd>
								</div>
							))}
						</dl>
					</Section>

					<div
						mix={[
							grid(),
							gap(12),
							at("md", gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") })),
						]}
					>
						<Section id="education" title={labels.education}>
							{resume.education.map((entry) => (
								<p key={entry.title} mix={[m(0), leading("relaxed")]}>
									<strong>{entry.title}.</strong> {entry.detail}
								</p>
							))}
						</Section>

						<Section id="languages" title={labels.languages}>
							<ul mix={[m(0), p(0), grid(), gap(1), raw({ listStyle: "none" })]}>
								{resume.languages.map((language) => (
									<li key={language.name}>
										<strong>{language.name}</strong>
										<span mix={[fg("neutral.muted")]}> · {language.level}</span>
									</li>
								))}
							</ul>
						</Section>
					</div>
				</main>
			</BlogLayout>
		);
	};
}
