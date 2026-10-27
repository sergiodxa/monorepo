/**
 * The parts of the résumé that read the same in every language: employers, dates, project
 * and talk links, contact details and the figures behind each project. A date in brackets is
 * one no public source confirms yet; each language's résumé adds its own words around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PROFILE } from "~/config/profile";

/** Where the résumé sends a reader who wants to reach the author. */
export const CONTACT_LINKS = {
	email: { href: `mailto:${PROFILE.email}`, text: PROFILE.email },
	website: { href: PROFILE.canonical.origin, text: "sergiodxa.com" },
	github: { href: PROFILE.github.profile, text: "github.com/sergiodxa" },
	linkedin: { href: "https://www.linkedin.com/in/sergiodxa/", text: "linkedin.com/in/sergiodxa" },
} as const;

/** Each employer's site and the years the author worked there, newest first. */
export const EMPLOYERS = {
	daffy: { company: "Daffy", href: "https://www.daffy.org", start: "2021" },
	able: { company: "Able", href: "https://able.co", start: "2018", end: "2021" },
	zeit: { company: "ZEIT", href: "https://vercel.com", start: "2017", end: "2018" },
	platzi: { company: "Platzi", href: "https://platzi.com", start: "2015", end: "2017" },
} as const;

/** Where each open-source project lives. */
export const PROJECT_LINKS = {
	remixUtils: "https://github.com/sergiodxa/remix-utils",
	remixAuth: "https://github.com/sergiodxa/remix-auth",
	remixI18next: "https://github.com/sergiodxa/remix-i18next",
	sdxc: "https://sdxc.dev",
} as const;

/**
 * The figures each project's line cites, read from GitHub and the npm registry in October
 * 2026 and rounded down, so every figure stays true as the numbers grow.
 */
export const PROJECT_FIGURES = {
	remixUtils: { stars: "2.3k", monthlyDownloads: "1.6M" },
	remixAuth: { stars: "2.2k", monthlyDownloads: "650k" },
	remixI18next: { stars: "700", monthlyDownloads: "700k" },
	sdxcPackages: "130+",
	combinedMonthlyDownloads: "3M",
} as const;

/** The talks the résumé lists, newest first. */
export const TALKS = {
	remixJam: {
		title: "The Remix Way",
		event: "Remix Jam 2026, Toronto",
		date: "2026",
		href: "https://www.youtube.com/watch?v=o07u1oKE6VA",
	},
	remixConfEurope: {
		title: "Remixing How We Give",
		event: "Remix Conf Europe 2022",
		date: "2022",
		href: "https://www.youtube.com/watch?v=eh6FfHFpYMM",
	},
} as const;

/**
 * Where a résumé's PDF is served, so the page's download link and the command writing the
 * file agree on one path.
 *
 * @param locale The résumé's language.
 * @returns The PDF's path and the name a download saves it under.
 */
export function pdfFor(locale: string): { href: string; filename: string } {
	let filename = `sergio-xalambri-resume-${locale}.pdf`;
	return { href: `/resume/${filename}`, filename };
}
