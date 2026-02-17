import { Alert, Button, Card, Form } from "@pkg/ui";
import { useNavigation } from "react-router";

import type { Route } from "../+types/route";

import { INTENT } from "../types";

interface DumpDatabaseProps {
	actionData: Route.ComponentProps["actionData"];
}

export function DumpDatabase({ actionData }: DumpDatabaseProps) {
	let navigation = useNavigation();

	let errors =
		actionData?.intent === INTENT.dump && "errors" in actionData ? actionData.errors : undefined;

	let success = actionData?.intent === INTENT.dump && "success" in actionData;

	let isPending = navigation.formData?.get("intent") === INTENT.dump;

	return (
		<Card>
			<Card.Header>
				<Card.Title>Database Backup</Card.Title>
			</Card.Header>
			<Card.Content>
				<Form method="post" className="flex flex-col gap-4">
					{errors && <Alert color="danger">{errors?.intent}</Alert>}
					{success && <Alert color="success">Database dumped successfully</Alert>}

					<Button type="submit" name="intent" value={INTENT.dump} isPending={isPending}>
						Dump copy of the database
					</Button>

					{isPending && <p className="text-sm text-neutral-500">Dumping database...</p>}
				</Form>
			</Card.Content>
		</Card>
	);
}
