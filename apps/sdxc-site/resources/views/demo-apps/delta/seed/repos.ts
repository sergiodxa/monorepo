/**
 * The `sdxc` org's repositories as its page pins them. `sdxc/delta` is the one Delta hosts;
 * the others are the packages it is built from, shown as cards that lead to each package's
 * real documentation on sdxc.dev, since only Delta's own code is browsable here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A pinned repository. */
export interface PinnedRepo {
	name: string;
	description: string;
	language: string;
	stars: number;
	forks: number;
	/** The package's page on sdxc.dev, for every repository Delta doesn't host. */
	docs?: string;
}

/** Every pinned repository, the hosted one first. */
export const REPOS: readonly PinnedRepo[] = [
	{
		name: "delta",
		description:
			"The code-hosting demo on sdxc.dev. You're reading its source: every file, commit and blame line comes from git.",
		language: "TypeScript",
		stars: 128,
		forks: 9,
	},
	{
		name: "ui",
		description: "Components, app shells and theme tokens for Remix apps, server-rendered first.",
		language: "TypeScript",
		stars: 2140,
		forks: 87,
		docs: "/api/ui",
	},
	{
		name: "highlight",
		description: "Syntax highlighting that tokenizes line by line and resumes where it stopped.",
		language: "TypeScript",
		stars: 412,
		forks: 21,
		docs: "/api/highlight",
	},
	{
		name: "diff",
		description: "Line and word diffs with histogram alignment, and unified-diff parsing.",
		language: "TypeScript",
		stars: 233,
		forks: 12,
		docs: "/api/diff",
	},
	{
		name: "kit",
		description: "The sdxc command line: create an app, make its files, check it and deploy it.",
		language: "TypeScript",
		stars: 318,
		forks: 15,
		docs: "/api/kit",
	},
	{
		name: "u",
		description: "Typed CSS utilities as mixins, one family per concern.",
		language: "TypeScript",
		stars: 186,
		forks: 6,
		docs: "/api/u",
	},
];

/** The repositories each member pins on their profile, by handle; the org's first two otherwise. */
export const PINS: Record<string, readonly string[]> = {
	sergiodxa: ["delta", "ui", "kit", "u"],
	mara: ["ui", "delta"],
	tlindqvist: ["kit", "delta"],
	ines: ["delta", "u"],
	kenji: ["diff", "highlight", "delta"],
	priya: ["delta", "kit"],
};
