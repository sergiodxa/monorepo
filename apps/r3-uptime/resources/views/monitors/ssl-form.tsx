/**
 * SSL certificate monitoring settings form, shown on the monitor edit page. Posts to
 * the `update-ssl` action. Expiry date and issuer are entered manually since Workers
 * cannot read TLS certificate details from `fetch()` (see `docs/ssl-monitoring.md`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace SslForm {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
	}
}

export default function SslForm(handle: Handle<SslForm.Props>) {
	return () => {
		let { team, monitor } = handle.props;
		let expiresAtValue = monitor.ssl_expires_at
			? new Date(monitor.ssl_expires_at).toISOString().slice(0, 10)
			: "";

		return (
			<div>
				<h2>SSL certificate monitoring</h2>
				<form method="post" action={routes.actions.updateSsl.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />

					<label mix={[s.checkboxField]}>
						<input
							type="checkbox"
							name="ssl_monitoring_enabled"
							value="true"
							defaultChecked={monitor.ssl_monitoring_enabled}
						/>
						<span>Enable SSL expiry monitoring</span>
					</label>

					<label mix={[s.field]}>
						<span>Expiry date</span>
						<input
							type="date"
							name="ssl_expires_at"
							defaultValue={expiresAtValue}
							mix={[s.input]}
						/>
					</label>

					<label mix={[s.field]}>
						<span>Issuer</span>
						<input
							type="text"
							name="ssl_issuer"
							defaultValue={monitor.ssl_issuer ?? ""}
							mix={[s.input]}
						/>
					</label>

					<label mix={[s.field]}>
						<span>Warning threshold (days)</span>
						<input
							type="number"
							name="ssl_expiry_warning_days"
							min={1}
							max={365}
							defaultValue={monitor.ssl_expiry_warning_days}
							mix={[s.input]}
						/>
					</label>

					<button type="submit" mix={[s.buttonPrimary]}>
						Save SSL settings
					</button>
				</form>
			</div>
		);
	};
}
