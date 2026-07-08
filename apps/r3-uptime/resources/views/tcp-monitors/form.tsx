/**
 * Shared TCP monitor form fields, used by both the new-monitor and edit-monitor views.
 * It exists so the two pages don't duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectTcpMonitor } from "~/database/schema";

import * as s from "~/resources/styles";

namespace TcpMonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectTcpMonitor;
	}
}

export default function TcpMonitorFormFields(handle: Handle<TcpMonitorFormFields.Props>) {
	return () => {
		let monitor = handle.props.monitor;

		return (
			<>
				<label mix={[s.field]}>
					<span>Name</span>
					<input type="text" name="name" required defaultValue={monitor?.name} mix={[s.input]} />
				</label>

				<label mix={[s.field]}>
					<span>Host</span>
					<input
						type="text"
						name="host"
						required
						defaultValue={monitor?.host}
						placeholder="db.example.com"
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Port</span>
					<input
						type="number"
						name="port"
						required
						min={1}
						max={65_535}
						defaultValue={monitor?.port}
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Timeout (ms)</span>
					<input
						type="number"
						name="timeout_ms"
						min={100}
						max={60_000}
						defaultValue={monitor?.timeout_ms ?? 5000}
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Check interval (seconds)</span>
					<input
						type="number"
						name="interval_seconds"
						min={10}
						max={86_400}
						defaultValue={monitor?.interval_seconds ?? 60}
						mix={[s.input]}
					/>
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
