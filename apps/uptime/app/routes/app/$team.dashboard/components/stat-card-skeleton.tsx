/**
 * Loading placeholder for a dashboard stat card. It renders the shared `Card`
 * shell with `Skeleton` blocks sized to match a real stat card's label, value,
 * and description, keeping the dashboard grid stable while the underlying metric
 * queries are still resolving.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Card, Skeleton } from "@pkg/ui";

export function StatCardSkeleton() {
	return (
		<Card>
			<Card.Header className="pb-2">
				<Skeleton className="h-3.5 w-24" />
			</Card.Header>

			<Card.Content className="flex flex-col gap-0.5 pt-0">
				<Skeleton className="h-7.25 w-20" />

				<Skeleton className="h-3.75 w-40" />
			</Card.Content>
		</Card>
	);
}

// card h 118px
// card.header h 46px
// card.content h 70px
