/**
 * StatCard component for the auth app. Renders a compact metric card showing a
 * label, a large value, a supporting description, and an optional icon, used to
 * display dashboard statistics such as client, user, and session counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ReactNode } from "react";

import { Card } from "@pkg/ui";

export function StatCard(props: {
	icon?: ReactNode;
	label: ReactNode;
	value: ReactNode;
	description: ReactNode;
}) {
	return (
		<Card>
			<Card.Header className="flex-row items-center justify-between pb-2">
				<Card.Title className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
					{props.label}
				</Card.Title>
				{props.icon && <div className="text-neutral-400 dark:text-neutral-500">{props.icon}</div>}
			</Card.Header>
			<Card.Content className="pt-0">
				<div className="text-2xl font-bold">{props.value}</div>
				<p className="text-xs text-neutral-500 dark:text-neutral-400">{props.description}</p>
			</Card.Content>
		</Card>
	);
}
