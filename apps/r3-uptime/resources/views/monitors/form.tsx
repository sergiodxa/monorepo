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

import type { CSSMixinDescriptor, ElementProps, Handle, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";

const neutral = {
	50: "oklch(0.98 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	700: "oklch(0.42 0.008 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

/** {@link mixForSelect} re-types a `css()` mixin for `<select>`. */
function mixForSelect(
	mixin: CSSMixinDescriptor,
): MixinDescriptor<HTMLSelectElement, CSSMixinDescriptor["args"], ElementProps> {
	return mixin as unknown as MixinDescriptor<
		HTMLSelectElement,
		CSSMixinDescriptor["args"],
		ElementProps
	>;
}

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
					<input
						type="text"
						name="name"
						required
						defaultValue={monitor?.name}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="URL">
					<input
						type="url"
						name="url"
						required
						defaultValue={monitor?.url}
						placeholder="https://example.com"
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Method">
					<select
						name="method"
						defaultValue={monitor?.method ?? "HEAD"}
						mix={[
							mixForSelect(
								css({
									padding: "8px 12px",
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
							),
						]}
					>
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
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Check interval (seconds)">
					<input
						type="number"
						name="interval_seconds"
						min={60}
						max={3600}
						defaultValue={monitor?.interval_seconds ?? 60}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Timeout (seconds)">
					<input
						type="number"
						name="timeout_seconds"
						min={1}
						max={60}
						defaultValue={monitor?.timeout_seconds ?? 10}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Degraded threshold (ms)">
					<input
						type="number"
						name="degraded_after_ms"
						min={1}
						max={60_000}
						defaultValue={monitor?.degraded_after_ms ?? 5000}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Check region">
					<select
						name="location_hint"
						defaultValue={monitor?.location_hint ?? "wnam"}
						mix={[
							mixForSelect(
								css({
									padding: "8px 12px",
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
							),
						]}
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
