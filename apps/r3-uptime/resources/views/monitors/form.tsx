/**
 * Shared HTTP monitor form fields, used by both the new-monitor and edit-monitor
 * views. Renders name/URL/method/expected-status/interval/timeout/degraded-threshold/
 * location-hint inputs pre-filled from `handle.props.monitor` when editing. SSL
 * settings are a separate form/action (see `ssl-form.tsx`), matching the OLD APP's
 * edit page layout. It exists so the two pages don't duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import * as s from "~/resources/styles";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
const LOCATION_HINTS = [
	{ value: "wnam", label: "Western North America" },
	{ value: "enam", label: "Eastern North America" },
	{ value: "sam", label: "South America" },
	{ value: "weur", label: "Western Europe" },
	{ value: "eeur", label: "Eastern Europe" },
	{ value: "apac", label: "Asia-Pacific" },
	{ value: "oc", label: "Oceania" },
	{ value: "afr", label: "Africa" },
	{ value: "me", label: "Middle East" },
] as const;

namespace MonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectMonitor;
	}
}

export default function MonitorFormFields(handle: Handle<MonitorFormFields.Props>) {
	return () => {
		let monitor = handle.props.monitor;

		return (
			<>
				<label mix={[s.field]}>
					<span>Name</span>
					<input type="text" name="name" required defaultValue={monitor?.name} mix={[s.input]} />
				</label>

				<label mix={[s.field]}>
					<span>URL</span>
					<input
						type="url"
						name="url"
						required
						defaultValue={monitor?.url}
						placeholder="https://example.com"
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Method</span>
					<select name="method" defaultValue={monitor?.method ?? "HEAD"} mix={[s.selectInput]}>
						{HTTP_METHODS.map((method) => (
							<option key={method} value={method}>
								{method}
							</option>
						))}
					</select>
				</label>

				<label mix={[s.field]}>
					<span>Expected status code</span>
					<input
						type="number"
						name="expected_status"
						min={100}
						max={599}
						defaultValue={monitor?.expected_status ?? 200}
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Check interval (seconds)</span>
					<input
						type="number"
						name="interval_seconds"
						min={60}
						max={3600}
						defaultValue={monitor?.interval_seconds ?? 60}
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Timeout (seconds)</span>
					<input
						type="number"
						name="timeout_seconds"
						min={1}
						max={60}
						defaultValue={monitor?.timeout_seconds ?? 10}
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Degraded threshold (ms)</span>
					<input
						type="number"
						name="degraded_after_ms"
						min={1}
						max={60_000}
						defaultValue={monitor?.degraded_after_ms ?? 5000}
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Check region</span>
					<select
						name="location_hint"
						defaultValue={monitor?.location_hint ?? "wnam"}
						mix={[s.selectInput]}
					>
						{LOCATION_HINTS.map((hint) => (
							<option key={hint.value} value={hint.value}>
								{hint.label}
							</option>
						))}
					</select>
				</label>
			</>
		);
	};
}
