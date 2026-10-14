/**
 * The people funding this work, now and before, read from GitHub's GraphQL API and
 * remembered in the site's cache. A page reads the stored roster and nothing else, so it
 * renders at the speed of a KV read and stays up whatever GitHub is doing; a sponsorship
 * webhook, or the weekly schedule behind it, is what puts a fresh roster there.
 *
 * A sponsorship GitHub marks private is one this module is never told about: the query
 * asks for the public view, which GitHub applies before it answers. Nothing here has a
 * sample list, a placeholder or a fallback name — a read that cannot be completed
 * yields nobody, and nobody is what makes a sponsor list disappear.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { InferOutput } from "remix/data-schema";

import { APIClient } from "@sdxc/api-client";
import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";

/** The GitHub account the sponsorships belong to. */
export const SPONSORED_LOGIN = "sergiodxa";

/** The entry the rendered roster is read from, and the refresh writes. */
export const SPONSORS_CACHE_KEY = "sponsors:roster";

/**
 * How long a stored list stays readable. It outlives the refresh interval by enough
 * that a missed run leaves the pages intact rather than empty, and expires on its own
 * so a list nothing refreshes any more stops being presented as current.
 */
const SPONSORS_TTL = "3 weeks";

/** How GitHub marks a sponsorship its sponsor chose to show. */
const PUBLIC_PRIVACY = "PUBLIC";

/** How many sponsorships one read asks for, which is the most GitHub answers with at once. */
const PAGE_SIZE = 100;

/** Identifies this site to GitHub, which requires a caller to name itself. */
const USER_AGENT = "sdxc.sergiodxa.com";

/**
 * Asks for the maintainer's sponsorships with the private ones left out, twice: the
 * active ones, and every one ever made. Past sponsors are the second list less the first,
 * because the field that marks a sponsorship active needs the same scope `privacyLevel`
 * does.
 *
 * Every list leaves the private ones out.
 * `includePrivate` defaults to true for a token that owns the account, so it is stated
 * here, and it is the authoritative filter: GitHub applies it server-side, and nothing
 * a sponsor asked to keep private is in the answer at all.
 *
 * Nothing else about privacy is requested. Reading a sponsorship's own `privacyLevel`
 * needs the `read:user` scope, so asking for it fails the whole query on a token
 * granted anything narrower — which would turn a well-scoped token into an empty
 * footer.
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

/** One sponsor, as a page names them. */
export interface Sponsor {
	login: string;
	/** What they are called, falling back to the login when they set no name. */
	name: string;
	avatarUrl: string;
	/** Their GitHub profile. */
	url: string;
}

/**
 * Who funds the work now, longest-standing first, and who funded it before, most recent
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

/** What the site accepts back from the sponsors query, which is external input. */
const responseSchema = s.object({
	data: s.object({
		user: s.nullable(s.object({ current: connectionSchema, ever: connectionSchema })),
	}),
});

/** Reads GitHub's GraphQL endpoint with one credential attached in one place. */
class GitHubGraphQL extends APIClient {
	readonly #token: string;

	/**
	 * @param token The credential every request carries.
	 */
	constructor(token: string) {
		super(new URL("https://api.github.com"));
		this.#token = token;
	}

	protected override async before(request: Request): Promise<Request> {
		request.headers.set("authorization", `Bearer ${this.#token}`);
		request.headers.set("content-type", "application/json");
		request.headers.set("user-agent", USER_AGENT);
		return request;
	}

	/**
	 * Runs one query.
	 *
	 * @param query The GraphQL document to run.
	 * @param variables The values its parameters take.
	 * @returns The parsed JSON body, still unvalidated.
	 * @throws When GitHub answers with anything other than a success status.
	 */
	async run(query: string, variables: Record<string, unknown>): Promise<unknown> {
		let response = await this.post("/graphql", { body: JSON.stringify({ query, variables }) });
		if (!response.ok) throw new Error(`GitHub answered ${response.status}`);

		let payload: unknown = await response.json();
		let failures = readErrors(payload);
		if (failures.length > 0) throw new Error(`GitHub answered with ${failures.join("; ")}`);

		return payload;
	}
}

/** What GraphQL reports a refused or partly refused query with. */
const errorsSchema = s.object({
	errors: s.optional(s.array(s.object({ message: s.optional(s.string()) }))),
});

/**
 * The messages a GraphQL payload carries. A query GitHub refused answers `200` with
 * them in the body, so reading them is what separates "nobody sponsors this" from
 * "nobody could be read" — and only the first of those is worth storing.
 *
 * @param payload The parsed response body.
 * @returns One message per reported error, empty when the query succeeded.
 */
function readErrors(payload: unknown): string[] {
	let parsed = s.parseSafe(errorsSchema, payload);
	if (!parsed.success) return [];
	return (parsed.value.errors ?? []).map((error) => error.message ?? "an unstated error");
}

/**
 * The roster a payload says is public, each list in the order GitHub gave it.
 *
 * @param payload Whatever came back from the sponsors query.
 * @returns The sponsors safe to name. A payload that misses the schema yields none,
 * because a list the site cannot read is a list it cannot vouch for, and none is what
 * makes a sponsor list disappear rather than stand there with something invented in it.
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

		/* The query already excluded the private ones; a level that says otherwise wins. */
		let privacy = node.privacyLevel ?? PUBLIC_PRIVACY;
		if (privacy !== PUBLIC_PRIVACY) continue;

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
 * Asks GitHub who sponsors the account, and who did.
 *
 * @param token The credential the query is made with.
 * @returns The public roster.
 * @throws When the call fails, so a failed refresh leaves the stored roster alone.
 */
export async function fetchSponsorRoster(token: string): Promise<SponsorRoster> {
	let client = new GitHubGraphQL(token);
	let payload = await client.run(SPONSORS_QUERY, { login: SPONSORED_LOGIN, first: PAGE_SIZE });
	return sponsorRoster(payload);
}

/**
 * The stored roster a page renders.
 *
 * @param cache Where the roster is kept.
 * @returns The roster, or nobody when the store is empty or unreachable. A page that
 * gets nobody draws no list, which is the honest answer while the roster is unknown.
 */
export async function readStoredSponsors(cache: Cache): Promise<SponsorRoster> {
	let stored = await cache.read<SponsorRoster>(SPONSORS_CACHE_KEY);
	if (!isSuccess(stored) || stored.data === null) return NO_SPONSORS;
	return stored.data;
}

/**
 * Names one version of the roster, so a stored copy of a page retires when the people it
 * names change.
 *
 * @param roster The roster a page was rendered with.
 * @returns A short string standing for that roster.
 */
export function sponsorsTag(roster: SponsorRoster): string {
	let logins = (list: Sponsor[]) => list.map((sponsor) => sponsor.login).join(",");
	return `${logins(roster.current)}|${logins(roster.past)}`;
}

/**
 * Reads GitHub and stores what it says, which is what the webhook and the schedule call.
 *
 * The roster is asked for rather than fetched through the cache, because the point of a
 * refresh is to replace an entry that is still perfectly readable.
 *
 * @param cache Where the roster is kept.
 * @param token The credential the query is made with.
 * @returns The roster now stored.
 * @throws When GitHub cannot be read, which leaves the stored roster standing.
 */
export async function refreshSponsors(cache: Cache, token: string): Promise<SponsorRoster> {
	let roster = await fetchSponsorRoster(token);
	await cache.write(SPONSORS_CACHE_KEY, roster, { ttl: SPONSORS_TTL });
	return roster;
}
