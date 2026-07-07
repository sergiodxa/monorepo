/**
 * Species content for the `pkmn` app's content layer — a thin loader over the
 * authored `species.json` data file.
 *
 * The species roster now lives in {@link ./species.json} as plain data. This
 * module imports that file and validates it back into the exact
 * `Record<SpeciesId, Species>` shape the game consumes via {@link parseSpecies},
 * so every consumer keeps importing `{ SPECIES }` from `~/content/species`
 * unchanged. Validation runs once at module load; a malformed data file fails
 * loudly here rather than surfacing as a confusing error deep in the engine.
 *
 * Keeping the data in JSON lets the dev-tools species editor read and rewrite it
 * as structured data, while this loader remains the single content-layer entry
 * point the rest of the app depends on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Species, SpeciesId } from "~/game/data/species";

import { parseSpecies } from "./species-schema";
import raw from "./species.json";

/** Complete species content for the original 151 Pokemon, loaded from JSON. */
export const SPECIES: Record<SpeciesId, Species> = parseSpecies(raw);
