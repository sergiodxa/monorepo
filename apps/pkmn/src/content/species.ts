/**
 * Loads the authored `species.json` roster and validates it into the
 * `Record<SpeciesId, Species>` shape the game consumes. Validation runs once at
 * module load so a malformed data file fails loudly here, and holding the
 * roster as JSON lets the species editor read and rewrite it as structured data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Species, SpeciesId } from "~/game/data/species";

import { parseSpecies } from "./species-schema";
import raw from "./species.json";

/** Complete species content for the original 151 Pokemon, loaded from JSON. */
export const SPECIES: Record<SpeciesId, Species> = parseSpecies(raw);
