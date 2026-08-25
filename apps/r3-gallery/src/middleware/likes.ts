/**
 * Likes middleware and storage for the gallery. It exposes a context key plus a
 * localStorage-backed store (with an in-memory fallback for non-browser runs) that
 * lists, checks, and toggles liked photo ids per album, so route actions can persist
 * likes across navigations without a server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Context, Middleware } from "@pkg/ui-router";

import { createContextKey } from "@pkg/ui-router";

const LIKES_STORAGE_KEY = "r3-gallery:liked-photos";

/** Stores and retrieves liked photo ids for the gallery. */
export interface LikesStorage {
	/** Returns liked photo ids for one album. */
	list(albumId: string): number[];
	/** Returns whether a photo is liked in one album. */
	has(albumId: string, photoId: string): boolean;
	/** Toggles one photo like and returns the new state. */
	toggle(albumId: string, photoId: string): LikeToggleResult;
}

/** Result returned after toggling one photo like. */
export interface LikeToggleResult {
	photoId: number;
	liked: boolean;
	likedPhotoIds: number[];
}

/** Context key that exposes localStorage-backed likes to route actions. */
export const Likes = createContextKey<LikesStorage>();

/** Adds localStorage-backed likes storage to every route action context. */
export const loadLikes: Middleware = async function loadLikes(ctx, next) {
	ctx.set(Likes, createLikesStorage());

	return next();
};

/** Requires likes storage from middleware, falling back to an empty storage for safety. */
export function getLikes(ctx: Pick<Context, "get">): LikesStorage {
	return ctx.get(Likes) ?? createMemoryLikesStorage();
}

/** Creates localStorage-backed likes storage when browser storage is available. */
function createLikesStorage(): LikesStorage {
	if (typeof localStorage === "undefined") return createMemoryLikesStorage();

	return {
		list(albumId) {
			let snapshot = readSnapshot();

			return snapshot[albumId] ?? [];
		},

		has(albumId, photoId) {
			return this.list(albumId).includes(Number(photoId));
		},

		toggle(albumId, photoId) {
			let snapshot = readSnapshot();
			let likedPhotoIds = snapshot[albumId] ?? [];
			let numericPhotoId = Number(photoId);
			let liked = !likedPhotoIds.includes(numericPhotoId);

			if (liked) {
				likedPhotoIds = [...likedPhotoIds, numericPhotoId].sort((left, right) => left - right);
			} else {
				likedPhotoIds = likedPhotoIds.filter((likedPhotoId) => likedPhotoId !== numericPhotoId);
			}

			snapshot[albumId] = likedPhotoIds;
			writeSnapshot(snapshot);

			return { photoId: numericPhotoId, liked, likedPhotoIds };
		},
	};
}

/** Creates volatile likes storage for non-browser execution. */
function createMemoryLikesStorage(): LikesStorage {
	let snapshot: Record<string, number[]> = {};

	return {
		list(albumId) {
			return snapshot[albumId] ?? [];
		},

		has(albumId, photoId) {
			return this.list(albumId).includes(Number(photoId));
		},

		toggle(albumId, photoId) {
			let likedPhotoIds = snapshot[albumId] ?? [];
			let numericPhotoId = Number(photoId);
			let liked = !likedPhotoIds.includes(numericPhotoId);

			if (liked) {
				likedPhotoIds = [...likedPhotoIds, numericPhotoId].sort((left, right) => left - right);
			} else {
				likedPhotoIds = likedPhotoIds.filter((likedPhotoId) => likedPhotoId !== numericPhotoId);
			}

			snapshot = { ...snapshot, [albumId]: likedPhotoIds };

			return { photoId: numericPhotoId, liked, likedPhotoIds };
		},
	};
}

/** Reads the persisted likes snapshot, ignoring malformed storage values. */
function readSnapshot(): Record<string, number[]> {
	let value = localStorage.getItem(LIKES_STORAGE_KEY);

	if (!value) return {};

	try {
		let parsed = JSON.parse(value);

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

		return normalizeSnapshot(parsed as Record<string, unknown>);
	} catch {
		return {};
	}
}

/** Persists the full likes snapshot. */
function writeSnapshot(snapshot: Record<string, number[]>) {
	localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(snapshot));
}

/** Keeps only album keys with numeric photo id arrays. */
function normalizeSnapshot(snapshot: Record<string, unknown>): Record<string, number[]> {
	let normalized: Record<string, number[]> = {};

	for (let albumId in snapshot) {
		let photoIds = snapshot[albumId];

		if (!Array.isArray(photoIds)) continue;

		normalized[albumId] = photoIds.filter((photoId) => typeof photoId === "number");
	}

	return normalized;
}
