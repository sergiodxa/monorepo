/**
 * Live example for a `Form` whose action keeps the input. A failed submission renders
 * the same page again with the submitted values and the parse `issues`, rather than
 * redirecting and making the person type everything twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Form, TextField } from "@sdxc/ui";

/** What the person submitted, which the failed render puts back in each field. */
const SUBMITTED = { name: "API", url: "api.acme.dev/health", interval: "5" };

/** What parsing {@link SUBMITTED} reported, in the shape `parseSafe` returns its issues. */
const ISSUES: ReadonlyArray<Form.Issue> = [
	{ message: "Use a full URL, starting with https://.", path: ["url"] },
	{ message: "Check no more often than every 30 seconds.", path: ["interval"] },
];

/** The source the page shows: the controller action and the page it re-renders. */
const CODE = `// The action: on failure, render the page again with what was sent.
async action(ctx) {
	let formData = await ctx.request.formData();
	let result = s.parseSafe(MonitorSchema, formData);
	if (!result.success) {
		let values = Object.fromEntries(formData) as MonitorValues;
		return ctx.render(<EditMonitor values={values} issues={result.issues} />, { status: 400 });
	}
	await ctx.db.monitors.update(result.value);
	return redirect(routes.monitors.show.href({ id: result.value.id }));
}

// The page: every field reads its value from \`values\` and its error from \`issues\`.
<Form method="post" issues={issues}>
	<TextField label="Name" name="name" defaultValue={values.name} required />
	<TextField label="URL" name="url" defaultValue={values.url} required />
	<TextField label="Check every (seconds)" name="interval" type="number" defaultValue={values.interval} />
	<Button type="submit">Save monitor</Button>
</Form>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Keeping the input after a failed submit",
	code: CODE,
	render: () => (
		<Form method="post" action="/examples/monitors/api" issues={ISSUES}>
			<TextField label="Name" name="name" defaultValue={SUBMITTED.name} required />
			<TextField label="URL" name="url" defaultValue={SUBMITTED.url} required />
			<TextField
				label="Check every (seconds)"
				name="interval"
				type="number"
				defaultValue={SUBMITTED.interval}
			/>
			<Button type="submit">Save monitor</Button>
		</Form>
	),
};
