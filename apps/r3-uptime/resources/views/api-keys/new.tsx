/**
 * New API key form. Exposes every scope the schema supports (the OLD APP's create
 * form only exposed 7 of the 20 defined scopes; this fixes that gap rather than
 * porting the stale subset).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectTeam } from "~/database/schema";

import { apiKeyScopes } from "~/database/schema";
import Field from "~/resources/components/field";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace NewApiKeyView {
	export interface Props {
		team: SelectTeam;
	}
}

export default function NewApiKeyView(handle: Handle<NewApiKeyView.Props>) {
	return () => {
		let { team } = handle.props;

		return (
			<div>
				<h1>New API key</h1>
				<form method="post" action={routes.teamAdminActions.createApiKey.href({ team: team.slug })}>
					<Field label="Name">
						<input type="text" name="name" required mix={[s.input]} />
					</Field>

					<fieldset mix={[s.field]}>
						<legend>Scopes</legend>
						{apiKeyScopes.map((scope) => (
							<label key={scope} mix={[s.checkboxField]}>
								<input type="checkbox" name="scopes" value={scope} />
								<span>{scope}</span>
							</label>
						))}
					</fieldset>

					<Field label="Expires (optional)">
						<input type="date" name="expires_at" mix={[s.input]} />
					</Field>

					<button type="submit" mix={[s.buttonPrimary]}>
						Create API key
					</button>
				</form>
			</div>
		);
	};
}
