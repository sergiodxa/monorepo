/**
 * New API key form. Exposes every scope the schema supports (the OLD APP's create
 * form only exposed 7 of the 20 defined scopes; this fixes that gap rather than
 * porting the stale subset).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectTeam } from "~/database/schema";

import { apiKeyScopes } from "~/database/schema";
import Field from "~/resources/components/field";
import routes from "~/routes/web";

namespace NewApiKeyView {
	export interface Props {
		team: SelectTeam;
	}
}

const neutral = {
	50: "oklch(0.98 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

export default function NewApiKeyView(handle: Handle<NewApiKeyView.Props>) {
	return () => {
		let { team } = handle.props;

		return (
			<div>
				<h1>New API key</h1>
				<form method="post" action={routes.teamAdminActions.createApiKey.href({ team: team.slug })}>
					<Field label="Name">
						<input
							type="text"
							name="name"
							required
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

					<fieldset
						mix={[
							css({
								display: "flex",
								flexDirection: "column",
								gap: 4,
								marginBottom: 20,
								fontSize: "0.875rem",
								fontWeight: 500,
							}),
						]}
					>
						<legend>Scopes</legend>
						{apiKeyScopes.map((scope) => (
							<label
								key={scope}
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
								<input type="checkbox" name="scopes" value={scope} />
								<span>{scope}</span>
							</label>
						))}
					</fieldset>

					<Field label="Expires (optional)">
						<input
							type="date"
							name="expires_at"
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
						Create API key
					</button>
				</form>
			</div>
		);
	};
}
