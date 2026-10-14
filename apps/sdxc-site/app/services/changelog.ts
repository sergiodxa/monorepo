/**
 * The releases behind the changelog: read from GitHub, held in KV, and parsed into the
 * same markdown documents every other page renders. This is the one page whose content
 * lives outside the bundle, so it is also the one page that has to keep answering when
 * the source of that content will not.
 *
 * Two keys hold the same payload for two different jobs. The first expires at the next
 * midnight UTC, which is when a release can first change what this page says, and its
 * presence is what "fresh" means. The second never expires, and is what a reader gets
 * when GitHub refuses the call — an unauthenticated Worker shares sixty requests an
 * hour with every other caller on its address, so being refused is ordinary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { Result } from "@sdxc/result";

import { addDays, startOfDay } from "@sdxc/dates";
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

/** The repository whose releases this page is a view of. */
const RELEASES_ENDPOINT = "https://api.github.com/repos/sergiodxa/monorepo/releases?per_page=100";

/** GitHub refuses a call carrying no agent, so every request names the site making it. */
const USER_AGENT = "sdxc.sergiodxa.com";

/** The REST contract this code was written against, pinned so a later default cannot move it. */
const API_VERSION = "2022-11-28";

/** Where the copy a reader gets while it is current is held. */
const FRESH_KEY = "changelog:fresh";

/** And where the copy that answers for it once it is not is held, under no expiry at all. */
const LAST_KEY = "changelog:last";

/** The one zone a release date is stated in, since the scheme names a UTC day. */
const TIME_ZONE = "UTC";

/**
 * The shortest life an entry is written with. A TTL computed at exactly midnight is
 * zero, which KV rejects, leaving nothing stored and every request for that second
 * reaching the API; a minute is also the shortest KV accepts.
 */
export const MINIMUM_TTL_SECONDS = 60;

/** A dated release tag, which is the only tag this page has an entry for. */
const DATED_TAG = /^v(\d{4})\.(\d{1,2})\.(\d{1,2})$/;

/** One release, as the page lists it. */
export interface Release {
	/** The dated version, `YYYY.M.D`, which is what every package published that day carries. */
	version: string;
	/** When it went out, as the instant GitHub recorded. */
	publishedAt: string;
	/** Where the release is read on GitHub, with its assets and its compare link. */
	href: string;
	/** The notes, as the markdown GitHub holds them in. */
	notes: string;
}

/**
 * What this code reads out of a release, of the much larger object GitHub sends. The
 * response is external input, so the shape is checked rather than assumed, and a body
 * or a date GitHub left null is a release with nothing to say rather than a failure.
 */
const releaseSchema = s.object({
	tag_name: s.string(),
	body: s.nullable(s.optional(s.string())),
	published_at: s.nullable(s.optional(s.string())),
	html_url: s.string(),
	draft: s.boolean(),
	prerelease: s.boolean(),
});

const releasesSchema = s.array(releaseSchema);

/**
 * How long a copy written now stays current: the span to the next 00:00 UTC, which is
 * when the release workflow can first put something new behind this page. Written at
 * 23:50 it lives ten minutes; written at 00:05 it lives just under a day. Either way
 * the first reader after a release sees the release, and nobody pays for a request
 * that could not have new data behind it.
 *
 * An instant exactly on the boundary has no span left at all, so the floor is what it
 * gets.
 *
 * @param now - The instant the copy is being written at.
 * @returns Whole seconds, never below {@link MINIMUM_TTL_SECONDS}.
 * @example cacheTtlSeconds(new Date("2026-09-21T23:50:00Z")) // 600
 */
export function cacheTtlSeconds(now: Date): number {
	let boundary = startOfDay(now, TIME_ZONE);

	let next =
		boundary.getTime() === now.getTime() ? boundary : startOfDay(addDays(now, 1), TIME_ZONE);

	let seconds = Math.ceil((next.getTime() - now.getTime()) / 1000);

	return Math.max(seconds, MINIMUM_TTL_SECONDS);
}

/**
 * The releases the page lists, newest first.
 *
 * A stored copy answers while it is current. Past that it is refreshed, and a refresh
 * GitHub will not serve falls back to the copy held for exactly this, so the page's
 * availability is its own rather than the API's. With neither, the list is empty and
 * the page says where the releases are read instead.
 *
 * @param cache - The store both copies are held in.
 * @returns Every dated release, or an empty list when nothing can be read.
 */
export async function readChangelog(cache: Cache): Promise<Release[]> {
	let current = await cache.read<Release[]>(FRESH_KEY);
	if (isSuccess(current) && current.data !== null) return current.data;

	let fetched = await fetchReleases(env.GITHUB_TOKEN);

	if (isSuccess(fetched)) {
		await cache.write(FRESH_KEY, fetched.data, { ttl: cacheTtlSeconds(new Date()) });
		await cache.write(LAST_KEY, fetched.data);
		return fetched.data;
	}

	let stale = await cache.read<Release[]>(LAST_KEY);
	if (isSuccess(stale) && stale.data !== null) return stale.data;

	return [];
}

/**
 * Reads every release GitHub holds for the repository. A token raises the sixty-an-hour
 * ceiling an unauthenticated Worker shares with its address; without one the call is
 * made anyway, because being refused is a case this already handles.
 *
 * @param token - A GitHub token, where the environment carries one.
 */
async function fetchReleases(token?: string): Promise<Result<Release[], Error>> {
	let headers = new Headers({
		accept: "application/vnd.github+json",
		"user-agent": USER_AGENT,
		"x-github-api-version": API_VERSION,
	});

	if (token) headers.set("authorization", `Bearer ${token}`);

	let response: Response;

	try {
		response = await fetch(RELEASES_ENDPOINT, { headers });
	} catch (error) {
		return failure(new Error("The releases could not be fetched", { cause: error }));
	}

	if (!response.ok) {
		return failure(new Error(`GitHub answered ${response.status} for the releases`));
	}

	let payload: unknown;

	try {
		payload = await response.json();
	} catch (error) {
		return failure(new Error("The releases response was not JSON", { cause: error }));
	}

	let parsed = s.parseSafe(releasesSchema, payload);
	if (!parsed.success)
		return failure(new Error("The releases response was not the shape expected"));

	return success(toReleases(parsed.value));
}

/** Keeps the published, dated releases, newest first. */
function toReleases(payload: s.InferOutput<typeof releasesSchema>): Release[] {
	let releases: Release[] = [];

	for (let entry of payload) {
		if (entry.draft || entry.prerelease) continue;

		let dated = DATED_TAG.exec(entry.tag_name);
		if (dated === null || entry.published_at == null) continue;

		releases.push({
			version: entry.tag_name.slice(1),
			publishedAt: entry.published_at,
			href: entry.html_url,
			notes: entry.body ?? "",
		});
	}

	return releases.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * Parses one release's notes into the document the page renders. The notes are written
 * by whoever wrote the day's commits rather than for this site, so a body the parser
 * refuses costs that entry its prose and leaves the rest of the page standing.
 *
 * Headings here are left unaddressed: every entry on the page is a document of its own,
 * and the same package heading under a dozen dates would give one id to a dozen places.
 *
 * @param notes - The markdown GitHub holds the release's body in.
 * @returns The document to render, or `null` when the notes cannot be read.
 */
export function parseNotes(notes: string): Markdown.Document | null {
	if (notes.trim() === "") return null;

	let parsed = Markdown.parse(notes);
	if (isFailure(parsed)) return null;

	let painted = Markdown.walk(parsed.data.document, { ...highlight });
	if (isFailure(painted)) return null;

	return painted.data;
}
