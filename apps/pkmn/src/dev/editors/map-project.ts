/**
 * An ordered set of maps (the RPG-Maker "map tree") with one active map, each held
 * as its own live {@link MapEditor} so grids, events, and in-progress UI state stay
 * per map. Ids double as the export filename and the manifest key, so create and
 * rename validate against {@link MAP_ID_PATTERN} first.
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
 * Validates a candidate map id against the rules the export path enforces
 * ({@link MAP_ID_PATTERN}, length). One shared gate for create and rename, so every
 * id a project stores is one the export can write.
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
 * An ordered collection of maps (each a live {@link MapEditor}) with one active map.
 * Every editing gesture goes through {@link active}, whose per-map editor owns that
 * map's whole state; a project always holds at least one map.
 */
export class MapProject {
	/** Insertion order is the tree order. */
	#maps: Map<string, MapEditor>;

	/** Always names a key of {@link #maps}. */
	#activeId: string;

	/**
	 * A supplied id that fails validation falls back to {@link DEFAULT_MAP_ID}, so
	 * construction always yields a project with a valid active map.
	 *
	 * @param options Optional id and dimensions for the first map; omitted fields fall
	 *   back to the module defaults so a fresh project starts on a sensible empty map.
	 */
	constructor(options?: { id?: string; width?: number; height?: number }) {
		let id = validateMapId(options?.id ?? DEFAULT_MAP_ID);
		let firstId = isSuccess(id) ? id.data : DEFAULT_MAP_ID;
		let width = options?.width ?? DEFAULT_MAP_WIDTH;
		let height = options?.height ?? DEFAULT_MAP_HEIGHT;
		this.#maps = new Map([[firstId, new MapEditor({ id: firstId, width, height })]]);
		this.#activeId = firstId;
	}

	/** Always names a map the project holds. */
	get activeMapId(): string {
		return this.#activeId;
	}

	/**
	 * The active map's editor — the target of every editing gesture. The active id
	 * always names a live editor, so the lookup always resolves.
	 */
	get active(): MapEditor {
		return this.#maps.get(this.#activeId)!;
	}

	/** The number of maps; always at least one. */
	get size(): number {
		return this.#maps.size;
	}

	/** The map ids in tree order, as a fresh array the caller owns. */
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
	 * Makes the map with the given id active. An unknown id fails and leaves the
	 * selection where it was, so the active id always names a live map.
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
	 * Renames a map in place, keeping its tree position and live editor state.
	 * Renaming to the same id succeeds as a no-op; the editor's id and the active
	 * selection both follow the rename, so an export writes under the new filename.
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
			let next = ids[index + 1] ?? ids[index - 1]!;
			this.#activeId = next;
		}
		return success(id);
	}
}
