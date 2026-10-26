/**
 * The parts of the press kit that read the same in every language: the photo files, profile
 * links, project URLs and past appearances, whose titles stay in the language they were
 * given in. Each language's kit adds its own labels around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PROFILE } from "~/config/profile";

/** The photo files with their real dimensions, so a kit states sizes that match the downloads. */
export const PHOTOS = {
	avatar: { src: "/.well-known/avatar", width: 421, height: 421, format: "PNG" },
	helmet: { src: "/press/sergio-xalambri-helmet.jpg", width: 2000, height: 1116, format: "JPG" },
} as const;

/** Where each open-source project lives. */
export const PROJECT_LINKS = {
	remixAuth: "https://github.com/sergiodxa/remix-auth",
	remixUtils: "https://github.com/sergiodxa/remix-utils",
	monorepo: "https://github.com/sergiodxa/monorepo",
	remix: "https://github.com/remix-run/remix",
	reactRouter: "https://github.com/remix-run/react-router",
} as const;

/** One past appearance, before a kit names its language. */
export interface SharedAppearance {
	title: string;
	event: string;
	date?: string;
	language: "en" | "es";
	href: string;
}

/**
 * Talks, interviews and podcasts, newest first, from the "Apariciones" YouTube playlist. An
 * appearance whose date the recording does not state has none.
 */
export const APPEARANCES: ReadonlyArray<SharedAppearance> = [
	{
		title: "The Remix Way",
		event: "Remix Jam 2026, Toronto",
		date: "2026-10",
		language: "en",
		href: "https://www.youtube.com/watch?v=o07u1oKE6VA",
	},
	{
		title: "Remixing How We Give",
		event: "Remix Conf Europe 2022",
		date: "2022-11",
		language: "en",
		href: "https://www.youtube.com/watch?v=eh6FfHFpYMM",
	},
	{
		title: "Introducción a Remix.run",
		event: "Dev Talks Perú",
		date: "2021-05",
		language: "es",
		href: "https://www.youtube.com/watch?v=0QkFGTX9P78",
	},
	{
		title:
			"Hablamos con Sergio Xalambrí sobre frontend, trabajo remoto, aprender a programar y más",
		event: "Goncy",
		language: "es",
		href: "https://www.youtube.com/watch?v=KVjOiU7J60g",
	},
	{
		title: "Testing in the frontend world",
		event: "Meetup.js Argentina",
		language: "es",
		href: "https://www.youtube.com/watch?v=sOMAMtOBiA8",
	},
	{
		title: "React Suspense y SWR",
		event: "Leonidas Esteban",
		language: "es",
		href: "https://www.youtube.com/watch?v=rXZeFfeKy50",
	},
	{
		title: "Lo mejor para React.js",
		event: "Leonidas Esteban",
		language: "es",
		href: "https://www.youtube.com/watch?v=dBmcmr_0CqM",
	},
	{
		title: "Lanzamos suscripciones y el curso gratis de desarrollo web",
		event: "Leonidas Esteban",
		language: "es",
		href: "https://www.youtube.com/watch?v=3HdPkgQRXwg",
	},
];

/**
 * Writes a `YYYY-MM` month the way a reader of `locale` says it, such as "October 2026".
 *
 * @param month The month, as an appearance stores it.
 * @param locale The language to write it in.
 * @returns The month and year, or `undefined` for an appearance without a date.
 */
export function monthName(month: string | undefined, locale: string): string | undefined {
	if (!month) return undefined;
	let [year, index] = month.split("-").map(Number);
	let date = new Date(Date.UTC(year ?? 0, (index ?? 1) - 1, 1));
	return new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
}

/** Where each profile elsewhere lives; each kit labels them in its own language. */
export const PROFILE_LINKS = {
	website: PROFILE.canonical.origin,
	github: PROFILE.github.profile,
	x: PROFILE.x.profile,
	youtube: PROFILE.youtube.profile,
	packages: "https://sdxc.dev",
} as const;
