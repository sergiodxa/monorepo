/**
 * The people Delta's seeded records name: the org's members, each with a handle, a role and a
 * short bio. The one real person is the author git names on every commit; everyone else is
 * invented, so a seeded run, review or notification always has someone behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A member of the `sdxc` org. */
export interface Person {
	/** The address segment of their profile, `/u/<handle>`. */
	handle: string;
	/** Matches the author name git records, for the one real person. */
	name: string;
	bio: string;
	role: "Owner" | "Maintainer" | "Member";
	/** When they joined the org, as `YYYY-MM-DD`. */
	joined: string;
	/** Their contribution graph comes from git rather than from the seed. */
	real?: boolean;
}

/** The handle of the person signed in, who is the repository's real author. */
export const ME = "sergiodxa";

/** Everyone in the org, the owner first. */
export const PEOPLE: readonly Person[] = [
	{
		handle: "sergiodxa",
		name: "Sergio Xalambrí",
		bio: "Builds sdxc: the packages, the kit and the demos on sdxc.dev.",
		role: "Owner",
		joined: "2024-02-11",
		real: true,
	},
	{
		handle: "mara",
		name: "Mara Okafor",
		bio: "Design systems and the boring parts of accessibility. Reviews every focus ring.",
		role: "Maintainer",
		joined: "2024-06-03",
	},
	{
		handle: "tlindqvist",
		name: "Tobias Lindqvist",
		bio: "CI, caches and build pipelines. If a job takes over five minutes, it's my fault.",
		role: "Maintainer",
		joined: "2024-09-17",
	},
	{
		handle: "ines",
		name: "Inés Navarro",
		bio: "Frontend at night, typesetting by day. Writes the docs nobody else wants to.",
		role: "Member",
		joined: "2025-01-22",
	},
	{
		handle: "kenji",
		name: "Kenji Watanabe",
		bio: "Diff algorithms and syntax highlighting. Benchmarks everything twice.",
		role: "Member",
		joined: "2025-04-08",
	},
	{
		handle: "priya",
		name: "Priya Raman",
		bio: "Workers, Durable Objects and anything that has to stay up at 3am.",
		role: "Member",
		joined: "2025-08-30",
	},
];

/** The person a handle names, if they're in the org. */
export function findPerson(handle: string): Person | undefined {
	return PEOPLE.find((person) => person.handle === handle);
}

/** A handle's display name, for the tile tinted from it; a stranger's handle stands for itself. */
export function nameOf(handle: string): string {
	return findPerson(handle)?.name ?? handle;
}

/** The person git names as an author, matched by name, for real commits. */
export function personByName(name: string): Person | undefined {
	return PEOPLE.find((person) => person.name === name);
}

/** One day's count on a contribution graph, as `YYYY-MM-DD`. */
export interface ContributionDay {
	date: string;
	count: number;
}

/** A number from 0 to 1 picked from a string, so a seeded day keeps its count between requests. */
function noise(seed: string): number {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index++) {
		hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
	}
	return ((hash >>> 0) % 10_000) / 10_000;
}

/**
 * A seeded person's contributions from the day they joined to `end`: quiet weekends, a busier
 * middle of the week, and stretches off, each person with their own rhythm.
 *
 * @param person The member.
 * @param end The last day, as `YYYY-MM-DD`.
 */
export function seededContributions(person: Person, end: string): ContributionDay[] {
	let days: ContributionDay[] = [];
	let last = Date.parse(`${end}T00:00:00Z`);
	let busy = 0.35 + noise(person.handle) * 0.4;
	for (let at = Date.parse(`${person.joined}T00:00:00Z`); at <= last; at += 86_400_000) {
		let date = new Date(at).toISOString().slice(0, 10);
		let weekday = new Date(at).getUTCDay();
		let week = Math.floor(at / (7 * 86_400_000));
		if (noise(`${person.handle}:${week}`) < 0.12) continue;
		let chance = weekday === 0 || weekday === 6 ? busy * 0.25 : busy;
		let roll = noise(`${person.handle}:${date}`);
		if (roll > chance) continue;
		days.push({ date, count: 1 + Math.floor((roll / chance) ** 2 * 14) });
	}
	return days;
}
