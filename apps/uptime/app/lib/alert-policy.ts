/**
 * The two numbers that decide how often an alert repeats: what a new one waits by default,
 * and the closest together two repeats can ever land.
 *
 * They live here rather than beside the dispatcher because four layers quote them — the
 * dispatcher enforces them, the form validator defaults to one, the create/edit form prefills
 * and explains both, and the REST API defaults to the same one as the form. A constant defined
 * in any one of those and imported by the others would either invert a dependency (a service
 * reaching into `~/app/http`) or drag that layer's imports somewhere they must not go.
 *
 * The second failure is the concrete one, and it is why this module has no imports at all:
 * `resources/views/alerts/form.tsx` needs the floor to explain it to a customer, and importing
 * the dispatcher to get it pulled `~/app/services/cost` — and through it `cloudflare:workers` —
 * into the client bundle, which fails the build outright. `~/app/lib/pricing` is dependency-free
 * for exactly this reason and says so; this is the same rule applied to the same shape of fact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Minutes a new alert waits before repeating a notification during an ongoing outage.
 *
 * An hour, so an alert nobody configures reminds its team once an hour for as long as the
 * outage lasts rather than either flooding them or going silent. Existing alerts keep whatever
 * they were configured with — this is the default for a new one, not a rule imposed on old ones.
 */
export const DEFAULT_COOLDOWN_MINUTES = 60;

/**
 * The closest together two repeat notifications for one incident can land, whatever the alert
 * is configured with.
 *
 * This is what makes per-check notification unrepresentable now that nothing caps the number of
 * notifications one incident produces. A cooldown of `0` is a legal, stored value — the API
 * accepted it as a default for a long time — and on a monitor checked every minute it would
 * otherwise mean an email a minute for the whole outage.
 *
 * Five rather than one: the fastest check the app schedules is every 60 seconds, so anything
 * above a minute already makes one-notification-per-check impossible, and five keeps the worst
 * case at twelve an hour — the same order of magnitude the old per-incident ceiling allowed,
 * without ever going quiet.
 *
 * It is a floor on **repeats only**. The first notification of an incident has no earlier send
 * to be spaced from, so no floor can delay it, and a recovery is edge-triggered and keeps the
 * alert's own configured cooldown as its only gate.
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
