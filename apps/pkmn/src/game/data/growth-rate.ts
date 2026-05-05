/**
 * Defines the growth-rate data contract used by the game data layer.
 *
 * This module centralizes the stable identifiers for the available growth-rate categories so other parts of the system can reference progression behavior through a shared, content-agnostic vocabulary. Keeping these values together helps preserve consistency anywhere growth-rate data is stored, compared, or serialized.
 *
 * The module only exposes the canonical set of growth-rate options and does not implement progression formulas or balancing rules itself. Its role is to provide a small, explicit boundary for this piece of domain data so engine and content code can depend on the same normalized values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Experience growth rate of the creature */
export enum GrowthRate {
	Fast = "fast",
	MediumFast = "medium-fast",
	MediumSlow = "medium-slow",
	Slow = "slow",
	Fluctuating = "fluctuating",
}
