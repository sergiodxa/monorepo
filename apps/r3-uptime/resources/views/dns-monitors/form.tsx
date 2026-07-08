/**
 * Shared DNS monitor form fields, used by both the new-monitor and edit-monitor views.
 * It exists so the two pages don't duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectDnsMonitor } from "~/database/schema";

import * as s from "~/resources/styles";

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

export default function DnsMonitorFormFields(handle: Handle<DnsMonitorFormFields.Props>) {
	return () => {
		let monitor = handle.props.monitor;

		return (
			<>
				<label mix={[s.field]}>
					<span>Name</span>
					<input type="text" name="name" required defaultValue={monitor?.name} mix={[s.input]} />
				</label>

				<label mix={[s.field]}>
					<span>Domain</span>
					<input
						type="text"
						name="domain"
						required
						defaultValue={monitor?.domain}
						placeholder="example.com"
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Record type</span>
					<select
						name="record_type"
						defaultValue={monitor?.record_type ?? "A"}
						mix={[s.selectInput]}
					>
						{RECORD_TYPES.map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</select>
				</label>

				<label mix={[s.field]}>
					<span>Expected value (optional)</span>
					<input
						type="text"
						name="expected_value"
						defaultValue={monitor?.expected_value ?? ""}
						placeholder="Leave blank to alert on any change"
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Check interval</span>
					<select
						name="interval_seconds"
						defaultValue={monitor?.interval_seconds ?? 3600}
						mix={[s.selectInput]}
					>
						{INTERVAL_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>

				<label mix={[s.checkboxField]}>
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
