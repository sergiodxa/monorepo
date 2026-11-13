/**
 * Delta's addresses and the shapes its screens read: which screen a path names, the links
 * between them, and the folders and day groups built from the files and commits the build
 * baked from git. Everything here is derived per request from that data, never stored.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeltaCommitMeta, DeltaFile } from "~/app/services/delta/source";

import { DELTA_BRANCH } from "~/config/delta";
import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** The demo's folder name, which is its slug under `/demo/apps`. */
export const SLUG = "delta";

/** The repository's segment under the app, so `delta/blob/main/…` reads as `sdxc/delta`. */
export const REPO = "delta";

/** The org's segment under the app. */
export const ORG = "sdxc";

/** The address of one of Delta's pages; none for the dashboard. */
export const href = demoAppHref(SLUG);

/** The address one of Delta's forms posts to. */
export const actionHref = demoAppActionHref(SLUG);

/**
 * The address of one of the repository's pages.
 *
 * @param page A path under the repository, with its query; none for the repository's home.
 * @example repoHref("commits/main") // "/demo/apps/delta/delta/commits/main"
 */
export function repoHref(page?: string): string {
	return href(page === undefined || page === "" ? REPO : `${REPO}/${page}`);
}

/** A path's segments URI-encoded one by one, so a folder's slash stays a slash. */
function encodePath(path: string): string {
	return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * The address of a file's code or blame at a ref.
 *
 * @param path The file's path relative to the repository.
 * @param options The ref (the branch by default) and the view.
 */
export function fileHref(
	path: string,
	options: { ref?: string; view?: "blob" | "blame"; query?: string } = {},
): string {
	let { ref = DELTA_BRANCH, view = "blob", query } = options;
	let page = `${view}/${encodeURIComponent(ref)}/${encodePath(path)}`;
	return repoHref(query === undefined || query === "" ? page : `${page}?${query}`);
}

/** The address of a folder's listing at a ref; the repository's home for its root. */
export function folderHref(path: string, ref: string = DELTA_BRANCH): string {
	if (path === "" && ref === DELTA_BRANCH) return repoHref();
	return repoHref(`tree/${encodeURIComponent(ref)}/${encodePath(path)}`);
}

/** The address of one commit. */
export function commitHref(sha: string): string {
	return repoHref(`commit/${sha}`);
}

/** The address of the commits list on the branch. */
export function commitsHref(): string {
	return repoHref(`commits/${DELTA_BRANCH}`);
}

/** The address of the file finder, with a query when one was typed. */
export function findHref(query?: string): string {
	let page = `find/${DELTA_BRANCH}`;
	return repoHref(
		query === undefined || query === "" ? page : `${page}?q=${encodeURIComponent(query)}`,
	);
}

/** A commit's sha as lists show it. */
export function shortSha(sha: string): string {
	return sha.slice(0, 7);
}

/** The repository sections a later screen fills; each renders its own coming state for now. */
export type ComingSection = "issues" | "pulls" | "actions" | "settings";

/** The screen a page path names, with what it reads from the path. */
export type DeltaRoute =
	| { screen: "dashboard" }
	| { screen: "notifications" }
	| { screen: "org" }
	| { screen: "home" }
	| { screen: "tree"; ref: string; path: string }
	| { screen: "blob"; view: "blob" | "blame"; ref: string; path: string }
	| { screen: "find"; ref: string }
	| { screen: "commits"; ref: string }
	| { screen: "commit"; sha: string }
	| { screen: "coming"; section: ComingSection };

/** The repository sections that render their coming state, by their path segment. */
const COMING: readonly ComingSection[] = ["issues", "pulls", "actions", "settings"];

/**
 * Reads which screen a page path names. Paths are matched by shape only; whether the file,
 * folder or commit exists is the screen's to answer.
 *
 * @param page The path under the app, without its query.
 * @returns The route, or `null` for a path no screen has.
 */
export function parsePage(page: string): DeltaRoute | null {
	let segments = page
		.split("/")
		.filter((segment) => segment !== "")
		.map((segment) => {
			try {
				return decodeURIComponent(segment);
			} catch {
				return "\u0000";
			}
		});
	if (segments.some((segment) => segment === "\u0000" || segment === "..")) return null;
	let [first, second, third, ...rest] = segments;
	if (first === undefined) return { screen: "dashboard" };
	if (first === "notifications" && second === undefined) return { screen: "notifications" };
	if (first === ORG && second === undefined) return { screen: "org" };
	if (first !== REPO) return null;
	if (second === undefined) return { screen: "home" };
	if (COMING.includes(second as ComingSection) && third === undefined) {
		return { screen: "coming", section: second as ComingSection };
	}
	if (third === undefined) return null;
	if (second === "tree") return { screen: "tree", ref: third, path: rest.join("/") };
	if ((second === "blob" || second === "blame") && rest.length > 0) {
		return { screen: "blob", view: second, ref: third, path: rest.join("/") };
	}
	if (rest.length > 0) return null;
	if (second === "find") return { screen: "find", ref: third };
	if (second === "commits") return { screen: "commits", ref: third };
	if (second === "commit") return { screen: "commit", sha: third };
	return null;
}

/**
 * Whether a ref names the commit the build pinned: the branch, or that commit's sha (seven
 * characters at least).
 */
export function isHeadRef(ref: string, head: string): boolean {
	return ref === DELTA_BRANCH || (ref.length >= 7 && head !== "" && head.startsWith(ref));
}

/** One row of a folder listing. */
export interface FolderEntry {
	name: string;
	/** Relative to the repository. */
	path: string;
	kind: "folder" | "file";
}

/**
 * The folders and files directly inside `folder`, folders first and each group by name, as a
 * code host lists them.
 *
 * @param files Every file in the tree.
 * @param folder The folder's path, `""` for the root.
 * @returns The entries, or `undefined` when no file lives under `folder`.
 */
export function listFolder(files: readonly DeltaFile[], folder: string): FolderEntry[] | undefined {
	let prefix = folder === "" ? "" : `${folder}/`;
	let entries = new Map<string, FolderEntry>();
	for (let file of files) {
		if (!file.path.startsWith(prefix)) continue;
		let rest = file.path.slice(prefix.length);
		let slash = rest.indexOf("/");
		let name = slash === -1 ? rest : rest.slice(0, slash);
		let kind: FolderEntry["kind"] = slash === -1 ? "file" : "folder";
		entries.set(`${kind}:${name}`, { name, path: `${prefix}${name}`, kind });
	}
	if (entries.size === 0) return undefined;
	return [...entries.values()].sort(
		(a, b) =>
			Number(b.kind === "folder") - Number(a.kind === "folder") || a.name.localeCompare(b.name),
	);
}

/** One node of the file tree: a folder holding nodes, or a file. */
export interface TreeNode {
	name: string;
	path: string;
	children?: TreeNode[];
}

/** Every file as nested folders, each level listed as {@link listFolder} orders it. */
export function buildTree(files: readonly DeltaFile[], folder = ""): TreeNode[] {
	return (listFolder(files, folder) ?? []).map((entry) =>
		entry.kind === "folder"
			? { name: entry.name, path: entry.path, children: buildTree(files, entry.path) }
			: { name: entry.name, path: entry.path },
	);
}

/** The folders a path sits in, outermost first: `a/b/c.ts` is in `a` and `a/b`. */
export function ancestorsOf(path: string): string[] {
	let parts = path.split("/").slice(0, -1);
	return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

/** A path's parent folder, `""` for a path at the root. */
export function parentOf(path: string): string {
	let slash = path.lastIndexOf("/");
	return slash === -1 ? "" : path.slice(0, slash);
}

/** A day of commits as the commits list heads it. */
export interface CommitDay<Commit extends DeltaCommitMeta> {
	/** `YYYY-MM-DD` in UTC, which keys the group. */
	day: string;
	/** The day as the heading writes it, such as "Nov 12, 2026". */
	label: string;
	commits: Commit[];
}

/**
 * Groups commits by the UTC day they were authored, newest day first, keeping each day's
 * commits in the order given.
 */
export function groupByDay<Commit extends DeltaCommitMeta>(
	commits: readonly Commit[],
): Array<CommitDay<Commit>> {
	let format = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
	let days = new Map<string, CommitDay<Commit>>();
	for (let commit of commits) {
		let date = new Date(commit.date);
		let day = date.toISOString().slice(0, 10);
		let group = days.get(day);
		if (group === undefined) {
			group = { day, label: format.format(date), commits: [] };
			days.set(day, group);
		}
		group.commits.push(commit);
	}
	return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}

/** A size in bytes as a file header writes it: `812 Bytes`, `1.75 KB`. */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} Bytes`;
	return `${(bytes / 1024).toFixed(2)} KB`;
}

/** A person's initials for an avatar: the first letters of their first and last names. */
export function initials(name: string): string {
	let parts = name.trim().split(/\s+/);
	let first = parts[0]?.[0] ?? "";
	let last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
	return `${first}${last}`.toUpperCase();
}

/** Names joined as a sentence: "Ada", "Ada and Grace", "Ada, Grace and Alan". */
export function joinNames(names: readonly string[], and: string): string {
	if (names.length <= 1) return names[0] ?? "";
	return `${names.slice(0, -1).join(", ")} ${and} ${names.at(-1)}`;
}
