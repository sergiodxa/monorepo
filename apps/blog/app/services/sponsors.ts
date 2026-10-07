/**
 * The people who sponsor the author on GitHub, now and before, read from GitHub's GraphQL
 * API by a scheduled job and kept in the `CACHE` namespace. `/sponsors` reads the stored
 * roster and nothing else, so it renders at the speed of a KV read whatever GitHub does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { Result } from "@sdxc/result";
import type { InferOutput } from "remix/data-schema";

import { failure, isSuccess, success } from "@sdxc/result";
import * as s from "remix/data-schema";

/** The GitHub account the sponsorships belong to. */
export const SPONSORED_LOGIN = "sergiodxa";

/** The entry `/sponsors` reads and the refresh writes. */
export const SPONSORS_CACHE_KEY = "sponsors:roster";

/**
 * How long a stored roster stays readable. It outlives the refresh interval by enough that
 * a missed run leaves the page intact, and expires on its own so a roster nothing refreshes
 * any more stops being presented as current.
 */
const SPONSORS_TTL = "2 days";

/** How GitHub marks a sponsorship its sponsor chose to show. */
const PUBLIC_PRIVACY = "PUBLIC";

/** How many sponsorships one read asks for, which is the most GitHub answers with at once. */
const PAGE_SIZE = 100;

/** Identifies the blog to GitHub, which requires a caller to name itself. */
const USER_AGENT = "sergiodxa.com";

/**
 * Asks for the sponsorships with the private ones left out, twice: the active ones, and
 * every one ever made. Past sponsors are the second list less the first, because the field
 * that marks a sponsorship active needs the `read:user` scope. `includePrivate` defaults to
 * true for a token that owns the account, so it is stated on both lists.
 */
const SPONSORS_QUERY = `
	query Sponsors($login: String!, $first: Int!) {
		user(login: $login) {
			current: sponsorshipsAsMaintainer(first: $first, includePrivate: false, activeOnly: true, orderBy: { field: CREATED_AT, direction: ASC }) {
				nodes { ...Sponsorship }
			}
			ever: sponsorshipsAsMaintainer(first: $first, includePrivate: false, activeOnly: false, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { ...Sponsorship }
			}
		}
	}

	fragment Sponsorship on Sponsorship {
		sponsorEntity {
			... on User { login name avatarUrl url }
			... on Organization { login name avatarUrl url }
		}
	}
`;

/** One sponsor, as the page names them. */
export interface Sponsor {
	login: string;
	/** What they are called, falling back to the login when they set no name. */
	name: string;
	avatarUrl: string;
	/** Their GitHub profile. */
	url: string;
}

/**
 * Who sponsors the author now, longest-standing first, and who did before, most recent
 * first. A sponsor appears in one list at most.
 */
export interface SponsorRoster {
	current: Sponsor[];
	past: Sponsor[];
}

/** The roster while nobody could be read. */
export const NO_SPONSORS: SponsorRoster = { current: [], past: [] };

/** The shape of a sponsor GitHub answers with, whether a person or an organisation. */
const entitySchema = s.object({
	login: s.string(),
	name: s.optional(s.nullable(s.string())),
	avatarUrl: s.string(),
	url: s.string(),
});

/** One sponsorship, of which only the sponsor and its visibility are read. */
const sponsorshipSchema = s.object({
	/** Present only where a token may read it; absent is not "private". */
	privacyLevel: s.optional(s.nullable(s.string())),
	sponsorEntity: s.nullable(entitySchema),
});

/** One list of sponsorships the query asks for. */
const connectionSchema = s.object({
	nodes: s.nullable(s.array(s.nullable(sponsorshipSchema))),
});

/** What the blog accepts back from the sponsors query, which is external input. */
const responseSchema = s.object({
	data: s.object({
		user: s.nullable(s.object({ current: connectionSchema, ever: connectionSchema })),
	}),
});

/** What GraphQL reports a refused or partly refused query with. */
const errorsSchema = s.object({
	errors: s.optional(s.array(s.object({ message: s.optional(s.string()) }))),
});

/**
 * The roster a payload says is public, each list in the order GitHub gave it.
 *
 * @param payload Whatever came back from the sponsors query.
 * @returns The sponsors safe to name. A payload that misses the schema yields nobody, which
 * is what makes a list disappear rather than stand there with something invented in it.
 */
export function sponsorRoster(payload: unknown): SponsorRoster {
	let parsed = s.parseSafe(responseSchema, payload);
	if (!parsed.success) return NO_SPONSORS;

	let user = parsed.value.data.user;
	if (user === null) return NO_SPONSORS;

	let current = publicSponsors(user.current.nodes ?? []);
	let named = new Set(current.map((sponsor) => sponsor.login));
	let past: Sponsor[] = [];

	for (let sponsor of publicSponsors(user.ever.nodes ?? [])) {
		if (named.has(sponsor.login)) continue;
		named.add(sponsor.login);
		past.push(sponsor);
	}

	return { current, past };
}

/** The public sponsors among `nodes`, in their order. */
function publicSponsors(nodes: Array<InferOutput<typeof sponsorshipSchema> | null>): Sponsor[] {
	let sponsors: Sponsor[] = [];

	for (let node of nodes) {
		if (node === null) continue;
		if ((node.privacyLevel ?? PUBLIC_PRIVACY) !== PUBLIC_PRIVACY) continue;

		let entity = node.sponsorEntity;
		if (entity === null) continue;

		sponsors.push({
			login: entity.login,
			name: entity.name ?? entity.login,
			avatarUrl: entity.avatarUrl,
			url: entity.url,
		});
	}

	return sponsors;
}

/**
 * Asks GitHub who sponsors the account, and who did. A query GitHub refused answers `200`
 * with its errors in the body, so those are a failure too: storing nobody in place of a
 * roster nobody could read would empty the page.
 *
 * @param token The credential the query is made with.
 * @returns The public roster, or why GitHub could not be read.
 */
export async function fetchSponsorRoster(token: string): Promise<Result<SponsorRoster, Error>> {
	let response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
			"user-agent": USER_AGENT,
		},
		body: JSON.stringify({
			query: SPONSORS_QUERY,
			variables: { login: SPONSORED_LOGIN, first: PAGE_SIZE },
		}),
	}).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

	if (response instanceof Error) return failure(response);
	if (!response.ok) return failure(new Error(`GitHub answered ${response.status}`));

	let payload: unknown = await response.json().catch(() => null);
	let errors = s.parseSafe(errorsSchema, payload);
	let messages = errors.success ? (errors.value.errors ?? []) : [];

	if (messages.length > 0) {
		let reasons = messages.map((error) => error.message ?? "an unstated error");
		return failure(new Error(`GitHub answered with ${reasons.join("; ")}`));
	}

	return success(sponsorRoster(payload));
}

/**
 * The stored roster `/sponsors` renders.
 *
 * @param cache Where the roster is kept.
 * @returns The roster, or nobody when the store is empty or unreachable. A page that gets
 * nobody draws no list, which is the honest answer while the roster is unknown.
 */
export async function readStoredSponsors(cache: Cache): Promise<SponsorRoster> {
	let stored = await cache.read<SponsorRoster>(SPONSORS_CACHE_KEY);
	if (!isSuccess(stored) || stored.data === null) return NO_SPONSORS;
	return stored.data;
}

/**
 * Reads GitHub and stores what it says, which is what the scheduled job calls. The roster
 * is asked for rather than read through the cache, because the point of a refresh is to
 * replace an entry that is still perfectly readable.
 *
 * @param cache Where the roster is kept.
 * @param token The credential the query is made with.
 * @returns The roster now stored, or why it was not; a failure leaves the stored one standing.
 */
export async function refreshSponsors(
	cache: Cache,
	token: string,
): Promise<Result<SponsorRoster, Error>> {
	let roster = await fetchSponsorRoster(token);
	if (!isSuccess(roster)) return roster;

	let written = await cache.write(SPONSORS_CACHE_KEY, roster.data, { ttl: SPONSORS_TTL });
	if (!isSuccess(written)) return failure(written.error);

	return roster;
}
