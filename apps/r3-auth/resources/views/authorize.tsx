/**
 * The sign-in page shown when an authorization request needs a person to authenticate.
 * Renders the requesting client's identity, the credential form, and the provider
 * button, all posting to URLs the flow already knows.
 *
 * This is the functional skeleton of the page: the markup carries the whole flow, and
 * the two-column layout, palette and component library are layered over it when the
 * sign-in UI is built. Everything visual belongs in that later pass; everything a form
 * submits belongs here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import routes from "~/routes/web";

namespace AuthorizeView {
	export interface Setup {
		/** Name of the client the person is signing in to, shown so they can recognize it. */
		clientName: string;
		/** The client's own description of itself, when it registered one. */
		clientDescription: string | null;
		/** Heading above the form. */
		title: string;
		/** Sentence under the heading. */
		description: string;
		/** Labels for the credential form's fields and its submit button. */
		labels: {
			name: string;
			username: string;
			email: string;
			password: string;
			submit: string;
			github: string;
			separator: string;
		};
		/**
		 * Whether the registration fields are shown expanded. Registration and sign-in
		 * post the same form; `prompt=create` only decides which one the page leads with.
		 */
		showRegistration: boolean;
		/** Why the previous attempt was refused, when there was one. */
		error: string | null;
	}
}

/** Renders the credential and provider sign-in page for an authorization request. */
export default function AuthorizeView(handle: Handle<AuthorizeView.Setup>) {
	return () => {
		let { clientName, clientDescription, title, description, labels, showRegistration, error } =
			handle.props;

		return (
			<main>
				<section>
					<h2>{clientName}</h2>
					{clientDescription && <p>{clientDescription}</p>}
				</section>

				<section>
					<h1>{title}</h1>
					<p>{description}</p>
					{error && <p role="alert">{error}</p>}

					<form method="post" action={routes.authorize.action.href()}>
						<details open={showRegistration}>
							<summary>{labels.submit}</summary>

							<label>
								{labels.name}
								<input type="text" name="name" required />
							</label>

							<label>
								{labels.username}
								<input type="text" name="username" required />
							</label>
						</details>

						<label>
							{labels.email}
							<input type="email" name="email" required />
						</label>

						<label>
							{labels.password}
							<input type="password" name="password" required />
						</label>

						<button type="submit">{labels.submit}</button>
					</form>

					<p>{labels.separator}</p>

					<form method="post" action={routes.auth.provider.href({ provider: "github" })}>
						<button type="submit">{labels.github}</button>
					</form>
				</section>
			</main>
		);
	};
}
