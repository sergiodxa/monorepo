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

import Field from "~/resources/components/field";
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
				<Field label="Name">
					<input type="text" name="name" required defaultValue={monitor?.name} mix={[s.input]} />
				</Field>

				<Field label="URL">
					<input
						type="url"
						name="url"
						required
						defaultValue={monitor?.url}
						placeholder="https://example.com"
						mix={[s.input]}
					/>
				</Field>

				<Field label="Method">
					<select name="method" defaultValue={monitor?.method ?? "HEAD"} mix={[s.selectInput]}>
						{HTTP_METHODS.map((method) => (
							<option key={method} value={method}>
								{method}
							</option>
						))}
					</select>
				</Field>

				<Field label="Expected status code">
					<input
						type="number"
						name="expected_status"
						min={100}
						max={599}
						defaultValue={monitor?.expected_status ?? 200}
						mix={[s.input]}
					/>
				</Field>

				<Field label="Check interval (seconds)">
					<input
						type="number"
						name="interval_seconds"
						min={60}
						max={3600}
						defaultValue={monitor?.interval_seconds ?? 60}
						mix={[s.input]}
					/>
				</Field>

				<Field label="Timeout (seconds)">
					<input
						type="number"
						name="timeout_seconds"
						min={1}
						max={60}
						defaultValue={monitor?.timeout_seconds ?? 10}
						mix={[s.input]}
					/>
				</Field>

				<Field label="Degraded threshold (ms)">
					<input
						type="number"
						name="degraded_after_ms"
						min={1}
						max={60_000}
						defaultValue={monitor?.degraded_after_ms ?? 5000}
						mix={[s.input]}
					/>
				</Field>

				<Field label="Check region">
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
				</Field>
			</>
		);
	};
}
