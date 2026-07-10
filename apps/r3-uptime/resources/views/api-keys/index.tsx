/**
 * API keys list page. Shows the just-created plaintext key exactly once (from a
 * one-time session flash — see the controller) with a copy button, then every
 * existing key's masked prefix, scopes, and usage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectApiKey, SelectTeam } from "~/database/schema";

import Badge from "~/resources/components/badge";
import CopyButton from "~/resources/components/copy-button";
import EmptyState from "~/resources/components/empty-state";
import routes from "~/routes/web";

namespace ApiKeysView {
	export interface Props {
		team: SelectTeam;
		apiKeys: SelectApiKey[];
		newApiKey?: { name: string; key: string };
	}
}

const neutral = {
	200: "oklch(0.91 0.008 145)",
	300: "oklch(0.83 0.01 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

const danger = {
	600: "oklch(0.58 0.18 25)",
	700: "oklch(0.48 0.16 25)",
} as const;

export default function ApiKeysView(handle: Handle<ApiKeysView.Props>) {
	return () => {
		let { team, apiKeys, newApiKey } = handle.props;

		return (
			<div>
				<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
					<h1 mix={[css({ margin: "0 0 24px" })]}>API keys</h1>
					<a
						href={routes.app.team.apiKeyNew.href({ team: team.slug })}
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
						New API key
					</a>
				</div>

				{newApiKey && (
					<div
						mix={[
							css({
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								textAlign: "center",
								gap: 12,
								padding: "64px 32px",
								border: `1px dashed ${neutral[300]}`,
								borderRadius: 12,
								"@media (prefers-color-scheme: dark)": { borderColor: neutral[700] },
							}),
						]}
					>
						<p>
							<strong>{newApiKey.name}</strong> created. Copy this key now — you won't be able to
							see it again.
						</p>
						<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
							<code>{newApiKey.key}</code>
							<CopyButton value={newApiKey.key} label="Copy key" />
						</div>
					</div>
				)}

				{apiKeys.length === 0 ? (
					<EmptyState message="No API keys yet." />
				) : (
					<div mix={[css({ overflowX: "auto" })]}>
						<table
							mix={[
								css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.875rem",
									"& th, & td": {
										textAlign: "left",
										padding: "12px 16px",
										borderBottom: `1px solid ${neutral[200]}`,
									},
									"@media (prefers-color-scheme: dark)": {
										"& th, & td": { borderColor: neutral[800] },
									},
								}),
							]}
						>
							<thead>
								<tr>
									<th>Name</th>
									<th>Key</th>
									<th>Scopes</th>
									<th>Last used</th>
									<th>Expires</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{apiKeys.map((apiKey) => {
									let isExpired = apiKey.expires_at !== null && apiKey.expires_at < Date.now();

									return (
										<tr key={apiKey.id}>
											<td>{apiKey.name}</td>
											<td>
												<code>{apiKey.key_prefix}...</code>
											</td>
											<td>
												{apiKey.scopes.map((scope) => (
													<Badge key={scope} tone="neutral">
														{scope}
													</Badge>
												))}
											</td>
											<td>
												{apiKey.last_used_at
													? new Date(apiKey.last_used_at).toLocaleString()
													: "never"}
											</td>
											<td>
												{apiKey.expires_at ? (
													<Badge tone={isExpired ? "down" : "neutral"}>
														{new Date(apiKey.expires_at).toLocaleDateString()}
													</Badge>
												) : (
													"never"
												)}
											</td>
											<td>
												<form
													method="post"
													action={routes.teamAdminActions.deleteApiKey.href({ team: team.slug })}
												>
													<input type="hidden" name="_method" value="DELETE" />
													<input type="hidden" name="api_key_id" value={apiKey.id} />
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
																background: danger[600],
																color: "#ffffff",
																fontFamily: "inherit",
																fontSize: "0.875rem",
																fontWeight: 500,
																cursor: "pointer",
																textDecoration: "none",
																"&:hover": { background: danger[700] },
															}),
														]}
													>
														Delete
													</button>
												</form>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		);
	};
}
