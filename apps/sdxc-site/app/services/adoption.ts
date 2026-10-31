/**
 * Who installs the packages outside this repository: deps.dev's dependent counts per package,
 * less the packages in the collection that depend on it, and the GitHub repositories whose
 * manifests name an `@sdxc/*` package. Refreshed daily into the site cache.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import { listPackages } from "~/app/services/packages";

/** The entry the snapshot is read from and the refresh writes. */
export const ADOPTION_CACHE_KEY = "adoption:snapshot";

/** How long a stored snapshot stays readable when no refresh replaces it. */
const SNAPSHOT_TTL = "30 days";

/** How old a snapshot gets before a page visit starts a refresh, a little under a day. */
const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

/** How many deps.dev requests run at once, enough to read every package in a few seconds. */
const DEPS_DEV_CONCURRENCY = 8;

/** How long one request may take before it counts as failed. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * How long a refresh keeps starting packages, which keeps the whole run inside the time a
 * worker grants after its response; packages left unread keep their previous counts.
 */
const REFRESH_BUDGET_MS = 18_000;

/** The repository the collection lives in, whose own manifests every search finds. */
const HOME_REPOSITORY = "sergiodxa/monorepo";

/** The code search that finds manifests naming the collection. */
const CODE_SEARCH_QUERY = '"@sdxc/" filename:package.json';

/** How many result pages the search reads; code search allows about ten requests a minute. */
const CODE_SEARCH_PAGES = 2;

/** The most results GitHub answers with in one page. */
const CODE_SEARCH_PAGE_SIZE = 100;

/** Identifies this site to GitHub, which requires a caller to name itself. */
const USER_AGENT = "sdxc.dev";

/** One package's dependents, as deps.dev counts them for its default version. */
export interface PackageAdoption {
	directory: string;
	/** The published name, `@sdxc/<directory>`. */
	name: string;
	/** The version deps.dev counted, the one it marks as default. */
	version: string;
	/** Every package deps.dev knows that depends on this version directly. */
	directDependents: number;
	/** The packages in this collection that depend on it, read from their manifests. */
	collectionDependents: number;
	/**
	 * The direct dependents less the collection's own, floored at zero: an estimate, since
	 * deps.dev counts a dependent per version pin and the manifests reflect only today.
	 */
	outsideDependents: number;
}

/** A repository outside this one whose manifests name an `@sdxc/*` package. */
export interface AdoptionRepository {
	/** `owner/name`. */
	fullName: string;
	url: string;
	/** The manifests the search matched, relative to the repository root. */
	paths: string[];
	/** The packages named in the matched lines, sorted; partial, since GitHub quotes fragments. */
	packages: string[];
}

/** Why the repository list holds nothing new: no credential, or GitHub refused the search. */
export type RepositoriesNote = "no-token" | "failed";

/** Each package's outside dependents, and the repositories that install the collection. */
export interface AdoptionSnapshot {
	/** When the sources were read, as an ISO timestamp. */
	fetchedAt: string;
	/** Every package deps.dev has answered for, in directory order. */
	packages: PackageAdoption[];
	/** Directories deps.dev has never answered for, which the page reports as unknown. */
	missing: string[];
	/** Repositories found by code search, most manifests first. */
	repositories: AdoptionRepository[];
	/** Set when the list is empty or carried over because the search did not run this time. */
	repositoriesNote: RepositoriesNote | null;
}

/** A package's versions, of which only the default one is read. */
const packageSchema = s.object({
	versions: s.array(
		s.object({
			versionKey: s.object({ version: s.string() }),
			isDefault: s.optional(s.boolean()),
		}),
	),
});

/** One version's dependent counts. */
const dependentsSchema = s.object({
	directDependentCount: s.number(),
});

/** A quoted stretch of a matched manifest, which names the packages it installs. */
const textMatchSchema = s.object({ fragment: s.optional(s.string()) });

/** One page of code search results, with the text matches GitHub quotes when asked. */
const codeSearchSchema = s.object({
	items: s.array(
		s.object({
			path: s.string(),
			repository: s.object({ full_name: s.string(), html_url: s.string() }),
			text_matches: s.optional(s.array(textMatchSchema)),
		}),
	),
});

/** Finds every collection package named in a fragment of a manifest. */
const PACKAGE_NAME_PATTERN = /@sdxc\/([a-z0-9][a-z0-9.-]*)/g;

/**
 * Reads one URL as JSON.
 *
 * @param url What to read.
 * @param headers Headers the request carries.
 * @returns The parsed body, or why it could not be read.
 */
async function readJSON(
	url: string,
	headers: Record<string, string> = {},
): Promise<Result<unknown, Error>> {
	try {
		let response = await fetch(url, {
			headers: { accept: "application/json", ...headers },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!response.ok) return failure(new Error(`${url} answered ${response.status}`));
		return success(await response.json());
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}
}

/**
 * How many packages in the collection depend on each one directly, the reverse of every
 * manifest's internal dependencies.
 *
 * @returns A count per directory; a directory nothing depends on is absent.
 */
export function collectionDependents(): Map<string, number> {
	let counts = new Map<string, number>();
	for (let entry of listPackages()) {
		for (let dependency of entry.internalDependencies) {
			counts.set(dependency, (counts.get(dependency) ?? 0) + 1);
		}
	}
	return counts;
}

/**
 * Reads one package's default version and its direct dependent count from deps.dev.
 *
 * @param directory The workspace directory, which names the package.
 * @param inCollection How many packages in the collection depend on it.
 * @returns The package's adoption, or why deps.dev could not be read.
 */
export async function fetchPackageAdoption(
	directory: string,
	inCollection: number,
): Promise<Result<PackageAdoption, Error>> {
	let name = `@sdxc/${directory}`;
	let base = `https://api.deps.dev/v3alpha/systems/npm/packages/${encodeURIComponent(name)}`;

	let info = await readJSON(base);
	if (isFailure(info)) return info;
	let parsed = s.parseSafe(packageSchema, info.data);
	if (!parsed.success) return failure(new Error(`Unreadable deps.dev package for ${name}`));

	let version = parsed.value.versions.find((entry) => entry.isDefault === true)?.versionKey.version;
	if (version === undefined) return failure(new Error(`No default version for ${name}`));

	let counts = await readJSON(`${base}/versions/${encodeURIComponent(version)}:dependents`);
	if (isFailure(counts)) return counts;
	let dependents = s.parseSafe(dependentsSchema, counts.data);
	if (!dependents.success) return failure(new Error(`Unreadable dependents for ${name}`));

	let direct = dependents.value.directDependentCount;
	return success({
		directory,
		name,
		version,
		directDependents: direct,
		collectionDependents: inCollection,
		outsideDependents: Math.max(0, direct - inCollection),
	});
}

/**
 * Reads every package from deps.dev a few at a time until the budget runs out.
 *
 * @param directories The packages to read.
 * @param deadline When to stop starting new packages, as a `Date.now()` value.
 * @returns What deps.dev answered, by directory; a failed or unstarted package is absent.
 */
async function readDepsDev(
	directories: string[],
	deadline: number,
): Promise<Map<string, PackageAdoption>> {
	let inCollection = collectionDependents();
	let read = new Map<string, PackageAdoption>();
	let queue = [...directories];

	let worker = async () => {
		for (let directory = queue.shift(); directory !== undefined; directory = queue.shift()) {
			if (Date.now() > deadline) return;
			let result = await fetchPackageAdoption(directory, inCollection.get(directory) ?? 0);
			if (isSuccess(result)) read.set(directory, result.data);
		}
	};

	await Promise.all(Array.from({ length: DEPS_DEV_CONCURRENCY }, worker));
	return read;
}

/**
 * Searches GitHub for manifests naming the collection, outside this repository.
 *
 * @param token The credential code search requires.
 * @returns One entry per repository, most matched manifests first, or why the search failed.
 */
export async function fetchRepositories(
	token: string,
): Promise<Result<AdoptionRepository[], Error>> {
	let byName = new Map<string, { url: string; paths: Set<string>; packages: Set<string> }>();
	let query = encodeURIComponent(CODE_SEARCH_QUERY);

	for (let page = 1; page <= CODE_SEARCH_PAGES; page++) {
		let result = await readJSON(
			`https://api.github.com/search/code?q=${query}&per_page=${CODE_SEARCH_PAGE_SIZE}&page=${page}`,
			{
				accept: "application/vnd.github.text-match+json",
				authorization: `Bearer ${token}`,
				"user-agent": USER_AGENT,
				"x-github-api-version": "2022-11-28",
			},
		);
		if (isFailure(result)) return result;
		let parsed = s.parseSafe(codeSearchSchema, result.data);
		if (!parsed.success) return failure(new Error("Unreadable code search results"));

		for (let item of parsed.value.items) {
			let fullName = item.repository.full_name;
			if (fullName.toLowerCase() === HOME_REPOSITORY) continue;
			let entry = byName.get(fullName) ?? {
				url: item.repository.html_url,
				paths: new Set<string>(),
				packages: new Set<string>(),
			};
			entry.paths.add(item.path);
			for (let match of item.text_matches ?? []) {
				for (let found of (match.fragment ?? "").matchAll(PACKAGE_NAME_PATTERN)) {
					entry.packages.add(`@sdxc/${found[1]}`);
				}
			}
			byName.set(fullName, entry);
		}

		if (parsed.value.items.length < CODE_SEARCH_PAGE_SIZE) break;
	}

	let repositories = Array.from(byName, ([fullName, entry]) => ({
		fullName,
		url: entry.url,
		paths: [...entry.paths].sort(),
		packages: [...entry.packages].sort(),
	}));
	return success(
		repositories.sort(
			(a, b) => b.paths.length - a.paths.length || a.fullName.localeCompare(b.fullName),
		),
	);
}

/**
 * The stored snapshot.
 *
 * @param cache Where the snapshot is kept.
 * @returns The snapshot, or `null` when nothing is stored or the store cannot be read.
 */
export async function readAdoption(cache: Cache): Promise<AdoptionSnapshot | null> {
	let stored = await cache.read<AdoptionSnapshot>(ADOPTION_CACHE_KEY);
	if (!isSuccess(stored) || stored.data === null) return null;
	return stored.data;
}

/**
 * Whether the stored snapshot is old or missing enough for a page to start a refresh.
 *
 * @param snapshot The stored snapshot, or `null`.
 * @param now The moment to compare against.
 */
export function needsAdoptionRefresh(snapshot: AdoptionSnapshot | null, now = new Date()): boolean {
	if (snapshot === null) return true;
	let fetchedAt = Date.parse(snapshot.fetchedAt);
	if (Number.isNaN(fetchedAt)) return true;
	return now.getTime() - fetchedAt > REFRESH_AFTER_MS;
}

/**
 * Reads the sources and stores a new snapshot; what the daily schedule and a page finding a
 * stale snapshot call. A package deps.dev fails for keeps its previous counts, and a failed
 * search keeps the previous repositories, so one bad read never empties the section.
 *
 * @param cache Where the snapshot is kept.
 * @param token The GitHub credential, absent where the worker has none.
 * @param now The moment the snapshot is taken.
 * @returns The snapshot now stored, or `null` when nothing could be read.
 */
export async function refreshAdoption(
	cache: Cache,
	token: string | undefined,
	now = new Date(),
): Promise<AdoptionSnapshot | null> {
	let previous = await readAdoption(cache);
	let directories = listPackages().map((entry) => entry.directory);
	let deadline = Date.now() + REFRESH_BUDGET_MS;

	let [read, search] = await Promise.all([
		readDepsDev(directories, deadline),
		token ? fetchRepositories(token) : Promise.resolve(null),
	]);

	let stored = new Map(previous?.packages.map((entry) => [entry.directory, entry]));
	for (let [directory, entry] of read) stored.set(directory, entry);

	let repositories = previous?.repositories ?? [];
	let repositoriesNote: RepositoriesNote | null = "no-token";
	if (search !== null && isSuccess(search)) {
		repositories = search.data;
		repositoriesNote = null;
	} else if (search !== null) {
		repositoriesNote = "failed";
	}

	if (read.size === 0 && repositoriesNote !== null && previous === null) return null;

	let snapshot: AdoptionSnapshot = {
		fetchedAt: now.toISOString(),
		packages: directories.flatMap((directory) => stored.get(directory) ?? []),
		missing: directories.filter((directory) => !stored.has(directory)),
		repositories: token ? repositories : [],
		repositoriesNote,
	};
	await cache.write(ADOPTION_CACHE_KEY, snapshot, { ttl: SNAPSHOT_TTL });
	return snapshot;
}
