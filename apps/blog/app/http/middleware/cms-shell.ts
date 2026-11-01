/**
 * Publishes what the CMS sidebar counts on every CMS page: Webmentions waiting for moderation
 * and bookmarks whose moved or gone flag awaits review. It runs behind the admin guard, so an
 * anonymous request never pays for the two reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

import { currentRequest } from "~/app/http/current-request";

/** The queues the CMS sidebar draws as counts beside their rows. */
export interface CMSShellData {
	pendingWebmentions: number;
	openBookmarkFlags: number;
}

const CMS_SHELL_KEY = createContextKey<CMSShellData>();

/** Reads both queue sizes before the page renders, in parallel. */
let cmsShell: Middleware = async (ctx, next) => {
	let [pending, open] = await Promise.all([
		ctx.models.webmentions.query().where({ status: "pending" }).count(),
		ctx.models.bookmarks.findOpen(),
	]);
	ctx.set(CMS_SHELL_KEY, { pendingWebmentions: pending, openBookmarkFlags: open.size });
	return next();
};

export default cmsShell;

/**
 * The counts this request's CMS page draws, or `null` on a page rendered outside the CMS
 * guards, such as a test rendering one view, which then draws the sidebar without counts.
 */
export function readCMSShell(): CMSShellData | null {
	let ctx = currentRequest();
	return ctx?.has(CMS_SHELL_KEY) ? (ctx.get(CMS_SHELL_KEY) ?? null) : null;
}
