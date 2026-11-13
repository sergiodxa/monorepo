/**
 * Why JS: reloading a list on an interval, and pausing while the tab is hidden, needs a timer
 * and the Page Visibility API. No-JS baseline: the list shows what the page loaded with, and
 * the host `<time>` keeps naming when that was, until the reader reloads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { RefreshSchedule } from "../behaviors/refresh-schedule.js";

/** Types for {@link autoRefresh}. */
export namespace AutoRefreshTimer {
	/** Configuration for {@link autoRefresh}, read when the host is inserted. */
	export interface Options {
		/** Milliseconds between reloads; 0 or less leaves the host as rendered. */
		every: number;
		/** Reloads the frame or page the list lives in. */
		reload: () => Promise<unknown>;
		/** Locale the refreshed time is written in. Defaults to the runtime's. */
		locale?: string;
		/** Time zone the time is written in. Defaults to the reader's own. */
		timeZone?: string;
	}
}

/**
 * Runs a {@link RefreshSchedule} while the host `<time>` is in the document, counted from the
 * host's own `datetime`, which it first rewrites in the reader's time zone. It pauses while the
 * page is hidden, catches up with one reload when shown, sets `data-paused` meanwhile, and
 * rewrites the host's `datetime` and text after each reload.
 *
 * @example <time dateTime={iso} mix={[autoRefresh({ every: 30_000, reload: () => handle.frames.top.reload() })]}>{text}</time>
 */
export const autoRefresh: MixinFactory<HTMLTimeElement, [options: AutoRefreshTimer.Options]> =
	createMixin<HTMLTimeElement, [options: AutoRefreshTimer.Options]>((handle) => {
		let options: AutoRefreshTimer.Options | undefined;
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			if (options) follow(event.node, options, controller.signal);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});

		return (next) => {
			options = next;
		};
	});

/**
 * Starts the schedule for `host` until `signal` aborts.
 *
 * @param host The `<time>` naming when the list was last fetched.
 * @param options The interval, the reload and the locale.
 * @param signal Ends the schedule and its listeners.
 */
function follow(
	host: HTMLTimeElement,
	options: AutoRefreshTimer.Options,
	signal: AbortSignal,
): void {
	let doc = host.ownerDocument;
	let initial = new Date(host.dateTime);
	let schedule = new RefreshSchedule({
		every: options.every,
		reload: options.reload,
		refreshedAt: Number.isNaN(initial.getTime()) ? undefined : initial,
	});
	let format = new Intl.DateTimeFormat(options.locale, {
		timeStyle: "medium",
		timeZone: options.timeZone,
	});
	if (!Number.isNaN(initial.getTime())) host.textContent = format.format(initial);

	schedule.addEventListener(
		"refresh",
		() => {
			host.dateTime = schedule.refreshedAt.toISOString();
			host.textContent = format.format(schedule.refreshedAt);
		},
		{ signal },
	);

	/** Pauses with the page and resumes once it is shown again. */
	let sync = () => {
		host.toggleAttribute("data-paused", doc.hidden);
		if (doc.hidden) schedule.pause();
		else schedule.resume();
	};

	doc.addEventListener("visibilitychange", sync, { signal });
	signal.addEventListener("abort", () => schedule.stop());
	sync();
}
