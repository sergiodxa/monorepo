/**
 * Saving a bookmark: one URL becomes one bookmark, completed from the page itself before it
 * is stored, so the feeds and the WebSub ping that follow a save never carry a bookmark
 * without its title. The CMS create, edit and quick add all save through here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { BlogModels } from "~/app/models";

import { bookmarkAddress, cleanUrl } from "~/app/models/post-values";
import { readBookmarkPage } from "~/app/services/bookmark-page";

/**
 * How long saving waits on the bookmarked page. A person is waiting on the form, and a page
 * that misses it is still saved and read again in the background.
 */
export const SAVE_READ_TIMEOUT_MS = 5_000;

/** Types for saving bookmarks. */
export namespace Bookmarks {
	/** What a person submitted; empty strings mean "read it from the page". */
	export interface Fields {
		url: string;
		title?: string | undefined;
		description?: string | undefined;
	}

	/** A new bookmark, or the existing one that already holds the URL. */
	export type Created =
		| {
				outcome: "created";
				id: string;
				/** Whether the page was read while saving; when it was not, read it again later. */
				read: boolean;
		  }
		| { outcome: "duplicate"; id: string };

	/** An edited bookmark, the bookmark already holding its new URL, or a missing one. */
	export type Updated =
		| {
				outcome: "updated";
				/** Whether the URL now points elsewhere, which makes the page worth reading anew. */
				moved: boolean;
		  }
		| { outcome: "duplicate"; id: string }
		| { outcome: "missing" };
}

/** Raised when a bookmark was written but could not be read back. */
export class BookmarkSaveError extends Error {
	override name = "BookmarkSaveError";
}

/** Whether a stored URL points at another site, which is what a page read can reach. */
function isAbsolute(url: string): boolean {
	return /^https?:\/\//i.test(url);
}

/**
 * Creates a bookmark from a URL, or answers the bookmark that already holds it. The page is
 * read before saving and fills whatever the form left empty; a value typed in the form wins.
 * Of two concurrent saves of one URL exactly one survives, and the other is tombstoned.
 *
 * @param models The invocation's models, read and written through.
 * @param authorId The person saving it.
 * @param fields The URL, and the title and description when typed.
 * @returns The created bookmark, or the duplicate it would have been.
 */
export async function createBookmark(
	models: BlogModels,
	authorId: string,
	fields: Bookmarks.Fields,
): Promise<Result<Bookmarks.Created, BookmarkSaveError>> {
	let url = cleanUrl(fields.url);
	let address = bookmarkAddress(url);

	let holder = await models.bookmarks.findByAddress(address);
	if (holder) return success({ outcome: "duplicate", id: holder.post_id });

	let reading = isAbsolute(url)
		? await readBookmarkPage(url, { timeout: SAVE_READ_TIMEOUT_MS })
		: null;

	let saved = await models.likes.create({
		author_id: authorId,
		meta: {
			url,
			title: fields.title?.trim() || reading?.title || "",
			description: fields.description?.trim() || reading?.description || "",
		},
	});
	if (isFailure(saved)) {
		return failure(
			new BookmarkSaveError(`Bookmark for ${url} was not saved`, { cause: saved.error }),
		);
	}
	let created = saved.data;

	if (!(await models.bookmarks.claim(created.id, address, reading))) {
		await models.likes.destroy(created.id);
		let winner = await models.bookmarks.findByAddress(address);
		return success({ outcome: "duplicate", id: winner?.post_id ?? created.id });
	}

	return success({ outcome: "created", id: created.id, read: reading?.status === "ok" });
}

/**
 * Saves an edit. Saving reviews the bookmark, closing any flag raised before it; a URL that
 * changed address moves the bookmark's record to it, unless another bookmark holds it, and
 * drops the old URL's archive, since that capture shows another page.
 *
 * @param models The invocation's models, read and written through.
 * @param id The bookmark being edited.
 * @param authorId The person saving it.
 * @param fields Every field of the edit form; an emptied title or description is read again.
 * @returns How the edit went.
 */
export async function updateBookmark(
	models: BlogModels,
	id: string,
	authorId: string,
	fields: Bookmarks.Fields,
): Promise<Bookmarks.Updated> {
	let bookmark = await models.likes.find(id);
	if (!bookmark) return { outcome: "missing" };

	let url = cleanUrl(fields.url);
	let address = bookmarkAddress(url);
	let moved = address !== bookmarkAddress(bookmark.meta.url);

	let holder = await models.bookmarks.findByAddress(address);
	if (holder && holder.post_id !== id) return { outcome: "duplicate", id: holder.post_id };

	await models.likes.update(id, {
		author_id: authorId,
		meta: {
			url,
			title: fields.title?.trim() ?? "",
			description: fields.description?.trim() ?? "",
			...(moved ? { archived_at: "" } : {}),
		},
	});

	if (moved || !holder) await models.bookmarks.readdress(id, address);
	await models.bookmarks.review(id);

	return { outcome: "updated", moved };
}
