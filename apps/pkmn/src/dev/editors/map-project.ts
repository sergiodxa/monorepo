/**
 * Multi-map project wrapper around the single-map {@link MapEditor}. A `MapProject`
 * owns an ORDERED set of maps and tracks which one is active, so the map tool can
 * manage several maps in one session (the RPG-Maker "map tree") instead of a single
 * map at a time.
 *
 * Each map is held as its own live {@link MapEditor} instance, keyed by id. This is
 * deliberately richer than serializing/rehydrating `MapData` on every switch: an
 * editor holds not just the grids/tilesets/events a `MapData` captures but also the
 * in-progress UI state (active layer/tool, tile selection, zoom, clipboard, the
 * current selection region). Keeping one editor per map means switching maps never
 * touches another map's state, so edits can never leak across maps. The project only
 * mediates lifecycle — create/select/rename/delete and ordered access — and forwards
 * every editing gesture to {@link MapProject.active}.
 *
 * Ids double as the export filename and the manifest key, so the project reuses the
 * same {@link MAP_ID_PATTERN} the export path enforces: a create or rename with a
 * blank, duplicate, or non-slug id is rejected (a {@link Result} failure) before it
 * can produce a map the export could never write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, isFailure, isSuccess, type Result, success } from "@pkg/result";

import { MAP_ID_PATTERN, MAX_MAP_ID_LENGTH } from "../map-export";

import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, MapEditor } from "./map-editor";

/** The default id a fresh project's first map is created under. */
export const DEFAULT_MAP_ID = "map-1";

/** Error describing why a project operation (create/rename) was rejected. */
export class MapProjectError extends Error {
	/** @param message Human-readable reason the operation failed. */
	constructor(message: string) {
		super(message);
		this.name = "MapProjectError";
	}
}

/**
 * Validates a candidate map id against the same rules the export path enforces
 * ({@link MAP_ID_PATTERN}, length), returning the trimmed id on success. Kept pure so
 * both {@link MapProject.newMap} and {@link MapProject.renameMap} share one gate and a
 * rejected id never reaches the export.
 *
 * @param id The candidate id (trimmed here).
 * @returns Success with the trimmed id, or failure with a {@link MapProjectError}.
 */
export function validateMapId(id: string): Result<string, MapProjectError> {
	let trimmed = id.trim();
	if (trimmed.length === 0) return failure(new MapProjectError("Map id is required."));
	if (trimmed.length > MAX_MAP_ID_LENGTH) {
		return failure(new MapProjectError(`Map id must be at most ${MAX_MAP_ID_LENGTH} characters.`));
	}
	if (!MAP_ID_PATTERN.test(trimmed)) {
		return failure(
			new MapProjectError(
				"Map id must be a lowercase slug: letters, digits, and single hyphens (no leading or trailing hyphen).",
			),
		);
	}
	return success(trimmed);
}

/**
 * An ordered collection of maps (each a live {@link MapEditor}) with one active map,
 * mediating only the lifecycle: create, select, rename, delete, and ordered access.
 * Every editing gesture goes through {@link active}, whose per-map editor holds all of
 * that map's state so switching maps never leaks edits between them. A project always
 * holds at least one map (the last one cannot be deleted).
 */
export class MapProject {
	/** The maps keyed by id, holding a live editor each (insertion order = tree order). */
	#maps: Map<string, MapEditor>;

	/** The id of the active map (always names a key of {@link #maps}). */
	#activeId: string;

	/**
	 * @param options Optional id and dimensions for the first map; omitted fields fall
	 *   back to the module defaults so a fresh project starts on a sensible empty map.
	 */
	constructor(options?: { id?: string; width?: number; height?: number }) {
		let id = validateMapId(options?.id ?? DEFAULT_MAP_ID);
		// Fall back to the default id when a caller-supplied one is invalid, so a project
		// can always be constructed with a valid active map.
		let firstId = isSuccess(id) ? id.data : DEFAULT_MAP_ID;
		let width = options?.width ?? DEFAULT_MAP_WIDTH;
		let height = options?.height ?? DEFAULT_MAP_HEIGHT;
		this.#maps = new Map([[firstId, new MapEditor({ id: firstId, width, height })]]);
		this.#activeId = firstId;
	}

	/** The id of the currently active map. */
	get activeMapId(): string {
		return this.#activeId;
	}

	/** The active map's editor — the target of every editing gesture. */
	get active(): MapEditor {
		// Non-null: the active id always names a live editor by construction.
		return this.#maps.get(this.#activeId)!;
	}

	/** How many maps the project holds. */
	get size(): number {
		return this.#maps.size;
	}

	/** The map ids in tree order (a copy, so callers cannot mutate the ordering). */
	mapIds(): string[] {
		return [...this.#maps.keys()];
	}

	/** True when a map with the given id exists in the project. */
	has(id: string): boolean {
		return this.#maps.has(id);
	}

	/** The editor for a given map id, or `null` when no such map exists. */
	editor(id: string): MapEditor | null {
		return this.#maps.get(id) ?? null;
	}

	/**
	 * Creates a fresh empty map, adds it at the end of the tree, and selects it. The id
	 * is validated (slug rules) and must not collide with an existing map. On success
	 * the new map is active; on failure nothing changes.
	 *
	 * @param id The new map id (validated and trimmed).
	 * @param width New map width in tiles (defaults to the module default).
	 * @param height New map height in tiles (defaults to the module default).
	 * @returns Success with the trimmed id, or failure with a {@link MapProjectError}.
	 */
	newMap(
		id: string,
		width: number = DEFAULT_MAP_WIDTH,
		height: number = DEFAULT_MAP_HEIGHT,
	): Result<string, MapProjectError> {
		let valid = validateMapId(id);
		if (isFailure(valid)) return valid;
		if (this.#maps.has(valid.data)) {
			return failure(new MapProjectError(`A map with id "${valid.data}" already exists.`));
		}
		this.#maps.set(valid.data, new MapEditor({ id: valid.data, width, height }));
		this.#activeId = valid.data;
		return success(valid.data);
	}

	/**
	 * Makes the map with the given id active. A no-op failure for an unknown id, so a
	 * stale selection can never leave the project pointing at a missing map.
	 *
	 * @param id The map id to activate.
	 * @returns Success with the id, or failure with a {@link MapProjectError}.
	 */
	selectMap(id: string): Result<string, MapProjectError> {
		if (!this.#maps.has(id)) {
			return failure(new MapProjectError(`No map with id "${id}".`));
		}
		this.#activeId = id;
		return success(id);
	}

	/**
	 * Renames a map, keeping its position in the tree and its live editor (all
	 * in-progress edits) intact. The new id is validated and must not collide with a
	 * different existing map; renaming to the same id is a no-op success. The editor's
	 * own id is updated so an export writes the new filename, and the active selection
	 * follows the rename.
	 *
	 * @param oldId The id of the map to rename.
	 * @param newId The new id (validated and trimmed).
	 * @returns Success with the trimmed new id, or failure with a {@link MapProjectError}.
	 */
	renameMap(oldId: string, newId: string): Result<string, MapProjectError> {
		let editor = this.#maps.get(oldId);
		if (!editor) return failure(new MapProjectError(`No map with id "${oldId}".`));

		let valid = validateMapId(newId);
		if (isFailure(valid)) return valid;
		if (valid.data === oldId) return success(oldId);
		if (this.#maps.has(valid.data)) {
			return failure(new MapProjectError(`A map with id "${valid.data}" already exists.`));
		}

		// Rebuild the map preserving insertion order, swapping the renamed key in place so
		// the tree ordering is unchanged.
		let rebuilt = new Map<string, MapEditor>();
		for (let [key, value] of this.#maps) {
			if (key === oldId) rebuilt.set(valid.data, value.setId(valid.data));
			else rebuilt.set(key, value);
		}
		this.#maps = rebuilt;
		if (this.#activeId === oldId) this.#activeId = valid.data;
		return success(valid.data);
	}

	/**
	 * Deletes a map. Refuses to remove the last map (a project always holds at least
	 * one) and is a no-op failure for an unknown id. When the active map is deleted the
	 * selection moves to an adjacent map so the project always has a valid active map.
	 *
	 * @param id The map id to delete.
	 * @returns Success with the id, or failure with a {@link MapProjectError}.
	 */
	deleteMap(id: string): Result<string, MapProjectError> {
		if (!this.#maps.has(id)) return failure(new MapProjectError(`No map with id "${id}".`));
		if (this.#maps.size <= 1) {
			return failure(new MapProjectError("A project must keep at least one map."));
		}

		let ids = this.mapIds();
		let index = ids.indexOf(id);
		this.#maps.delete(id);

		if (this.#activeId === id) {
			// Select the neighbor that used to follow the deleted map, else the one before.
			let next = ids[index + 1] ?? ids[index - 1]!;
			this.#activeId = next;
		}
		return success(id);
	}
}
