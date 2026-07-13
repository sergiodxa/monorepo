/**
 * SSL certificate monitoring settings form, shown on the monitor edit page. Posts to
 * the `update-ssl` action. Expiry date and issuer are entered manually since Workers
 * cannot read TLS certificate details from `fetch()` (see `docs/ssl-monitoring.md`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import { neutral } from "~/resources/theme";
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
				<form
					method="post"
					action={routes.actions.monitor.http.updateSsl.href({ team: team.slug })}
				>
					<input type="hidden" name="monitor_id" value={monitor.id} />

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
							name="ssl_monitoring_enabled"
							value="true"
							defaultChecked={monitor.ssl_monitoring_enabled}
						/>
						<span>Enable SSL expiry monitoring</span>
					</label>

					<Field label="Expiry date">
						<input
							type="date"
							name="ssl_expires_at"
							defaultValue={expiresAtValue}
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

					<Field label="Issuer">
						<input
							type="text"
							name="ssl_issuer"
							defaultValue={monitor.ssl_issuer ?? ""}
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

					<Field label="Warning threshold (days)">
						<input
							type="number"
							name="ssl_expiry_warning_days"
							min={1}
							max={365}
							defaultValue={monitor.ssl_expiry_warning_days}
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

					<button
						type="submit"
						mix={[
							css({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "8px 16px",
								borderRadius: 6,
								border: "1px solid transparent",
								background: neutral[900],
								color: "#ffffff",
								fontFamily: "inherit",
								fontSize: "0.875rem",
								fontWeight: 500,
								cursor: "pointer",
								textDecoration: "none",
								"&:hover": { background: neutral[800] },
							}),
						]}
					>
						Save SSL settings
					</button>
				</form>
			</div>
		);
	};
}
