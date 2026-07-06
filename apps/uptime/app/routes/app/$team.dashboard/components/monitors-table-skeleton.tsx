/**
 * Loading placeholder for the dashboard monitors table. It renders a `Table`
 * with skeleton header columns and five skeleton rows shaped like real monitor
 * rows (name, latency chart, status, response time, actions), preserving layout
 * and preventing content shift while monitor data is still loading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Skeleton, Table } from "@pkg/ui";

export function MonitorsTableSkeleton() {
	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-label="Loading monitors">
				<Table.Header>
					<Table.Column isRowHeader>
						<Skeleton className="h-4 w-16" />
					</Table.Column>
					<Table.Column>
						<Skeleton className="h-4 w-20 max-lg:hidden" />
					</Table.Column>
					<Table.Column>
						<Skeleton className="h-4 w-12" />
					</Table.Column>
					<Table.Column align="right">
						<Skeleton className="ml-auto h-4 w-24 max-sm:hidden" />
					</Table.Column>
					<Table.Column align="right">
						<span className="sr-only">Actions</span>
					</Table.Column>
				</Table.Header>

				<Table.Body items={[{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }]}>
					{(item) => (
						<Table.Row key={item.id}>
							<Table.Cell>
								<Skeleton className="h-4 w-32" />
							</Table.Cell>
							<Table.Cell className="w-50 max-lg:hidden">
								<Skeleton className="h-6 w-50" />
							</Table.Cell>
							<Table.Cell className="w-44">
								<Skeleton className="h-6 w-16 rounded-full" />
							</Table.Cell>
							<Table.Cell className="w-36 text-right max-sm:hidden">
								<Skeleton className="ml-auto h-4 w-16" />
							</Table.Cell>
							<Table.Cell className="w-17 text-right">
								<Skeleton className="ml-auto h-10 w-10 rounded-lg" />
							</Table.Cell>
						</Table.Row>
					)}
				</Table.Body>
			</Table>
		</div>
	);
}
