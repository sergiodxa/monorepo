/**
 * The GitHub side of a signoff: the repository a remote points at, the token a run posts with,
 * and the REST calls that post an `sdxc/ci` commit status and decide whether a contributor
 * posted one. Every call answers a `Result`; an unreachable API is a failure, never a "no".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import { runCommand } from "./process.js";

/** The commit-status context a signoff posts and `verify` reads. */
export const STATUS_CONTEXT = "sdxc/ci";

/** The permissions that count as a contributor's. */
const CONTRIBUTOR_PERMISSIONS = new Set(["admin", "maintain", "write"]);

/** The REST API's base URL. */
const API = "https://api.github.com";

/** A repository on GitHub. */
export interface Repository {
	owner: string;
	name: string;
}

/** A request GitHub refused or could not answer; `status` is `null` when it was never reached. */
export class GitHubError extends Error {
	override name = "GitHubError";

	/** @param status - The HTTP status, or `null` when the API was unreachable */
	constructor(
		message: string,
		readonly status: number | null,
	) {
		super(message);
	}
}

/**
 * The repository a remote URL names, for `https://github.com/o/r(.git)`,
 * `git@github.com:o/r(.git)` and `ssh://git@github.com/o/r(.git)`; `null` for any other host.
 */
export function parseRepository(url: string): Repository | null {
	let match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.trim());
	if (match === null) return null;
	let [, owner = "", name = ""] = match;
	return { owner, name };
}

/** `owner/name` as `--repo` spells it, or `null` when it is not that shape. */
export function parseRepositoryName(value: string): Repository | null {
	let [owner, name, extra] = value.split("/");
	if (owner === undefined || name === undefined || extra !== undefined) return null;
	if (owner === "" || name === "") return null;
	return { owner, name };
}

/**
 * The token a run calls the API with: the variable `variable` names, then `gh auth token`.
 * A token is never read from argv, where other processes could see it.
 */
export async function resolveToken(
	env: Readonly<Record<string, string | undefined>>,
	variable: string,
	cwd: string,
): Promise<Result<string, GitHubError>> {
	let fromEnv = env[variable];
	if (fromEnv !== undefined && fromEnv !== "") return success(fromEnv);
	let gh = await runCommand(["gh", "auth", "token"], { cwd });
	if (isFailure(gh) || gh.data.stdout.trim() === "") {
		return failure(
			new GitHubError(`No GitHub token: set ${variable}, or sign in with \`gh auth login\``, null),
		);
	}
	return success(gh.data.stdout.trim());
}

/** Calls the REST API and answers the parsed JSON body of a 2xx response. */
async function request(
	token: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<Result<unknown, GitHubError>> {
	let response = await wrap(() =>
		fetch(`${API}${path}`, {
			method,
			headers: {
				accept: "application/vnd.github+json",
				authorization: `Bearer ${token}`,
				"x-github-api-version": "2022-11-28",
				...(body === undefined ? {} : { "content-type": "application/json" }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	);
	if (isFailure(response)) {
		return failure(new GitHubError(`GitHub could not be reached: ${response.error.message}`, null));
	}
	if (!response.data.ok) {
		return failure(
			new GitHubError(
				`GitHub answered ${response.data.status} for ${method} ${path}`,
				response.data.status,
			),
		);
	}
	let json = await wrap(() => response.data.json() as Promise<unknown>);
	return success(isFailure(json) ? null : json.data);
}

/** Whether GitHub knows `sha`; it rejects a status on a commit it has not received. */
export async function commitExists(
	token: string,
	repository: Repository,
	sha: string,
): Promise<Result<boolean, GitHubError>> {
	let found = await request(
		token,
		"GET",
		`/repos/${repository.owner}/${repository.name}/commits/${sha}`,
	);
	if (isFailure(found)) {
		if (found.error.status === 404 || found.error.status === 422) return success(false);
		return found;
	}
	return success(true);
}

/** Posts a successful `sdxc/ci` status on `sha`; the description is cut to GitHub's 140 characters. */
export async function postSignoff(
	token: string,
	repository: Repository,
	sha: string,
	description: string,
): Promise<Result<void, GitHubError>> {
	let posted = await request(
		token,
		"POST",
		`/repos/${repository.owner}/${repository.name}/statuses/${sha}`,
		{
			state: "success",
			context: STATUS_CONTEXT,
			description: description.slice(0, 140),
		},
	);
	if (isFailure(posted)) return posted;
	return success(undefined);
}

/** A signoff found on a commit. */
export interface Signoff {
	by: string;
	at: string;
	description: string;
}

/** What `verify` found: the contributor signoff, or why there is none. */
export type Verification =
	| { signed: true; signoff: Signoff }
	| {
			signed: false;
			reason: "no-status" | "not-successful" | "not-a-contributor";
			by: string | null;
	  };

/** One status as the API lists it. */
interface StatusRecord {
	state?: string;
	context?: string;
	description?: string | null;
	created_at?: string;
	creator?: { login?: string } | null;
}

/**
 * Whether a contributor signed `sha` off: a successful `sdxc/ci` status whose creator has write,
 * maintain or admin permission. Anyone else's status is reported and ignored.
 */
export async function verifySignoff(
	token: string,
	repository: Repository,
	sha: string,
): Promise<Result<Verification, GitHubError>> {
	let base = `/repos/${repository.owner}/${repository.name}`;
	let listed = await request(token, "GET", `${base}/commits/${sha}/statuses?per_page=100`);
	if (isFailure(listed)) return listed;
	let statuses = (Array.isArray(listed.data) ? (listed.data as StatusRecord[]) : []).filter(
		(status) => status.context === STATUS_CONTEXT,
	);
	if (statuses.length === 0) return success({ signed: false, reason: "no-status", by: null });
	let successful = statuses.filter((status) => status.state === "success");
	if (successful.length === 0) {
		return success({
			signed: false,
			reason: "not-successful",
			by: statuses[0]?.creator?.login ?? null,
		});
	}
	let checked = new Map<string, boolean>();
	for (let status of successful) {
		let login = status.creator?.login;
		if (login === undefined) continue;
		if (!checked.has(login)) {
			let permission = await request(token, "GET", `${base}/collaborators/${login}/permission`);
			if (isFailure(permission) && permission.error.status !== 404) return permission;
			let level = isFailure(permission)
				? null
				: (permission.data as { permission?: string }).permission;
			checked.set(
				login,
				level !== undefined && level !== null && CONTRIBUTOR_PERMISSIONS.has(level),
			);
		}
		if (checked.get(login) === true) {
			return success({
				signed: true,
				signoff: { by: login, at: status.created_at ?? "", description: status.description ?? "" },
			});
		}
	}
	return success({
		signed: false,
		reason: "not-a-contributor",
		by: successful[0]?.creator?.login ?? null,
	});
}
