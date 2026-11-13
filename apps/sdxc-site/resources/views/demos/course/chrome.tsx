/**
 * Centered's page chrome: the wordmark, a header linking the page's sections with the one
 * enrol call, and a footer of the same sections with the course's small print, so every
 * link on the page lands on a section of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { DialogDismiss } from "@sdxc/ui";
import { SiteFooter, SiteHeader } from "@sdxc/ui/landing";

/** The header's sections, in page order. */
const SECTIONS: SiteHeader.Link[] = [
	{ href: "#curriculum", label: "Curriculum" },
	{ href: "#instructor", label: "Instructor" },
	{ href: "#work", label: "Student work" },
	{ href: "#pricing", label: "Pricing" },
	{ href: "#faq", label: "FAQ" },
];

/** The footer's columns, each a title over links to this page's sections. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "The course",
		links: [
			{ href: "#preview", label: "Watch a lesson" },
			{ href: "#curriculum", label: "Curriculum" },
			{ href: "#path", label: "What you'll throw" },
			{ href: "#certificate", label: "Certificate" },
		],
	},
	{
		title: "Enrolling",
		links: [
			{ href: "#pricing", label: "Self-paced or cohort" },
			{ href: "#pricing", label: "Team seats" },
			{ href: "#refunds", label: "Refunds" },
		],
	},
	{
		title: "People",
		links: [
			{ href: "#instructor", label: "About Ines" },
			{ href: "#work", label: "Student work" },
			{ href: "#work", label: "Who finishes" },
		],
	},
	{
		title: "Help",
		links: [
			{ href: "#faq", label: "Questions" },
			{ href: "#faq", label: "Clay and kit" },
			{ href: "#enroll", label: "Start now" },
		],
	},
];

/**
 * The wordmark: a wheel seen from above, a dot of clay dead on its center, beside the name.
 *
 * @returns The render function producing the wordmark.
 */
export function CenteredLogo() {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
					fontFamily: "var(--ui-font-display)",
					fontWeight: "750",
					fontSize: "1.1875rem",
					letterSpacing: "-0.03em",
					color: "var(--ui-neutral-fg-emphasis)",
				}),
			]}
		>
			<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
				<circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--ui-brand-fg)" stroke-width="2" />
				<circle
					cx="14"
					cy="14"
					r="7"
					fill="none"
					stroke="var(--ui-brand-fg)"
					stroke-width="2"
					stroke-opacity="0.45"
				/>
				<circle cx="14" cy="14" r="3" fill="oklch(0.6 0.13 45)" />
			</svg>
			Centered
		</span>
	);
}

/**
 * The header: wordmark, five sections from the `lg` container and the enrol call; below it
 * the sections fold into a sheet that closes when a link is followed.
 *
 * @returns The render function producing the header.
 */
export function CourseHeader() {
	return () => (
		<SiteHeader
			id="course-header"
			brand={<CenteredLogo />}
			items={SECTIONS}
			cta={{ href: "#pricing", label: "Enroll" }}
			navLabel="Sections"
			menuLabel="Open the section menu"
			closeLabel="Close the section menu"
			collapseAt="lg"
			sheet={<DialogDismiss />}
		/>
	);
}

/**
 * The footer: the wordmark and a line on the course, four columns of sections, and the
 * small print.
 *
 * @returns The render function producing the footer.
 */
export function CourseFooter() {
	return () => (
		<SiteFooter
			brand={<CenteredLogo />}
			tagline="Wheel-throwing, filmed close, taught in order. From a lump of clay to a lidded jar."
			columns={COLUMNS}
			legal="© 2026 Centered Studio. An invented course on sdxc.dev, for demonstration."
		/>
	);
}
