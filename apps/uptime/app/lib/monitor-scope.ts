/**
 * The vocabulary of monitor scoping: the monitor types a rule can be narrowed to, the
 * match test its consumers run against a stored row, and the encoding that lets a single
 * `<select>` express all three scopes without two fields that can disagree.
 *
 * Shared by every table carrying a `(monitor_type, monitor_id)` pair, so they resolve the
 * pair through one module rather than drifting apart independently. Kept import-free so
 * the forms rendering scope options do not pull additional imports into the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every monitor type a scope can name, matching `alerts.monitor_type` and
 * `maintenance_windows.monitor_type`. An SSL check reports through its HTTP monitor's own
 * id, so a certificate event stays scoped and matched by whatever watches that monitor.
 */
export const MONITOR_SCOPE_TYPES = ["http", "dns", "tcp", "cron", "flow"] as const;

/** One of {@link MONITOR_SCOPE_TYPES}. */
export type MonitorScopeType = (typeof MONITOR_SCOPE_TYPES)[number];

/**
 * What a rule covers: everything (both fields null), every monitor of one type
 * (`monitorType` set, `monitorId` null), or one specific monitor (both set) — a
 * `monitorId` always carries the `monitorType` that names which table it points into.
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
 * The effective scope of a stored row. A `monitor_id` without a `monitor_type` predates
 * the type column, when an id could only name an HTTP monitor, so it reads as HTTP rather
 * than team-wide — reading it any other way would widen a rule beyond what was set.
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
 * The scope as one form-control value, so the create and edit forms offer team-wide,
 * per-type and per-monitor scoping from a single `<select>` with exactly one selected
 * option, keeping a submitted type and monitor id from ever contradicting each other.
 */
export function encodeMonitorScope(scope: MonitorScope): string {
	if (scope.monitorType === null) return "";
	if (scope.monitorId === null) return `type:${scope.monitorType}`;
	return `monitor:${scope.monitorType}:${scope.monitorId}`;
}

/**
 * Reads a value produced by {@link encodeMonitorScope} back into a scope, or `null` for
 * an unknown type, missing id, or bad prefix, so an invalid value never widens a rule to
 * team-wide; the id segment is rejoined on `:` so one containing a colon survives whole.
 */
export function parseMonitorScope(value: string): MonitorScope | null {
	if (value === "") return TEAM_WIDE_MONITOR_SCOPE;

	let [prefix, type, ...rest] = value.split(":");
	if (!isMonitorScopeType(type)) return null;

	if (prefix === "type") return rest.length === 0 ? { monitorType: type, monitorId: null } : null;

	if (prefix === "monitor") {
		let monitorId = rest.join(":");
		return monitorId === "" ? null : { monitorType: type, monitorId };
	}

	return null;
}

/** Narrows an arbitrary string to one of {@link MONITOR_SCOPE_TYPES}. */
export function isMonitorScopeType(value: string | undefined): value is MonitorScopeType {
	return MONITOR_SCOPE_TYPES.some((type) => type === value);
}
