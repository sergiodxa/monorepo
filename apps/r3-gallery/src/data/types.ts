import type { InferOutput } from "remix/data-schema";

import * as s from "remix/data-schema";

/** Validates JSONPlaceholder album payloads. */
export const AlbumSchema = s.object({
	userId: s.number(),
	id: s.number(),
	title: s.string(),
});

/** Validates JSONPlaceholder photo payloads. */
export const PhotoSchema = s.object({
	albumId: s.number(),
	id: s.number(),
	title: s.string(),
	url: s.string(),
	thumbnailUrl: s.string(),
});

/** Validates JSONPlaceholder album collection payloads. */
export const AlbumListSchema = s.array(AlbumSchema);

/** Validates JSONPlaceholder photo collection payloads. */
export const PhotoListSchema = s.array(PhotoSchema);

/** JSONPlaceholder album record used by the gallery. */
export type Album = InferOutput<typeof AlbumSchema>;

/** JSONPlaceholder photo record used by album grids and detail views. */
export type Photo = InferOutput<typeof PhotoSchema>;
