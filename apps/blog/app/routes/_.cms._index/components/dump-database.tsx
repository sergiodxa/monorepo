/**
 * Dashboard card component for triggering a database backup. It posts the dump intent,
 * shows a pending state while the export runs, and surfaces success or error alerts
 * based on the action result. Exists to give admins a one-click way to snapshot the
 * database from the dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
