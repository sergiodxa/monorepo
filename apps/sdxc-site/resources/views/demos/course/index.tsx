/**
 * The course demo at `/demo/course`: a landing for Centered, an invented wheel-throwing
 * video course, centred on its curriculum and led by a lesson playing in a dark screening
 * stage set into a bright, friendly page of cobalt glaze and soft white.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import type { PaletteScale } from "~/resources/components/demo-theme";
import type { DemoLanding } from "~/resources/views/demos";

import DemoMiniature from "~/resources/components/demo-miniature";
import DemoTheme from "~/resources/components/demo-theme";
import { CourseCertificate } from "~/resources/views/demos/course/certificate";
import { CourseFooter, CourseHeader } from "~/resources/views/demos/course/chrome";
import { CourseCurriculum } from "~/resources/views/demos/course/curriculum";
import { CourseHero } from "~/resources/views/demos/course/hero";
import { CourseInstructor } from "~/resources/views/demos/course/instructor";
import { CoursePath } from "~/resources/views/demos/course/path";
import { CoursePricing } from "~/resources/views/demos/course/pricing";
import { CourseClosing, CourseFaq, CourseRefunds } from "~/resources/views/demos/course/questions";
import CenteredThumbnail from "~/resources/views/demos/course/thumbnail";
import { CourseWork } from "~/resources/views/demos/course/work";

/** Cobalt glaze: a saturated blue that holds its colour from the wash to the ink. */
const COBALT: PaletteScale = [
	"oklch(0.985 0.012 262)",
	"oklch(0.955 0.03 262)",
	"oklch(0.9 0.06 262)",
	"oklch(0.81 0.1 262)",
	"oklch(0.71 0.15 262)",
	"oklch(0.61 0.19 262)",
	"oklch(0.52 0.2 262)",
	"oklch(0.43 0.18 262)",
	"oklch(0.33 0.14 262)",
	"oklch(0.245 0.1 262)",
	"oklch(0.165 0.06 262)",
];

/** Cool, clean greys with a breath of the cobalt, so the bright page stays crisp. */
const STUDIO_GREY: PaletteScale = [
	"oklch(0.985 0.003 262)",
	"oklch(0.955 0.005 262)",
	"oklch(0.9 0.007 262)",
	"oklch(0.81 0.009 262)",
	"oklch(0.71 0.011 262)",
	"oklch(0.61 0.013 262)",
	"oklch(0.52 0.014 262)",
	"oklch(0.43 0.014 262)",
	"oklch(0.33 0.013 262)",
	"oklch(0.245 0.012 262)",
	"oklch(0.165 0.01 262)",
];

/** A geometric, friendly sans from the platform's own fonts. */
const SANS =
	"'Avenir Next', Avenir, 'Segoe UI Variable', 'Segoe UI', ui-sans-serif, system-ui, sans-serif";

/** A soft lift for cards: contact shadow and a wide cobalt-tinted bloom. */
const LIFT = "0 1px 2px oklch(0.3 0.08 262 / 0.06), 0 12px 32px -12px oklch(0.3 0.08 262 / 0.16)";

/**
 * Bright and friendly around a cinema screen: heavy geometric display, rounded but not
 * pill corners, cobalt eyebrows in sentence case, soft lifted cards and a pale cobalt tint
 * on alternate bands.
 */
const TOKENS = {
	"--ui-font-sans": SANS,
	"--ui-font-display": SANS,
	"--ui-landing-display-weight": "750",
	"--ui-landing-display-tracking": "-0.035em",
	"--ui-landing-display-max": "4.5rem",
	"--ui-landing-chapter-tracking": "-0.03em",
	"--ui-landing-cta-radius": "0.75rem",
	"--ui-landing-cta-weight": "650",
	"--ui-button-radius": "0.75rem",
	"--ui-landing-eyebrow-font": SANS,
	"--ui-landing-eyebrow-transform": "none",
	"--ui-landing-eyebrow-tracking": "0",
	"--ui-landing-eyebrow-weight": "650",
	"--ui-landing-eyebrow-color": "var(--ui-brand-fg)",
	"--ui-landing-radius-surface": "1rem",
	"--ui-landing-card-radius-outer": "1rem",
	"--ui-landing-card-radius-inner": "0.625rem",
	"--ui-landing-radius-frame": "1.25rem",
	"--ui-landing-band-radius": "1.5rem",
	"--ui-shadow-surface": LIFT,
	"--ui-landing-band-tint": "var(--ui-color-brand-50)",
} as const;

/** What `/demo/course` serves: Centered's head metadata and its whole page. */
export default {
	title: "Centered — Wheel-throwing, from a lump of clay to a lidded jar",
	kind: "Course landing",
	tagline: "A wheel-throwing video course.",
	artDirection: "Bright page, dark screening room, cobalt glaze.",
	description:
		"Centered is a video course in wheel-throwing pottery: 24 lessons in six modules with chapters and transcripts, self-paced or with a cohort, ending in a lidded jar.",
	thumbnail: () => (
		<DemoMiniature brand={COBALT} neutral={STUDIO_GREY} tokens={TOKENS}>
			<CenteredThumbnail />
		</DemoMiniature>
	),
	render: () => (
		<DemoTheme brand={COBALT} neutral={STUDIO_GREY} tokens={TOKENS}>
			<CourseHeader />
			<main mix={[when("& [id]", raw({ scrollMarginBlockStart: "5rem" }))]}>
				<CourseHero />
				<CourseCurriculum />
				<CoursePath />
				<CourseInstructor />
				<CourseWork />
				<CoursePricing />
				<CourseCertificate />
				<CourseRefunds />
				<CourseFaq />
				<CourseClosing />
			</main>
			<CourseFooter />
		</DemoTheme>
	),
} satisfies DemoLanding;
