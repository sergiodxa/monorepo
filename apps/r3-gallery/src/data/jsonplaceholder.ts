/**
 * JSONPlaceholder data layer for the gallery. It fetches and schema-validates albums,
 * a single album, an album's photos, and a single photo, returning Result values so
 * network and validation failures are handled without throwing. It centralizes all of
 * the app's remote data access behind one typed, non-throwing API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success, wrap } from "@pkg/result";
import * as s from "remix/data-schema";

import type { Album, Photo } from "./types";

import { AlbumListSchema, AlbumSchema, PhotoListSchema, PhotoSchema } from "./types";

/** JSONPlaceholder API origin used by all gallery data requests. */
const API_ORIGIN = "https://jsonplaceholder.typicode.com";

/**
 * Fetches and validates the album list shown on the home route.
 *
 * @param signal Abort signal tied to the current route render.
 * @returns Album records or a validation/network failure.
 */
export async function getAlbums(signal: AbortSignal): Promise<Result<Album[], Error>> {
	let url = new URL("/albums", API_ORIGIN);
	url.searchParams.set("_limit", "24");

	let result = await fetchJSON(url, signal);

	if (isFailure(result)) return result;

	let parsed = s.parseSafe(AlbumListSchema, result.data);

	if (!parsed.success) return failure(new Error("Albums response was not valid."));

	return success(parsed.value);
}

/**
 * Fetches and validates one album by id.
 *
 * @param id Album id from the matched route params.
 * @param signal Abort signal tied to the current route render.
 * @returns The album record or a validation/network failure.
 */
export async function getAlbum(id: string, signal: AbortSignal): Promise<Result<Album, Error>> {
	let result = await fetchJSON(new URL(`/albums/${id}`, API_ORIGIN), signal);

	if (isFailure(result)) return result;

	let parsed = s.parseSafe(AlbumSchema, result.data);

	if (!parsed.success) return failure(new Error("Album response was not valid."));

	return success(parsed.value);
}

/**
 * Fetches and validates the photos that belong to one album.
 *
 * @param id Album id from the matched route params.
 * @param signal Abort signal tied to the current route render.
 * @returns Photo records or a validation/network failure.
 */
export async function getAlbumPhotos(
	id: string,
	signal: AbortSignal,
): Promise<Result<Photo[], Error>> {
	let url = new URL("/photos", API_ORIGIN);
	url.searchParams.set("albumId", id);

	let result = await fetchJSON(url, signal);

	if (isFailure(result)) return result;

	let parsed = s.parseSafe(PhotoListSchema, result.data);

	if (!parsed.success) return failure(new Error("Photos response was not valid."));

	return success(parsed.value);
}

/**
 * Fetches and validates one photo by id.
 *
 * @param id Photo id from the matched route params.
 * @param signal Abort signal tied to the current route render.
 * @returns The photo record or a validation/network failure.
 */
export async function getPhoto(id: string, signal: AbortSignal): Promise<Result<Photo, Error>> {
	let result = await fetchJSON(new URL(`/photos/${id}`, API_ORIGIN), signal);

	if (isFailure(result)) return result;

	let parsed = s.parseSafe(PhotoSchema, result.data);

	if (!parsed.success) return failure(new Error("Photo response was not valid."));

	return success(parsed.value);
}

/**
 * Fetches JSON without throwing, preserving network and parse failures as results.
 *
 * @param url JSONPlaceholder endpoint URL.
 * @param signal Abort signal tied to the current route render.
 * @returns Parsed JSON or an Error failure.
 */
async function fetchJSON(url: URL, signal: AbortSignal): Promise<Result<unknown, Error>> {
	let responseResult = await wrap(() => fetch(url, { signal }));

	if (isFailure(responseResult)) return responseResult;
	if (!responseResult.data.ok) {
		return failure(new Error(`Request failed with status ${responseResult.data.status}.`));
	}

	return wrap(() => responseResult.data.json() as Promise<unknown>);
}
