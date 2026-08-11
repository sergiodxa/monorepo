/**
 * The vocabulary of monitor scoping: the monitor types a rule can be narrowed to, the
 * match test its consumers run against a stored row, and the encoding that lets a single
 * `<select>` express all three scopes without two fields that can disagree.
 *
 * Shared by every table that carries a `(monitor_type, monitor_id)` pair — `alerts` and
 * `maintenance_windows` today. Both had the same gap for the same reason and closed it
 * the same way, so they resolve the pair through one module rather than through two that
 * would drift apart the first time a fifth monitor type is added.
 *
 * Deliberately import-free, like `~/app/lib/alert-policy`: the forms render scope options
 * from it, and anything it imported would follow the views into the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every monitor type a scope can name, and the value set of both `alerts.monitor_type`
 * and `maintenance_windows.monitor_type`.
 *
 * `"ssl"` is absent on purpose, unlike in `alert_events.monitor_type`. An SSL check runs
 * against an HTTP monitor's own row rather than a table of its own, so a certificate
 * event is dispatched with that monitor's id and is matched by whatever watches it —
 * a separate scope would silently split one monitor's notifications, and its maintenance
 * windows, in two.
 */
export const MONITOR_SCOPE_TYPES = ["http", "dns", "tcp", "cron"] as const;

/** One of {@link MONITOR_SCOPE_TYPES}. */
export type MonitorScopeType = (typeof MONITOR_SCOPE_TYPES)[number];

/**
 * What a rule covers, as the three cases the product offers:
 *
 * - `{ monitorType: null, monitorId: null }` — every monitor of every type (team-wide).
 * - `{ monitorType: "dns", monitorId: null }` — every monitor of that type.
 * - `{ monitorType: "dns", monitorId: "…" }` — that one monitor.
 *
 * A `monitorId` without a `monitorType` is not representable: an id alone cannot say
 * which monitor table it points into, which is the gap this type exists to close.
 */
export interface MonitorScope {
	monitorType: MonitorScopeType | null;
	monitorId: string | null;
}

/** The scope a rule has when nobody narrows it: everything the team monitors. */
export const TEAM_WIDE_MONITOR_SCOPE: MonitorScope = { monitorType: null, monitorId: null };

/** The stored columns {@link storedMonitorScope} reads, so callers can pass a row directly. */
export interface StoredMonitorScopeColumns {
	monitor_type: MonitorScopeType | null;
	monitor_id: string | null;
}

/**
 * The effective scope of a stored row.
 *
 * A row carrying a `monitor_id` but no `monitor_type` predates the type column, back when
 * `monitor_id` could only ever name an HTTP monitor — so it is read as HTTP rather than as
 * team-wide. Reading it as anything else would either widen a rule somebody narrowed or
 * point it at a different monitor table entirely. The migrations backfill those rows for
 * the same reason; this keeps the invariant true even for a row that escaped one.
 */
export function storedMonitorScope(row: StoredMonitorScopeColumns): MonitorScope {
	if (row.monitor_id === null) return { monitorType: row.monitor_type, monitorId: null };
	return { monitorType: row.monitor_type ?? "http", monitorId: row.monitor_id };
}

/**
 * Whether a rule with `scope` applies to a check result from `monitorType`/`monitorId`.
 *
 * A scope with no type matches everything, which is what keeps every row that exists
 * today behaving exactly as it did: an unscoped rule stays team-wide.
 */
export function monitorScopeMatches(
	scope: MonitorScope,
	monitorType: MonitorScopeType,
	monitorId: string,
): boolean {
	if (scope.monitorType === null) return true;
	if (scope.monitorType !== monitorType) return false;
	return scope.monitorId === null || scope.monitorId === monitorId;
}

/**
 * The scope as one form-control value, so the create and edit forms can offer team-wide,
 * per-type and per-monitor scoping from a single `<select>` with exactly one selected
 * option. Two coupled controls could be submitted in states that contradict each other
 * (a type of `dns` beside an HTTP monitor's id), and no markup-only form can stop that.
 */
export function encodeMonitorScope(scope: MonitorScope): string {
	if (scope.monitorType === null) return "";
	if (scope.monitorId === null) return `type:${scope.monitorType}`;
	return `monitor:${scope.monitorType}:${scope.monitorId}`;
}

/**
 * Reads a value produced by {@link encodeMonitorScope} back into a scope, or `null` when
 * it is not one — an unknown monitor type, a missing id, an unrecognised prefix. Callers
 * treat `null` as a validation failure rather than as team-wide, so a value nobody's form
 * produced can never quietly widen a rule to everything.
 */
export function parseMonitorScope(value: string): MonitorScope | null {
	if (value === "") return TEAM_WIDE_MONITOR_SCOPE;

	let [prefix, type, ...rest] = value.split(":");
	if (!isMonitorScopeType(type)) return null;

	if (prefix === "type") return rest.length === 0 ? { monitorType: type, monitorId: null } : null;

	if (prefix === "monitor") {
		// Rejoined rather than taken as one segment: an id is a UUID today, and a future one
		// holding a colon should read back as itself instead of being silently truncated.
		let monitorId = rest.join(":");
		return monitorId === "" ? null : { monitorType: type, monitorId };
	}

	return null;
}

/** Narrows an arbitrary string to one of {@link MONITOR_SCOPE_TYPES}. */
export function isMonitorScopeType(value: string | undefined): value is MonitorScopeType {
	return MONITOR_SCOPE_TYPES.some((type) => type === value);
}
