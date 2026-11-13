/**
 * The figures and names the Plumb page repeats across bands: the release, the repository
 * counts, the benchmark and the people. Each band reads them from here, so the hero, the
 * header and the community band never disagree about a number.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The current release, as the hero pin, the terminal and the changelog name it. */
export const RELEASE = { version: "4.2.0", date: "Nov 4", dateTime: "2026-11-04" } as const;

/** The repository's counts on the day the page was written. */
export const REPO = {
	stars: "18.4k",
	contributors: 214,
	weeklyDownloads: "2.3M",
	openIssues: 31,
} as const;

/**
 * The name plumb publishes under on npm. The bare `plumb` belongs to an unrelated package,
 * so every install line and import names this one; the CLI it installs is still `plumb`.
 */
export const PACKAGE = "plumb-schema";

/** The install command per package manager, in the order the tabs show them. */
export const INSTALL = [
	{ value: "npm", command: `npm install ${PACKAGE}` },
	{ value: "pnpm", command: `pnpm add ${PACKAGE}` },
	{ value: "bun", command: `bun add ${PACKAGE}` },
	{ value: "deno", command: `deno add npm:${PACKAGE}` },
] as const;

/**
 * The parse benchmark, in millions of operations per second. Every figure comes from the
 * same run, so the setup the page lists applies to each bar.
 */
export const BENCHMARK = [
	{ label: "Hand-written guard", value: 41.2 },
	{ label: "plumb 4.2, compiled", value: 39.6 },
	{ label: "plumb 3.9, interpreted", value: 6.1 },
	{ label: "plumb 4.2, invalid input", value: 2.8 },
] as const;

/**
 * Thirty-five of the people who committed to plumb, most commits first; with the closing
 * tile the wall holds 36, which fills rows of 9, 12 and 18.
 */
export const CONTRIBUTORS = [
	"Marta Okonkwo",
	"Jun Takeda",
	"Leandro Silva",
	"Saoirse Byrne",
	"Pavel Novak",
	"Amara Diallo",
	"Henrik Dahl",
	"Yuki Sato",
	"Rafael Mendes",
	"Ingrid Solberg",
	"Omar Haddad",
	"Clara Vogel",
	"Tariq Aziz",
	"Noor Shah",
	"Felipe Rojas",
	"Ada Kowalski",
	"Kenta Mori",
	"Lucía Ferrer",
	"Bram de Vries",
	"Zainab Bello",
	"Emil Strand",
	"Hana Kim",
	"Victor Lambert",
	"Iris Novak",
	"Dmitri Orlov",
	"Grace Mensah",
	"Tobias Keller",
	"Mei Lin",
	"Santiago Vega",
	"Olivia Brandt",
	"Kofi Asante",
	"Elena Petrova",
	"Arjun Nair",
	"Freya Lund",
	"Malik Johnson",
] as const;
