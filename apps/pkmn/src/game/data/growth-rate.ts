/**
 * Growth-rate data contract used by the game data layer.
 *
 * Centralizes the canonical growth-rate identifiers so progression code
 * references a shared, content-agnostic vocabulary instead of ad hoc values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Experience growth rate of the creature */
export enum GrowthRate {
	Erratic = "erratic",
	Fast = "fast",
	MediumFast = "medium-fast",
	MediumSlow = "medium-slow",
	Slow = "slow",
	Fluctuating = "fluctuating",
}
