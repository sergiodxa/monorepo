/**
 * Pulse's deployments and status pages: the week's releases as a dense table with ids,
 * durations and outcomes, and the status pages screen in its first-run state, which says what
 * the list will hold and offers the one action that starts it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { GlobeIcon, PlusIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { minIs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { Button, HeadingScope } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Table } from "@sdxc/ui/app/table";

import { actionHref, DEPLOYS, href, LOCALE, NOW } from "./data";
import { COPY } from "./labels";

/** The deployments screen's content, under the frame. */
export function Deployments() {
	return () => (
		<div mix={[vstack({ gap: 4, align: "stretch" }), minIs(0)]}>
			<PageHeader title={COPY.deployments.title} description={COPY.deployments.description} />
			<Table.Container>
				<Table aria-label={COPY.deployments.table} density="compact" pinFirstColumn>
					<Table.Header>
						<Table.Row>
							<Table.Column>{COPY.deployments.columns.id}</Table.Column>
							<Table.Column>{COPY.deployments.columns.service}</Table.Column>
							<Table.Column>{COPY.deployments.columns.version}</Table.Column>
							<Table.Column>{COPY.deployments.columns.author}</Table.Column>
							<Table.Column numeric>{COPY.deployments.columns.duration}</Table.Column>
							<Table.Column sortDirection="descending">{COPY.deployments.columns.at}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{DEPLOYS.map((deploy) => (
							<Table.Row key={deploy.id}>
								<Table.IdCell value={deploy.id} tail={6} />
								<Table.Cell>
									<Table.RowLink
										data-rmx-prefetch="intent"
										href={href(`services/${deploy.service}`)}
										mix={[font("mono")]}
									>
										{deploy.service}
									</Table.RowLink>
								</Table.Cell>
								<Table.StatusCell color={deploy.outcome === "live" ? "brand" : "warning"}>
									<span mix={[font("mono")]}>{deploy.version}</span>{" "}
									{deploy.outcome === "live" ? COPY.deployments.live : COPY.deployments.rolledBack}
								</Table.StatusCell>
								<Table.Cell>{deploy.author}</Table.Cell>
								<Table.NumberCell
									value={deploy.durationS}
									locale={LOCALE}
									format={{ style: "unit", unit: "second" }}
									mix={[font("mono")]}
								/>
								<Table.DateCell date={deploy.at} now={NOW} locale={LOCALE} />
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		</div>
	);
}

/** The status pages screen, still empty: a first-run welcome with its one action. */
export function StatusPages(_handle: Handle) {
	return () => (
		<div mix={[vstack({ gap: 4, align: "stretch" }), minIs(0)]}>
			<PageHeader title={COPY.statusPages.title} description={COPY.statusPages.description} />
			<HeadingScope level={2}>
				<Empty kind="first-run" icon={<GlobeIcon />}>
					<Empty.Title>{COPY.statusPages.firstRun}</Empty.Title>
					<Empty.Description>{COPY.statusPages.firstRunHint}</Empty.Description>
					<Empty.Action>
						<form method="post" action={actionHref("status-pages")}>
							<Button type="submit" size="sm">
								<PlusIcon size={14} />
								{COPY.statusPages.create}
							</Button>
						</form>
					</Empty.Action>
				</Empty>
			</HeadingScope>
		</div>
	);
}
