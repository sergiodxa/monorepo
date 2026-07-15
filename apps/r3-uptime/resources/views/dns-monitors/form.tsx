/**
 * Shared DNS monitor form fields, used by both the new-monitor and edit-monitor views.
 * It exists so the two pages don't duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectDnsMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import { mixForSelect } from "~/resources/mix-for-select";
import { neutral } from "~/resources/theme";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;
const INTERVAL_OPTIONS = [
	{ value: 300, label: "5 minutes" },
	{ value: 900, label: "15 minutes" },
	{ value: 1800, label: "30 minutes" },
	{ value: 3600, label: "1 hour" },
	{ value: 21_600, label: "6 hours" },
	{ value: 43_200, label: "12 hours" },
	{ value: 86_400, label: "24 hours" },
] as const;

namespace DnsMonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectDnsMonitor;
	}
}

/** Renders the domain/record-type/expected-value/interval fields, pre-filled from `monitor` when editing. Leaving "expected value" blank alerts on any change instead of a mismatch. */
export default function DnsMonitorFormFields(handle: Handle<DnsMonitorFormFields.Props>) {
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

				<Field label="Domain">
					<input
						type="text"
						name="domain"
						required
						defaultValue={monitor?.domain}
						placeholder="example.com"
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

				<Field label="Record type">
					<select
						name="record_type"
						defaultValue={monitor?.record_type ?? "A"}
						mix={[
							mixForSelect(
								css({
									padding: "8px 12px",
									// Matches the text inputs' rendered height: a native <select> is
									// intrinsically taller than a same-padding <input> unless pinned
									// to an explicit height.
									height: 34,
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
						{RECORD_TYPES.map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</select>
				</Field>

				<Field label="Expected value (optional)">
					<input
						type="text"
						name="expected_value"
						defaultValue={monitor?.expected_value ?? ""}
						placeholder="Leave blank to alert on any change"
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

				<Field label="Check interval">
					<select
						name="interval_seconds"
						defaultValue={monitor?.interval_seconds ?? 3600}
						mix={[
							mixForSelect(
								css({
									padding: "8px 12px",
									height: 34,
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
						{INTERVAL_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</Field>

				<label
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 16,
							fontSize: "0.875rem",
						}),
					]}
				>
					<input
						type="checkbox"
						name="is_enabled"
						value="true"
						defaultChecked={monitor?.is_enabled ?? true}
					/>
					<span>Enabled</span>
				</label>
			</>
		);
	};
}
