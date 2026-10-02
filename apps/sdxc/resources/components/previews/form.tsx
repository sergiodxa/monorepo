/**
 * Live preview island for `Form`. `issues` is the whole interface: hand it a `parseSafe`
 * result and every field beneath finds its own message by name, marks itself invalid, and
 * the first one takes focus. A page would set it from the action that parsed the POST;
 * here the island parses the same submission in the browser so the round trip can be seen
 * without one, and a control the wrapper does not cover — the terms checkbox — reads its
 * message out of `issues` itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";
import type { Issue } from "remix/data-schema";

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import {
	Alert,
	Button,
	Checkbox,
	FieldError,
	Form,
	Label,
	NumberField,
	Select,
	TextField,
} from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import { checkNewWorkspace, issueFor } from "~/app/services/preview-form-schemas";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const FORM_CODE = `let issues: ReadonlyArray<Issue> = [];
let created = false;

function submit(event: SubmitEvent) {
	event.preventDefault();
	let form = event.currentTarget as HTMLFormElement;
	issues = checkNewWorkspace(new FormData(form));
	created = issues.length === 0;
	void handle.update();
}

<Form
	method="post"
	issues={issues}
	// The native constraints below already block an empty submit with no script;
	// the schema is what catches the shapes an attribute cannot express.
	noValidate
	mix={[on<HTMLFormElement, "submit">("submit", submit)]}
>
	{created ? <Alert color="success">Workspace created.</Alert> : null}

	<TextField
		label="Workspace name"
		name="name"
		required
		description="Shown in the sidebar and on invitations."
	/>
	<TextField
		label="Address"
		name="slug"
		required
		description="Teammates reach the workspace at this.acme.dev."
	/>
	<TextField
		label="Billing owner"
		name="ownerEmail"
		type="email"
		required
		description="Invoices and renewal notices go here."
	/>

	<Label htmlFor="region">Data region</Label>
	<Select id="region" name="region">
		<Select.Option value="eu" selected>
			Europe — Frankfurt
		</Select.Option>
		<Select.Option value="us">United States — Iowa</Select.Option>
		<Select.Option value="ap">Asia Pacific — Sydney</Select.Option>
	</Select>

	<NumberField>
		<Label htmlFor="seats">Seats to reserve</Label>
		<NumberField.Group>
			<NumberField.DecrementButton aria-label="One fewer seat" />
			<NumberField.Input id="seats" name="seats" min={1} max={200} defaultValue={10} />
			<NumberField.IncrementButton aria-label="One more seat" />
		</NumberField.Group>
	</NumberField>

	<Checkbox
		name="terms"
		value="accepted"
		required
		aria-describedby="terms-error"
		aria-invalid={issueFor(issues, "terms") ? "true" : undefined}
	>
		I accept the data processing agreement
	</Checkbox>
	<FieldError id="terms-error" hidden={!issueFor(issues, "terms")}>
		{issueFor(issues, "terms")}
	</FieldError>

	<Button type="submit">Create workspace</Button>
</Form>`;

/** A workspace creation form, hydrated so a failed parse renders its own issues. */
export const FormPreview = clientEntry(
	"/resources/components/previews/form.tsx#FormPreview",
	function FormPreview(handle: Handle) {
		let issues: ReadonlyArray<Issue> = [];
		let created = false;

		/** Parses the submission the same way the POST handler would, and keeps its issues. */
		function submit(event: SubmitEvent) {
			event.preventDefault();
			let form = event.currentTarget as HTMLFormElement;
			issues = checkNewWorkspace(new FormData(form));
			created = issues.length === 0;
			void handle.update();
		}

		return () => {
			let termsIssue = issueFor(issues, "terms");

			return (
				<Form
					method="post"
					issues={issues}
					// The native constraints below already block an empty submit with no script;
					// the schema is what catches the shapes an attribute cannot express.
					noValidate
					mix={[is("26rem"), on<HTMLFormElement, "submit">("submit", submit)]}
				>
					{created ? <Alert color="success">Workspace created.</Alert> : null}

					<TextField
						label="Workspace name"
						name="name"
						required
						description="Shown in the sidebar and on invitations."
					/>
					<TextField
						label="Address"
						name="slug"
						required
						description="Teammates reach the workspace at this.acme.dev."
					/>
					<TextField
						label="Billing owner"
						name="ownerEmail"
						type="email"
						required
						description="Invoices and renewal notices go here."
					/>

					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<Label htmlFor="preview-form-region">Data region</Label>
						<Select id="preview-form-region" name="region">
							<Select.Option value="eu" selected>
								Europe — Frankfurt
							</Select.Option>
							<Select.Option value="us">United States — Iowa</Select.Option>
							<Select.Option value="ap">Asia Pacific — Sydney</Select.Option>
						</Select>
					</div>

					<NumberField>
						<Label htmlFor="preview-form-seats">Seats to reserve</Label>
						<NumberField.Group>
							<NumberField.DecrementButton aria-label="One fewer seat" />
							<NumberField.Input
								id="preview-form-seats"
								name="seats"
								min={1}
								max={200}
								defaultValue={10}
							/>
							<NumberField.IncrementButton aria-label="One more seat" />
						</NumberField.Group>
					</NumberField>

					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<Checkbox
							name="terms"
							value="accepted"
							required
							aria-describedby="preview-form-terms-error"
							aria-invalid={termsIssue ? "true" : undefined}
						>
							I accept the data processing agreement
						</Checkbox>
						<FieldError id="preview-form-terms-error" hidden={!termsIssue}>
							{termsIssue}
						</FieldError>
					</div>

					<Button type="submit">Create workspace</Button>
				</Form>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: FORM_CODE, render: () => <FormPreview /> };
