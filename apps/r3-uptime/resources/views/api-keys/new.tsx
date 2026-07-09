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
					<label mix={[s.field]}>
						<span>Name</span>
						<input type="text" name="name" required mix={[s.input]} />
					</label>

					<fieldset mix={[s.field]}>
						<legend>Scopes</legend>
						{apiKeyScopes.map((scope) => (
							<label key={scope} mix={[s.checkboxField]}>
								<input type="checkbox" name="scopes" value={scope} />
								<span>{scope}</span>
							</label>
						))}
					</fieldset>

					<label mix={[s.field]}>
						<span>Expires (optional)</span>
						<input type="date" name="expires_at" mix={[s.input]} />
					</label>

					<button type="submit" mix={[s.buttonPrimary]}>
						Create API key
					</button>
				</form>
			</div>
		);
	};
}
