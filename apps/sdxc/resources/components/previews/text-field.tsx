/**
 * Live preview island for `TextField`. The wrapper computes every id and
 * `aria-describedby` link between its caption, control, description and error itself,
 * so the example is a form step carrying all four: a described field, a field showing
 * the message a submission came back with, and the submit that produced it. An app
 * hands `errorMessage` whatever its `parseSafe` result reported, and pairs
 * `validate(schema)` with the control through `parts` to check that same schema as
 * the field is typed into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, Card, TextField } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TEXT_FIELD_CODE = `<form
	method="post"
	action="/workspaces"
	mix={[on<HTMLFormElement, "submit">("submit", (event) => event.preventDefault())]}
>
	<Card>
		<Card.Header>
			<Card.Title>Create a workspace</Card.Title>
			<Card.Description>You can rename it later; the address stays.</Card.Description>
		</Card.Header>
		<Card.Content mix={[vstack({ gap: 4, align: "stretch" })]}>
			<TextField
				label="Workspace name"
				name="name"
				required
				autoComplete="organization"
				defaultValue="Acme Design"
				description="Shown to everyone you invite."
			/>

			<TextField
				label="Billing email"
				type="email"
				name="billingEmail"
				required
				defaultValue="billing@acme"
				errorMessage="Enter an address we can invoice."
			/>
		</Card.Content>
		<Card.Footer mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
			<Button type="submit">Create workspace</Button>
		</Card.Footer>
	</Card>
</form>`;

/** A workspace form step showing all four field slots, hydrated with the page. */
export const TextFieldPreview = clientEntry(
	"/resources/components/previews/text-field.tsx#TextFieldPreview",
	function TextFieldPreview() {
		return () => (
			<form
				method="post"
				action="/workspaces"
				mix={[
					is("26rem"),
					// A docs page has nowhere to post to, so the submission stops here instead
					// of navigating away from the example.
					on<HTMLFormElement, "submit">("submit", (event) => event.preventDefault()),
				]}
			>
				<Card>
					<Card.Header>
						<Card.Title>Create a workspace</Card.Title>
						<Card.Description>You can rename it later; the address stays.</Card.Description>
					</Card.Header>
					<Card.Content mix={[vstack({ gap: 4, align: "stretch" })]}>
						<TextField
							label="Workspace name"
							name="name"
							required
							autoComplete="organization"
							defaultValue="Acme Design"
							description="Shown to everyone you invite."
						/>

						<TextField
							label="Billing email"
							type="email"
							name="billingEmail"
							required
							defaultValue="billing@acme"
							errorMessage="Enter an address we can invoice."
						/>
					</Card.Content>
					<Card.Footer mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
						<Button type="submit">Create workspace</Button>
					</Card.Footer>
				</Card>
			</form>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TEXT_FIELD_CODE, render: () => <TextFieldPreview /> };
