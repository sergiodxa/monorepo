/**
 * Where Wayfern's maps look: São Miguel in the Azores, the real island its invented stays sit
 * on. A search for one of its towns centres the map there; anything else frames the island, so
 * every pin starts in view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PLACES } from "./data";

/** The middle of São Miguel, which a map of the whole island centres on. */
const ISLAND_CENTER: [number, number] = [-25.47, 37.79];

/**
 * Where a map of a search centres and how close it zooms: on the town when the search names
 * one, on the whole island otherwise, close enough that a phone's map holds it end to end.
 *
 * @param place The searched town's id, if any.
 */
export function regionView(place: string | undefined): { center: [number, number]; zoom: number } {
	let found = PLACES.find((entry) => entry.id === place);
	return found === undefined
		? { center: ISLAND_CENTER, zoom: 8.3 }
		: { center: found.at, zoom: 12.4 };
}
