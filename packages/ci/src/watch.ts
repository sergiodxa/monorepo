/**
 * `--watch`: after one run, watches tracked files (respecting `.gitignore`) and re-runs when
 * they change, aborting a run in progress through the same AbortSignal that Ctrl-C uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { watch } from "node:fs";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { git } from "./git.js";

import type { FSWatcher } from "node:fs";

/** How long to wait after the last change before starting a new cycle. */
export const WATCH_DEBOUNCE_MS = 200;

/** What a watch cycle prints when it ends. */
export interface WatchCycleSummary {
	/** 1-based cycle number. */
	cycle: number;
	/** Milliseconds the cycle took. */
	duration: number;
	/** Steps that ran (not filtered, not cached). */
	ran: number;
	/** Steps that replayed from the cache. */
	cached: number;
	/** Steps that failed. */
	failed: number;
	/** Whether the cycle was aborted for a newer change. */
	aborted: boolean;
}

/** A compact one-line summary of a watch cycle. */
export function formatWatchCycle(summary: WatchCycleSummary): string {
	if (summary.aborted)
		return `watch #${summary.cycle}: aborted (${(summary.duration / 1000).toFixed(1)}s)`;
	let parts = [`watch #${summary.cycle}`, `${summary.ran} ran`, `${summary.cached} cached`];
	if (summary.failed > 0) parts.push(`${summary.failed} failed`);
	parts.push(`${(summary.duration / 1000).toFixed(1)}s`);
	return parts.join(" — ");
}

/**
 * Watches the project for changes to tracked or untracked-but-not-ignored files under `root`.
 * Calls `onChange` after `debounceMs` of quiet, and stops when `signal` aborts or `stop` resolves.
 */
export async function watchProject(
	root: string,
	options: {
		onChange: () => void;
		signal?: AbortSignal;
		debounceMs?: number;
	},
): Promise<Result<undefined, Error>> {
	let listed = await git(root, ["ls-files", "-z", "-c", "-o", "--exclude-standard"]);
	if (isFailure(listed)) {
		return failure(new Error(`Cannot list files to watch: ${listed.error.message}`));
	}
	void listed;
	let debounceMs = options.debounceMs ?? WATCH_DEBOUNCE_MS;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let schedule = (): void => {
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			options.onChange();
		}, debounceMs);
	};
	let watcher: FSWatcher;
	try {
		watcher = watch(root, { recursive: true }, (_event, filename) => {
			if (filename === null) {
				schedule();
				return;
			}
			let normalized = filename.split("\\").join("/");
			if (normalized.includes("node_modules/") || normalized.startsWith(".git/")) return;
			if (normalized.includes("/sdxc-ci/")) return;
			schedule();
		});
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}
	return await new Promise((resolve) => {
		let finish = (): void => {
			if (timer !== null) clearTimeout(timer);
			watcher.close();
			resolve(success(undefined));
		};
		if (options.signal?.aborted === true) {
			finish();
			return;
		}
		options.signal?.addEventListener("abort", finish, { once: true });
		watcher.on("error", (error) => {
			if (timer !== null) clearTimeout(timer);
			watcher.close();
			resolve(failure(error));
		});
	});
}
