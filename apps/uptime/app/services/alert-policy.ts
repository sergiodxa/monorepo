/**
 * The two numbers that decide how often an alert repeats: what a new one waits by default,
 * and the closest together two repeats can ever land.
 *
 * They live here, free of imports, because four layers quote them — the dispatcher, the form
 * validator, the create/edit form, and the REST API — and pulling either constant from the
 * dispatcher would drag `~/app/services/cost` and `cloudflare:workers` into the client bundle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Minutes a new alert waits before repeating a notification during an ongoing outage.
 *
 * An hour, so an alert nobody configures reminds its team once an hour for the outage's
 * duration without flooding them; existing alerts keep whatever cooldown they were configured with.
 */
export const DEFAULT_COOLDOWN_MINUTES = 60;

/**
 * The closest together two repeat notifications for one incident can land, whatever the
 * alert is configured with, including a stored cooldown of `0`. Five minutes, since the
 * fastest scheduled check is 60 seconds; it floors repeats only, never delaying the first send.
 */
export const MIN_REPEAT_COOLDOWN_MINUTES = 5;

/**
 * The cooldown a repeat notification is actually spaced by: what the team configured, or
 * {@link MIN_REPEAT_COOLDOWN_MINUTES} when that is lower.
 *
 * @param cooldownMinutes - The alert's stored `cooldown_minutes`.
 * @returns Minutes to space repeats by.
 * @example repeatCooldownMinutes(0) // 5
 * @example repeatCooldownMinutes(120) // 120
 */
export function repeatCooldownMinutes(cooldownMinutes: number): number {
	return Math.max(cooldownMinutes, MIN_REPEAT_COOLDOWN_MINUTES);
}
