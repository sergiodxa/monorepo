/**
 * Coordinates bestiary progress updates for player-owned discovery and capture records,
 * avoiding duplicate entries and preserving the invariant that a caught species is also
 * recorded as seen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpeciesId } from "~/game/data/species";

import type { PlayerId } from "../world/ids";
import type { World } from "../world/world";

import { getPlayerBestiary } from "../world/world";

/** Marks one species as seen without duplicating existing progress. */
export function markSpeciesSeen(world: World, playerId: PlayerId, speciesId: SpeciesId) {
	let bestiary = getPlayerBestiary(world);
	if (bestiary.seen.includes(speciesId)) return bestiary;

	world.bestiary[playerId] = {
		seen: [...bestiary.seen, speciesId],
		caught: [...bestiary.caught],
	};

	return getPlayerBestiary(world);
}

/** Marks one species as caught and guarantees it also counts as seen. */
export function markSpeciesCaught(world: World, playerId: PlayerId, speciesId: SpeciesId) {
	let bestiary = getPlayerBestiary(world);
	let seen = bestiary.seen.includes(speciesId) ? [...bestiary.seen] : [...bestiary.seen, speciesId];
	let caught = bestiary.caught.includes(speciesId)
		? [...bestiary.caught]
		: [...bestiary.caught, speciesId];

	world.bestiary[playerId] = { seen, caught };
	return getPlayerBestiary(world);
}
