/**
 * Reads a bookmarked page once and answers everything the blog asks of it: whether it is
 * still there, where its redirects end, and the title and description it gives itself.
 * Saving a bookmark and the weekly check both read pages through here, so they agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OutboundError } from "@sdxc/outbound";
import type { RobotsFetch } from "@sdxc/robots/fetch";

import { MAX_BYTES, summaryFrom } from "@sdxc/distill";
import { follow, readText, release, resolveHost } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { isAllowedBy } from "@sdxc/robots/fetch";

import type { Bookmark } from "~/app/repositories/bookmark";

/** What the blog's requests call themselves, so a publisher can tell who is asking. */
export const BOOKMARK_USER_AGENT = "sergiodxa.com bookmarks (+https://sergiodxa.com/bookmarks)";

/** Statuses a publisher answers a client it will not serve with, which say nothing of the page. */
const REFUSING_STATUSES = new Set([401, 402, 403, 407, 429, 451]);

/** Statuses that say the page itself is gone. */
const GONE_STATUSES = new Set([404, 410]);

/** Types for reading a bookmarked page. */
export namespace BookmarkPage {
	/** One read of a page: how it went, and what the page says about itself when it is up. */
	export interface Reading extends Bookmark.Reading {
		/** The headline the page declares, read only when the page is `ok`. */
		title: string | null;
		/** The page's summary or opening, read only when the page is `ok`. */
		description: string | null;
	}

	/** What a read may spend, and what it consults first. */
	export interface Options {
		/** Milliseconds for the whole redirect chain and the body read after it. */
		timeout: number;
		/** The origin's `robots.txt`; a path it disallows reads as `blocked` without a request. */
		robots?: RobotsFetch.Outcome | undefined;
		signal?: AbortSignal | undefined;
	}
}

/** A reading of a page that could not be fetched, carrying no response and no metadata. */
function unanswered(status: Bookmark.Status): BookmarkPage.Reading {
	return { status, httpStatus: null, finalUrl: null, title: null, description: null };
}

/**
 * Whether a redirect took the bookmark somewhere else: another host (ignoring `www.`), or
 * the site's front page from a deeper path, which is how a removed article usually answers.
 * A redirect that only adds `https`, `www.` or a trailing `/` is the same page.
 */
export function isMove(from: URL, to: URL): boolean {
	let host = (url: URL) => url.hostname.replace(/^www\./, "");
	if (host(from) !== host(to)) return true;

	let path = (url: URL) => url.pathname.replace(/\/+$/, "");
	return path(from) !== "" && path(to) === "";
}

/** Cloudflare's answer when the origin's name does not resolve, among other faults. */
const ORIGIN_UNREACHABLE = 530;

/**
 * An unreachable origin's outcome: `gone` when its name no longer exists, which is how an
 * expired domain fails, and `flaky` for anything that may pass.
 */
async function unreachableOutcome(url: URL): Promise<Bookmark.Status> {
	let resolved = await resolveHost(url);
	if (isFailure(resolved) && resolved.error.code === "refused-host") return "gone";
	return "flaky";
}

/**
 * The outcome of a request that never got a response: a redirect loop is `gone`, a timeout
 * `flaky`, an address the request refused to reach `blocked`, and a failed connection
 * depends on whether the name still resolves.
 */
async function failedOutcome(url: URL, error: OutboundError): Promise<Bookmark.Status> {
	if (error.code === "too-many-redirects") return "gone";
	if (error.code === "timeout") return "flaky";
	if (error.code !== "network") return "blocked";
	return unreachableOutcome(url);
}

/** The outcome a response's status reports, before a redirect is considered. */
function statusOutcome(response: Response): Bookmark.Status {
	if (response.headers.get("cf-mitigated") === "challenge") return "blocked";
	if (GONE_STATUSES.has(response.status)) return "gone";
	if (REFUSING_STATUSES.has(response.status)) return "blocked";
	if (response.status >= 400 && response.status < 500) return "blocked";
	if (response.ok) return "ok";
	return "flaky";
}

/** Whether a response is a page whose markup can say what it is about. */
function isPage(response: Response): boolean {
	let type = response.headers.get("content-type")?.split(";").at(0)?.trim().toLowerCase();
	return type === "text/html" || type === "application/xhtml+xml";
}

/**
 * Reads a bookmarked page. Every outcome is an answer rather than an error, because a page
 * that cannot be read is what the caller came to find out about; the title and description
 * come only from a page that is `ok`, so a moved page never lends its new home's words.
 *
 * @param input The bookmark's absolute URL.
 * @param options The deadline, and the origin's `robots.txt` when the caller holds it.
 * @returns How the read went, with the page's title and description when it was up.
 * @example let reading = await readBookmarkPage(url, { timeout: 5_000 });
 */
export async function readBookmarkPage(
	input: string,
	options: BookmarkPage.Options,
): Promise<BookmarkPage.Reading> {
	if (!URL.canParse(input)) return unanswered("gone");
	let url = new URL(input);

	if (options.robots && !isAllowedBy(options.robots, BOOKMARK_USER_AGENT, url)) {
		return unanswered("blocked");
	}

	let followed = await follow(url, {
		headers: {
			accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
			"user-agent": BOOKMARK_USER_AGENT,
		},
		timeout: options.timeout,
		maxRedirects: 5,
		...(options.signal ? { signal: options.signal } : {}),
	});
	if (isFailure(followed)) return unanswered(await failedOutcome(url, followed.error));

	let { response } = followed.data;
	let finalUrl = followed.data.url;
	let status = statusOutcome(response);
	if (status === "ok" && isMove(url, finalUrl)) status = "moved";
	if (response.status === ORIGIN_UNREACHABLE) status = await unreachableOutcome(finalUrl);

	let reading: BookmarkPage.Reading = {
		status,
		httpStatus: response.status,
		finalUrl: finalUrl.href,
		title: null,
		description: null,
	};

	if (status !== "ok" || !isPage(response)) {
		release(response.body);
		return reading;
	}

	let body = await readText(response, { maxBytes: MAX_BYTES });
	if (isFailure(body)) return reading;

	let summary = summaryFrom(body.data.text, finalUrl.href);
	if (isFailure(summary)) return reading;

	return { ...reading, title: summary.data.title, description: summary.data.excerpt };
}
