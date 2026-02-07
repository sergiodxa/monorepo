import { Card } from "@pkg/ui";

export function StatCard(props: {
	label: React.ReactNode;
	value: React.ReactNode;
	description: React.ReactNode;
}) {
	return (
		<Card>
			<Card.Header className="pb-2">
				<Card.Title className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
					{props.label}
				</Card.Title>
			</Card.Header>
			<Card.Content className="pt-0">
				<div className="text-2xl font-bold">{props.value}</div>
				<p className="text-xs text-neutral-500 dark:text-neutral-400">{props.description}</p>
			</Card.Content>
		</Card>
	);
}
