/**
 * API keys list page. Shows the just-created plaintext key exactly once (from a
 * one-time session flash — see the controller) with a copy button, then every
 * existing key's masked prefix, scopes, and usage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectApiKey, SelectTeam } from "~/database/schema";

import Badge from "~/resources/components/badge";
import CopyButton from "~/resources/components/copy-button";
import EmptyState from "~/resources/components/empty-state";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace ApiKeysView {
	export interface Props {
		team: SelectTeam;
		apiKeys: SelectApiKey[];
		newApiKey?: { name: string; key: string };
	}
}

export default function ApiKeysView(handle: Handle<ApiKeysView.Props>) {
	return () => {
		let { team, apiKeys, newApiKey } = handle.props;

		return (
			<div>
				<div mix={[s.row]}>
					<h1>API keys</h1>
					<a href={routes.app.team.apiKeyNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
						New API key
					</a>
				</div>

				{newApiKey && (
					<div mix={[s.emptyState]}>
						<p>
							<strong>{newApiKey.name}</strong> created. Copy this key now — you won't be able to
							see it again.
						</p>
						<div mix={[s.row]}>
							<code>{newApiKey.key}</code>
							<CopyButton value={newApiKey.key} label="Copy key" />
						</div>
					</div>
				)}

				{apiKeys.length === 0 ? (
					<EmptyState message="No API keys yet." />
				) : (
					<table mix={[s.table]}>
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
												<button type="submit" mix={[s.buttonDanger]}>
													Delete
												</button>
											</form>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>
		);
	};
}
