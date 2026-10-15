/**
 * GitHub templates: any repository, folder and ref, downloaded as the tarball GitHub serves and
 * extracted in memory through `remix/tar-parser`. Only regular files and directories under the
 * requested folder are kept, every path is checked to stay inside the project, and links are
 * skipped, so an archive can only ever write plain files where `create` puts the project.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { TarEntry } from "remix/tar-parser";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import {
	MaxEntriesExceededError,
	MaxEntrySizeExceededError,
	MaxTotalSizeExceededError,
	parseTar,
} from "remix/tar-parser";

import type { TemplateSource, TemplateTree } from "./templates.js";

/** A GitHub repository, as `--template org/repo[/path][#ref]` names it. */
export type GitHubTemplate = Extract<TemplateSource, { kind: "github" }>;

/** What a download produced: the template's files and the commit they came from. */
export interface Extracted {
	tree: TemplateTree;
	/** The abbreviated commit GitHub archived, read from the archive's top-level folder. */
	commit: string | null;
}

/**
 * The extraction limits, set explicitly so a template's size is bounded by this module rather
 * than by the parser's defaults. Sizes count decompressed bytes.
 */
export const LIMITS = {
	/** Bytes one file may hold. */
	maxEntrySize: 10 * 1024 * 1024,
	/** Bytes the whole archive may hold, headers and padding included. */
	maxTotalSize: 100 * 1024 * 1024,
	/** Entries the archive may hold, files and directories alike. */
	maxEntries: 10_000,
};

/** The API host the tarball is requested from. */
const GITHUB_API = "https://api.github.com";

/**
 * Downloads and extracts `template`. `GITHUB_TOKEN`, else `GH_TOKEN`, is sent as a bearer
 * token when set, which private repositories and the higher rate limit need. A folder that
 * holds nothing in the archive is a failure naming it.
 *
 * @param env - The variables the token is read from.
 */
export async function downloadTemplate(
	template: GitHubTemplate,
	env: Record<string, string | undefined> = process.env,
): Promise<Result<Extracted, Error>> {
	let label = describe(template);
	let response = await wrap(() =>
		fetch(tarballURL(template), { headers: headers(env.GITHUB_TOKEN ?? env.GH_TOKEN) }),
	);
	if (isFailure(response)) {
		return failure(new Error(`Could not reach GitHub for ${label}: ${response.error.message}`));
	}
	if (!response.data.ok) return failure(refusal(response.data, template, label));
	let body = response.data.body;
	if (body === null) return failure(new Error(`GitHub sent an empty archive for ${label}`));
	let extracted = await extract(body.pipeThrough(new DecompressionStream("gzip")), template.path);
	if (isFailure(extracted)) {
		return failure(new Error(`Could not extract ${label}: ${extracted.error.message}`));
	}
	let { tree } = extracted.data;
	if (tree.files.size === 0 && tree.directories.size === 0) {
		if (template.path === null) return failure(new Error(`${label} is empty`));
		let repository = describe({ ...template, path: null });
		return failure(new Error(`${repository} has no folder ${template.path}, or it is empty`));
	}
	return extracted;
}

/**
 * Reads a GitHub tarball into a tree: the archive's top-level folder is dropped, only entries
 * under `path` are kept (relative to it), and links and any other special entry are skipped.
 * An exceeded limit is a failure naming it.
 */
export async function extract(
	archive: ReadableStream<Uint8Array>,
	path: string | null,
): Promise<Result<Extracted, Error>> {
	let tree: TemplateTree = { files: new Map(), directories: new Set() };
	let seen: { top: string | null } = { top: null };
	let prefix = path === null ? "" : `${path}/`;
	let parsed = await wrap(() =>
		parseTar(archive, LIMITS, async (entry: TarEntry) => {
			let [root = "", ...rest] = entry.name.split("/");
			seen.top ??= root;
			let relative = rest.filter((segment) => segment !== "" && segment !== ".").join("/");
			if (prefix !== "") {
				if (!`${relative}/`.startsWith(prefix)) return;
				relative = relative.slice(prefix.length);
			}
			if (relative === "") return;
			let unsafe = relative.split("/").some((segment) => segment === "..");
			if (unsafe) return;
			if (entry.header.type === "file") tree.files.set(relative, await entry.bytes());
			else if (entry.header.type === "directory") tree.directories.add(relative);
		}),
	);
	if (isFailure(parsed)) return failure(limitError(parsed.error));
	for (let file of tree.files.keys()) {
		let parent = file.split("/");
		while (parent.pop() !== undefined && parent.length > 0)
			tree.directories.delete(parent.join("/"));
	}
	let commit = /-([0-9a-f]{7,40})$/.exec(seen.top ?? "")?.[1] ?? null;
	return success({ tree, commit });
}

/** `org/repo`, with its folder and ref when given, as messages name a template. */
export function describe(template: GitHubTemplate): string {
	let path = template.path === null ? "" : `/${template.path}`;
	let ref = template.ref === null ? "" : `#${template.ref}`;
	return `${template.owner}/${template.repo}${path}${ref}`;
}

/** The tarball endpoint for the template's ref, or for the default branch without one. */
function tarballURL({ owner, repo, ref }: GitHubTemplate): string {
	let base = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball`;
	if (ref === null) return base;
	return `${base}/${ref.split("/").map(encodeURIComponent).join("/")}`;
}

/** The request headers GitHub's API expects, with the token when there is one. */
function headers(token: string | undefined): Headers {
	let result = new Headers({
		accept: "application/vnd.github+json",
		"user-agent": "sdxc",
		"x-github-api-version": "2022-11-28",
	});
	if (token !== undefined && token !== "") result.set("authorization", `Bearer ${token}`);
	return result;
}

/** Why GitHub refused the download, worded for what the user can do about it. */
function refusal(response: Response, template: GitHubTemplate, label: string): Error {
	let tokenHint = "set GITHUB_TOKEN or GH_TOKEN";
	if (response.status === 404) {
		let ref = template.ref === null ? "" : ` or no ref ${template.ref}`;
		return new Error(
			`GitHub has no repository ${template.owner}/${template.repo}${ref}; for a private repository, ${tokenHint}`,
		);
	}
	if (response.status === 401) {
		return new Error(`GitHub rejected the token sent for ${label}; check GITHUB_TOKEN or GH_TOKEN`);
	}
	let limited =
		response.status === 429 ||
		(response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
	if (limited) {
		return new Error(`GitHub's rate limit refused ${label}; wait for it to reset or ${tokenHint}`);
	}
	return new Error(`GitHub answered ${response.status} for ${label}`);
}

/** An extraction failure, naming the limit when one was exceeded. */
function limitError(error: Error): Error {
	if (error instanceof MaxEntrySizeExceededError) {
		return new Error(`a file is larger than the ${mebibytes(LIMITS.maxEntrySize)} limit per file`);
	}
	if (error instanceof MaxTotalSizeExceededError) {
		return new Error(`the archive is larger than the ${mebibytes(LIMITS.maxTotalSize)} limit`);
	}
	if (error instanceof MaxEntriesExceededError) {
		return new Error(`the archive holds more than the ${LIMITS.maxEntries} entries allowed`);
	}
	return error;
}

/** `bytes` in whole mebibytes. */
function mebibytes(bytes: number): string {
	return `${bytes / 1024 / 1024} MiB`;
}
