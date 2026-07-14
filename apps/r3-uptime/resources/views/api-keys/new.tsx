/**
 * New API key form. Exposes every scope the schema supports (all 20 defined scopes).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectTeam } from "~/database/schema";

import { apiKeyScopes } from "~/database/schema";
import Button from "~/resources/components/button";
import Field from "~/resources/components/field";
import { neutral } from "~/resources/theme";
import routes from "~/routes/web";

namespace NewApiKeyView {
	export interface Props {
		team: SelectTeam;
	}
}

/** Renders the new API key form, listing every value of `apiKeyScopes` as a scope checkbox. */
export default function NewApiKeyView(handle: Handle<NewApiKeyView.Props>) {
	return () => {
		let { team } = handle.props;

		return (
			<div>
				<form
					method="post"
					action={routes.teamAdminActions.apiKey.create.href({ team: team.slug })}
				>
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

					<Button type="submit">Create API key</Button>
				</form>
			</div>
		);
	};
}
