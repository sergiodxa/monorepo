/**
 * The stats page's section on what readers and agents asked for: the top searches, the ones
 * that found nothing, and the MCP tools called and the packages they were called about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";
import { StatStrip, Table } from "@sdxc/ui";

import type { QueryCount, SearchSurface, SiteEventsSnapshot } from "~/app/services/site-events";

import { SEARCH_SURFACES } from "~/app/services/site-events";

/** How counts read in the section. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** How each search surface is named to a reader of the page. */
const SURFACE_LABELS: Record<SearchSurface, string> = {
	page: "Search page",
	dialog: "Dialog",
	search_docs: "MCP search_docs",
	search_packages: "MCP search_packages",
};

namespace SiteEventsSection {
	export interface Props {
		/** The stored snapshot, or `null` while nothing has been read. */
		events: SiteEventsSnapshot | null;
	}
}

/**
 * Renders the section: a headline strip, the top searches, the ones that found nothing, and the
 * MCP calls. The dialog searches on every keystroke, so its searches are counted after the
 * keystrokes are collapsed into the query the reader meant.
 */
export default function SiteEventsSection(handle: Handle<SiteEventsSection.Props>) {
	return () => {
		let { events } = handle.props;

		return (
			<section mix={vstack({ gap: 4, align: "stretch" })}>
				<h2 mix={[text("lg"), weight("semibold"), fg("neutral.emphasis")]}>
					What readers and agents ask for
				</h2>
				{events === null ? (
					<p mix={[text("sm"), fg("neutral.muted")]}>
						No searches or MCP calls recorded in the last 30 days.
					</p>
				) : (
					<Recorded events={events} />
				)}
			</section>
		);
	};
}

namespace Recorded {
	export interface Props {
		events: SiteEventsSnapshot;
	}
}

/** Renders the strip and the tables for a window with something recorded; MCP joins once called. */
function Recorded(handle: Handle<Recorded.Props>) {
	return () => {
		let { events } = handle.props;
		let searches = SEARCH_SURFACES.reduce((sum, surface) => sum + events.searches[surface], 0);

		return (
			<div mix={vstack({ gap: 4, align: "stretch" })}>
				<StatStrip>
					<StatStrip.Item label="Searches, last 30 days">
						{NUMBER_FORMAT.format(searches)}
					</StatStrip.Item>
					<StatStrip.Item label="Found nothing">
						{NUMBER_FORMAT.format(events.missCount)}
					</StatStrip.Item>
					{events.toolCallCount > 0 ? (
						<StatStrip.Item label="MCP calls, last 30 days">
							{NUMBER_FORMAT.format(events.toolCallCount)}
						</StatStrip.Item>
					) : null}
				</StatStrip>

				{events.hits.length > 0 ? (
					<QueryTable
						label="Top searches, last 30 days"
						heading="Searched for"
						rows={events.hits}
					/>
				) : null}

				{events.misses.length === 0 ? (
					<p mix={[text("sm"), fg("neutral.muted")]}>Every search found something.</p>
				) : (
					<QueryTable
						label="Searches that found nothing, last 30 days"
						heading="Found nothing"
						rows={events.misses}
					/>
				)}

				{events.tools.length > 0 ? (
					<CountTable label="MCP calls by tool, last 30 days" heading="Tool" rows={events.tools} />
				) : null}

				{events.packages.length > 0 ? (
					<CountTable
						label="Packages asked for through MCP, last 30 days"
						heading="Package asked for"
						rows={events.packages}
					/>
				) : null}
			</div>
		);
	};
}

namespace QueryTable {
	export interface Props {
		/** The table's accessible name. */
		label: string;
		heading: string;
		rows: QueryCount[];
	}
}

/** Renders queries with how often, where and when they were last searched. */
function QueryTable(handle: Handle<QueryTable.Props>) {
	return () => {
		let { heading, label, rows } = handle.props;

		return (
			<Table.Container>
				<Table aria-label={label}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{heading}</Table.Column>
							<Table.Column numeric>Times</Table.Column>
							<Table.Column>Where</Table.Column>
							<Table.Column>Last seen</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map((row) => (
							<Table.Row key={row.query}>
								<Table.Cell>{row.query}</Table.Cell>
								<Table.Cell numeric>{NUMBER_FORMAT.format(row.count)}</Table.Cell>
								<Table.Cell>
									{row.surfaces.map((surface) => SURFACE_LABELS[surface]).join(", ")}
								</Table.Cell>
								<Table.Cell>{row.lastSeen}</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

namespace CountTable {
	export interface Props {
		/** The table's accessible name. */
		label: string;
		heading: string;
		rows: Array<{ name: string; count: number }>;
	}
}

/** Renders named counts, in the order given, as a two-column table. */
function CountTable(handle: Handle<CountTable.Props>) {
	return () => {
		let { heading, label, rows } = handle.props;

		return (
			<Table.Container>
				<Table aria-label={label}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{heading}</Table.Column>
							<Table.Column numeric>Calls</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map((row) => (
							<Table.Row key={row.name}>
								<Table.Cell>{row.name}</Table.Cell>
								<Table.Cell numeric>{NUMBER_FORMAT.format(row.count)}</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}
