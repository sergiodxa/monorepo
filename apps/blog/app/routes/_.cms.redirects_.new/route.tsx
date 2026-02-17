import { succeeded } from "@pkg/result";
import { Button, Card, FieldError, Form, Input, Label, TextField } from "@pkg/ui";
import { validate } from "@pkg/validate";
import { href, redirect } from "react-router";
import { z } from "zod";

import { getBindings } from "~/middleware/bindings";

import type { Route } from "./+types/route";

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(
		request,
		z.object({
			from: z.string().min(1).startsWith("/"),
			to: z.string().min(1).startsWith("/"),
		}),
	);
	succeeded(result, "Invalid form data");

	let bindings = getBindings();

	// Use the "from" path (without leading slash) as the key
	let key = result.data.from.slice(1);

	await bindings.kv.redirects.put(
		key,
		JSON.stringify({ from: result.data.from, to: result.data.to }),
		{ metadata: { from: result.data.from, to: result.data.to } },
	);

	return redirect(href("/cms/redirects"));
}

export default function Component(_: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Card className="w-fit">
				<Card.Header>
					<Card.Title>Create Redirect</Card.Title>
				</Card.Header>
				<Card.Content>
					<Form method="post" className="min-w-xs">
						<TextField name="from" isRequired>
							<Label>From</Label>
							<Input placeholder="/old-path" />
							<FieldError />
						</TextField>

						<TextField name="to" isRequired>
							<Label>To</Label>
							<Input placeholder="/new-path" />
							<FieldError />
						</TextField>

						<Button type="submit" color="primary">
							Create
						</Button>
					</Form>
				</Card.Content>
			</Card>
		</div>
	);
}
