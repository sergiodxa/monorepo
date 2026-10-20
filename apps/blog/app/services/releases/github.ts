/**
 * Reads a repository's published releases from GitHub's REST API for one window of time,
 * so the weekly releases post sees every release the week shipped and nothing a draft or
 * a prerelease announced early.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { InferOutput } from "remix/data-schema";

import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

/** How many releases one page asks for, which is the most GitHub answers with at once. */
const PAGE_SIZE = 100;

/**
 * How many pages one read follows at most. GitHub lists newest first, so a weekly window is
 * found on the first page; the cap bounds a read whose window lies far in the past.
 */
const MAX_PAGES = 10;

/** Identifies the blog to GitHub, which requires a caller to name itself. */
const USER_AGENT = "sergiodxa.com";

/** The REST API version the response schema below was written against. */
const API_VERSION = "2022-11-28";

/** The fields read from one release GitHub lists; a draft has no `published_at`. */
const releaseSchema = s.object({
	tag_name: s.string(),
	html_url: s.string(),
	draft: s.boolean(),
	prerelease: s.boolean(),
	published_at: s.nullable(s.string()),
	body: s.optional(s.nullable(s.string())),
});

/** One page of the releases list, wrapped so the untrusted payload is validated as a whole. */
const pageSchema = s.object({ releases: s.array(releaseSchema) });

/** A span of time, including `from` and excluding `to`, so adjacent windows never overlap. */
export interface ReleaseWindow {
	from: Date;
	to: Date;
}

/** A published, stable release, with the body its notes were written in. */
export interface GitHubRelease {
	/** The `owner/name` of the repository that published it. */
	repository: string;
	tag: string;
	url: string;
	publishedAt: Date;
	/** The release notes as Markdown, empty when the release has none. */
	body: string;
}

/**
 * Lists the releases `repository` published inside `window`, newest first, following pages
 * until one reaches past the window's start. Drafts and prereleases are left out.
 *
 * @param repository The `owner/name` to read.
 * @param window The span a release's publication must fall in.
 * @param token The credential the API is called with.
 * @returns The releases, or why GitHub could not be read; one failed page fails the read, since a partial list would leave packages out of the post without saying so.
 */
export async function listReleases(
	repository: string,
	window: ReleaseWindow,
	token: string,
): Promise<Result<GitHubRelease[], Error>> {
	let releases: GitHubRelease[] = [];

	for (let page = 1; page <= MAX_PAGES; page++) {
		let listed = await fetchPage(repository, page, token);
		if (isFailure(listed)) return listed;

		let reachedStart = false;

		for (let release of listed.data) {
			if (release.published_at === null) continue;

			let publishedAt = new Date(release.published_at);
			if (publishedAt < window.from) reachedStart = true;
			if (release.draft || release.prerelease) continue;
			if (publishedAt < window.from || publishedAt >= window.to) continue;

			releases.push({
				repository,
				tag: release.tag_name,
				url: release.html_url,
				publishedAt,
				body: release.body ?? "",
			});
		}

		if (reachedStart || listed.data.length < PAGE_SIZE) break;
	}

	return success(releases);
}

/**
 * Asks GitHub for one page of a repository's releases.
 *
 * @returns The releases on the page, or why the request or its payload failed.
 */
async function fetchPage(
	repository: string,
	page: number,
	token: string,
): Promise<Result<Array<InferOutput<typeof releaseSchema>>, Error>> {
	let url = new URL(`https://api.github.com/repos/${repository}/releases`);
	url.searchParams.set("per_page", String(PAGE_SIZE));
	url.searchParams.set("page", String(page));

	let response = await fetch(url, {
		headers: {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${token}`,
			"user-agent": USER_AGENT,
			"x-github-api-version": API_VERSION,
		},
	}).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

	if (response instanceof Error) return failure(response);
	if (!response.ok) {
		return failure(new Error(`GitHub answered ${response.status} listing ${repository} releases`));
	}

	let payload: unknown = await response.json().catch(() => null);
	let parsed = await validate({ releases: payload }, pageSchema);
	if (isFailure(parsed)) {
		return failure(new Error(`GitHub listed ${repository} releases in an unexpected shape`));
	}

	return success(parsed.data.releases);
}
