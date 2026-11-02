/**
 * Relay's contacts: everyone who has written in, as a table whose search, plan and company
 * filters, sort, density and visible columns all live in the URL, with a peek sheet for the
 * contact the URL names so the list stays where it was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ArchiveIcon,
	BadgeCheckIcon,
	Building2Icon,
	CreditCardIcon,
	MessageSquareIcon,
	ReplyIcon,
} from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge, HeadingScope, LinkButton, PropertyList, RelativeTime, Timeline } from "@sdxc/ui";
import { DetailSheet } from "@sdxc/ui/app/detail-sheet";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { Table } from "@sdxc/ui/app/table";
import { ViewOptions } from "@sdxc/ui/app/view-options";

import type { Contact, Plan } from "~/resources/views/demo-apps/relay/data";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import {
	COMPANIES,
	CONTACTS,
	NOW,
	PLANS,
	conversationsOf,
	findCompany,
	findTeammate,
	planOf,
} from "~/resources/views/demo-apps/relay/data";
import { Ghost } from "~/resources/views/demo-apps/relay/ghost";
import {
	FILTER_LABELS,
	SHEET_LABELS,
	VIEW_OPTIONS_LABELS,
} from "~/resources/views/demo-apps/relay/labels";
import { RelayShell } from "~/resources/views/demo-apps/relay/shell";
import { href } from "~/resources/views/demo-apps/relay/views";

/** The columns a person can show or hide, beside the name that always shows. */
const PROPERTIES = [
	{ value: "email", label: "Email" },
	{ value: "company", label: "Company" },
	{ value: "plan", label: "Plan" },
	{ value: "lastSeen", label: "Last seen" },
	{ value: "ltv", label: "Lifetime value" },
	{ value: "conversations", label: "Conversations" },
] as const;

/** The columns shown while the URL names none. */
const DEFAULT_PROPERTIES = ["email", "company", "plan", "lastSeen", "ltv"];

/** The orders the sort menu offers; a leading `-` sorts descending. */
const SORTS = [
	{ value: "-lastSeen", label: "Last seen" },
	{ value: "name", label: "Name" },
	{ value: "-ltv", label: "Lifetime value" },
] as const;

/** The order the list uses while the URL names none. */
const DEFAULT_SORT = "-lastSeen";

/** The row height the list uses while the URL names none. */
const DEFAULT_DENSITY = "compact";

/** The demo states the contacts screen can be asked to show by link. */
export type ContactsState = "loading" | "first-run" | null;

namespace ContactsScreen {
	export interface Props {
		url: URL;
		collapsed: boolean;
		state: ContactsState;
	}
}

/** The query the URL describes: search, facets, sort, density and visible columns. */
interface ContactQuery {
	q: string;
	plans: string[];
	companies: string[];
	sort: string;
	density: "compact" | "comfortable";
	properties: string[];
}

/**
 * Reads the list's query from the address, falling back to the defaults for anything it
 * leaves out or names wrongly, so any hand-edited URL still renders a list.
 *
 * @param url The request's address.
 * @returns The query to apply.
 */
export function readContactQuery(url: URL): ContactQuery {
	let params = url.searchParams;
	let sort = params.get("sort") ?? DEFAULT_SORT;
	let properties = params.getAll("props");
	return {
		q: (params.get("q") ?? "").trim(),
		plans: params.getAll("plan"),
		companies: params.getAll("company"),
		sort: SORTS.some((option) => option.value === sort) ? sort : DEFAULT_SORT,
		density: params.get("density") === "comfortable" ? "comfortable" : DEFAULT_DENSITY,
		properties: properties.length > 0 ? properties : DEFAULT_PROPERTIES,
	};
}

/** Whether a contact matches the search text, by name, email or company. */
function matchesSearch(contact: Contact, q: string): boolean {
	if (q === "") return true;
	let needle = q.toLowerCase();
	let company = findCompany(contact.companyId)?.name ?? "";
	return [contact.name, contact.email, company].some((value) =>
		value.toLowerCase().includes(needle),
	);
}

/**
 * The contacts the query keeps, in its order.
 *
 * @param query The list's query.
 * @returns The matching contacts.
 */
export function filterContacts(query: ContactQuery): Contact[] {
	let matches = CONTACTS.filter(
		(contact) =>
			matchesSearch(contact, query.q) &&
			(query.plans.length === 0 || query.plans.includes(planOf(contact))) &&
			(query.companies.length === 0 || query.companies.includes(contact.companyId)),
	);
	return [...matches].sort((a, b) => {
		if (query.sort === "name") return a.name.localeCompare(b.name);
		if (query.sort === "-ltv") return b.lifetimeValue - a.lifetimeValue;
		return (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "");
	});
}

/**
 * The contacts list's address with one contact open in the sheet, or none, keeping every
 * other parameter so closing the sheet returns to the same list.
 *
 * @param url The current address.
 * @param contactId The contact to open, or `null` to close the sheet.
 * @returns The page path with its query.
 */
function withContact(url: URL, contactId: string | null): string {
	let params = new URLSearchParams(url.searchParams);
	params.delete("toast");
	if (contactId === null) params.delete("contact");
	else params.set("contact", contactId);
	let query = params.toString();
	return query === "" ? "contacts" : `contacts?${query}`;
}

/**
 * A contact's facts as label and value rows, every empty value named. As a ghost each value
 * is a bar the width of its text, for a placeholder.
 */
export function ContactProperties(handle: Handle<{ contact: Contact; ghost?: boolean }>) {
	return () => {
		let { contact, ghost = false } = handle.props;
		let company = findCompany(contact.companyId);
		let plan = planOf(contact);
		let shown = (node: RemixNode) => (ghost ? <Ghost>{node}</Ghost> : node);
		let badge = (
			<Badge variant="secondary" color={plan === "Enterprise" ? "brand" : "neutral"}>
				{plan}
			</Badge>
		);

		return (
			<PropertyList>
				<PropertyList.Item label="Email">{shown(contact.email)}</PropertyList.Item>
				<PropertyList.Item label="Company">{shown(company?.name)}</PropertyList.Item>
				<PropertyList.Item label="Plan">
					{ghost ? <Ghost box>{badge}</Ghost> : badge}
				</PropertyList.Item>
				<PropertyList.Item label="Role">{shown(contact.title)}</PropertyList.Item>
				<PropertyList.Item label="Location">{shown(contact.location)}</PropertyList.Item>
				<PropertyList.Item label="Last seen" empty={shown("Never signed in")}>
					{contact.lastSeen
						? shown(<RelativeTime date={contact.lastSeen} now={NOW} locale="en" />)
						: null}
				</PropertyList.Item>
				<PropertyList.Item label="Lifetime value">
					{shown(
						new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
							contact.lifetimeValue,
						),
					)}
				</PropertyList.Item>
				<PropertyList.Item label="Customer since">
					{shown(<RelativeTime date={contact.since} now={NOW} locale="en" />)}
				</PropertyList.Item>
			</PropertyList>
		);
	};
}

/** One line of a contact's history, newest first. */
interface ActivityEvent {
	key: string;
	at: string;
	actor: string;
	text: string;
	tone: Timeline.Tone;
	kind: "opened" | "replied" | "archived" | "joined";
}

/**
 * A contact's history: the conversations they opened, the team's replies, and when they
 * became a customer.
 *
 * @param contact The contact.
 * @returns Their events, newest first.
 */
function activityOf(contact: Contact): ActivityEvent[] {
	let events: ActivityEvent[] = [
		{
			key: "joined",
			at: contact.since,
			actor: contact.name,
			text: `became a customer on ${planOf(contact)}`,
			tone: "success",
			kind: "joined",
		},
	];
	for (let conversation of conversationsOf(contact.id)) {
		let first = conversation.messages[0];
		if (first) {
			events.push({
				key: `${conversation.id}-opened`,
				at: first.at,
				actor: contact.name,
				text: `wrote “${conversation.subject}”`,
				tone: "brand",
				kind: "opened",
			});
		}
		for (let message of conversation.messages) {
			if (message.from === "contact" || message.note) continue;
			events.push({
				key: `${conversation.id}-${message.at}`,
				at: message.at,
				actor: findTeammate(message.from)?.name ?? "Fernway",
				text: `replied to “${conversation.subject}”`,
				tone: "neutral",
				kind: "replied",
			});
		}
		if (conversation.status === "archived") {
			events.push({
				key: `${conversation.id}-archived`,
				at: conversation.messages.at(-1)?.at ?? contact.since,
				actor: findTeammate(conversation.assigneeId ?? "")?.name ?? "Fernway",
				text: `archived “${conversation.subject}”`,
				tone: "neutral",
				kind: "archived",
			});
		}
	}
	return [...events].sort((a, b) => b.at.localeCompare(a.at));
}

/** The glyph each kind of event draws on the rail. */
function activityIcon(kind: ActivityEvent["kind"]): RemixNode {
	switch (kind) {
		case "opened":
			return <MessageSquareIcon />;
		case "replied":
			return <ReplyIcon />;
		case "archived":
			return <ArchiveIcon />;
		case "joined":
			return <BadgeCheckIcon />;
	}
}

/**
 * A contact's history as a quiet timeline; past the first four, the rest fold away. As a
 * ghost each line is drawn as bars that wrap where its text does, on an empty rail.
 */
export function ContactActivity(handle: Handle<{ contact: Contact; ghost?: boolean }>) {
	return () => {
		let { contact, ghost = false } = handle.props;
		let events = activityOf(contact);
		let shown = (node: RemixNode) => (ghost ? <Ghost>{node}</Ghost> : node);
		let event = (item: ActivityEvent) => (
			<Timeline.Event
				icon={ghost ? <span /> : activityIcon(item.kind)}
				tone={ghost ? "neutral" : item.tone}
				actor={shown(item.actor)}
				time={shown(<RelativeTime date={item.at} now={NOW} locale="en" />)}
			>
				{shown(item.text)}
			</Timeline.Event>
		);
		let rest = events.slice(4);

		return (
			<Timeline aria-label={ghost ? undefined : `${contact.name}'s activity`}>
				{events.slice(0, 4).map(event)}
				{rest.length > 0 ? (
					<Timeline.More summary={shown(`${rest.length} earlier events`)}>
						{ghost ? null : rest.map(event)}
					</Timeline.More>
				) : null}
			</Timeline>
		);
	};
}

/**
 * The contact peek's body, the sheet's `contacts/<id>/sheet` frame: their facts, then
 * their history. As a ghost it is the frame's placeholder, the same rows drawn as bars.
 */
export function ContactSheetBody(handle: Handle<{ contact: Contact; ghost?: boolean }>) {
	return () => {
		let { contact, ghost = false } = handle.props;
		let headingMix = [m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")];
		return (
			<div aria-hidden={ghost ? "true" : undefined} mix={[vstack({ gap: 5, align: "stretch" })]}>
				<ContactProperties contact={contact} ghost={ghost} />
				{ghost ? (
					<div mix={headingMix}>
						<Ghost>Activity</Ghost>
					</div>
				) : (
					<h3 mix={headingMix}>Activity</h3>
				)}
				<ContactActivity contact={contact} ghost={ghost} />
			</div>
		);
	};
}

/** The table head, one column per visible property. */
function ContactsHead(handle: Handle<{ visible: string[] }>) {
	return () => {
		let { visible } = handle.props;
		let shows = (property: string) => visible.includes(property);
		return (
			<Table.Header>
				<Table.Row>
					<Table.Column>Name</Table.Column>
					{shows("email") ? <Table.Column>Email</Table.Column> : null}
					{shows("company") ? <Table.Column>Company</Table.Column> : null}
					{shows("plan") ? <Table.Column>Plan</Table.Column> : null}
					{shows("lastSeen") ? <Table.Column>Last seen</Table.Column> : null}
					{shows("ltv") ? <Table.Column numeric>Lifetime value</Table.Column> : null}
					{shows("conversations") ? <Table.Column numeric>Conversations</Table.Column> : null}
				</Table.Row>
			</Table.Header>
		);
	};
}

/** One contact as a row; the name links the whole row to the contact's peek sheet. */
function ContactRow(
	handle: Handle<{ contact: Contact; visible: string[]; url: URL; open: boolean }>,
) {
	return () => {
		let { contact, visible, url, open } = handle.props;
		let shows = (property: string) => visible.includes(property);
		let plan: Plan = planOf(contact);

		return (
			<Table.Row aria-selected={open ? "true" : undefined}>
				<Table.Cell>
					<Table.RowLink data-rmx-prefetch="intent" href={href(withContact(url, contact.id))}>
						<span mix={[weight("medium")]}>{contact.name}</span>
					</Table.RowLink>
				</Table.Cell>
				{shows("email") ? <Table.IdCell value={contact.email} tail={10} /> : null}
				{shows("company") ? <Table.Cell>{findCompany(contact.companyId)?.name}</Table.Cell> : null}
				{shows("plan") ? (
					<Table.Cell>
						<Badge variant="secondary" color={plan === "Enterprise" ? "brand" : "neutral"}>
							{plan}
						</Badge>
					</Table.Cell>
				) : null}
				{shows("lastSeen") ? (
					<Table.DateCell date={contact.lastSeen} now={NOW} locale="en" />
				) : null}
				{shows("ltv") ? (
					<Table.CurrencyCell value={contact.lifetimeValue} currency="USD" locale="en" />
				) : null}
				{shows("conversations") ? (
					<Table.NumberCell value={conversationsOf(contact.id).length} locale="en" />
				) : null}
			</Table.Row>
		);
	};
}

/** The contact peek: properties and history, with n / N and a link to the full page. */
function ContactSheet(handle: Handle<{ contact: Contact; list: Contact[]; url: URL }>) {
	return () => {
		let { contact, list, url } = handle.props;
		let index = list.findIndex((item) => item.id === contact.id);
		let previous = index > 0 ? list[index - 1] : undefined;
		let next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;
		let company = findCompany(contact.companyId);

		return (
			<DetailSheet
				id="relay-contact-sheet"
				title={contact.name}
				description={`${contact.title} at ${company?.name ?? "an unknown company"}`}
				closeHref={href(withContact(url, null))}
				permalink={href(`contacts/${contact.id}`)}
				position={
					index >= 0
						? {
								index: index + 1,
								total: list.length,
								previousHref: previous ? href(withContact(url, previous.id)) : null,
								nextHref: next ? href(withContact(url, next.id)) : null,
							}
						: undefined
				}
				footer={
					<LinkButton href={href(`contacts/${contact.id}`)} variant="outline" color="neutral">
						Open contact
					</LinkButton>
				}
				labels={SHEET_LABELS}
			>
				<DemoAppFrame
					app="relay"
					part={`contacts/${contact.id}/sheet`}
					fallback={<ContactSheetBody contact={contact} ghost />}
				/>
			</DetailSheet>
		);
	};
}

/** The list's toolbar: search, plan and company facets with counts, sort and display. */
function ContactsToolbar(handle: Handle<{ url: URL; query: ContactQuery }>) {
	return () => {
		let { url, query } = handle.props;
		let searched = CONTACTS.filter((contact) => matchesSearch(contact, query.q));

		return (
			<FilterBar
				id="relay-contacts-filter"
				url={url}
				collapse
				locale="en"
				search={{ label: "Search contacts", placeholder: "Search by name, email or company" }}
				facets={[
					{
						name: "plan",
						label: "Plan",
						icon: <CreditCardIcon size={14} />,
						options: PLANS.map((plan) => ({
							value: plan,
							label: plan,
							count: searched.filter((contact) => planOf(contact) === plan).length,
						})),
					},
					{
						name: "company",
						label: "Company",
						icon: <Building2Icon size={14} />,
						options: COMPANIES.map((company) => ({
							value: company.id,
							label: company.name,
							count: searched.filter((contact) => contact.companyId === company.id).length,
						})),
					},
				]}
				sort={{ label: "Sort by", options: [...SORTS], defaultValue: DEFAULT_SORT }}
				options={
					<ViewOptions
						id="relay-contacts-view"
						url={url}
						inline
						density={{
							defaultValue: DEFAULT_DENSITY,
							options: [
								{ value: "compact", label: "Compact" },
								{ value: "comfortable", label: "Comfortable" },
							],
						}}
						properties={{ defaultValue: DEFAULT_PROPERTIES, options: [...PROPERTIES] }}
						labels={VIEW_OPTIONS_LABELS}
					/>
				}
				labels={FILTER_LABELS}
			/>
		);
	};
}

/** The table, or the state the query and the demo ask for in its place. */
function ContactsTable(handle: Handle<{ url: URL; query: ContactQuery; state: ContactsState }>) {
	return () => {
		let { url, query, state } = handle.props;
		let contacts = filterContacts(query);
		let openId = url.searchParams.get("contact");
		let columns =
			1 + PROPERTIES.filter((property) => query.properties.includes(property.value)).length;

		if (state === "loading") {
			return (
				<Table.Container>
					<Table density={query.density} aria-label="Contacts">
						<ContactsHead visible={query.properties} />
						<Skeleton.Table rows={8} columns={columns} label="Loading contacts" />
					</Table>
				</Table.Container>
			);
		}

		if (contacts.length === 0) {
			return (
				<HeadingScope level={2}>
					<Empty kind="no-results">
						<Empty.Title>No contacts match</Empty.Title>
						<Empty.Description>
							{query.q === "" ? (
								"No contact fits these filters."
							) : (
								<>
									Nobody matches <Empty.Query>{query.q}</Empty.Query> with these filters.
								</>
							)}
						</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("contacts")} variant="outline" color="neutral">
								Clear filters
							</LinkButton>
						</Empty.Action>
					</Empty>
				</HeadingScope>
			);
		}

		return (
			<Table.Container>
				<Table density={query.density} pinFirstColumn aria-label="Contacts">
					<ContactsHead visible={query.properties} />
					<Table.Body>
						{contacts.map((contact) => (
							<ContactRow
								contact={contact}
								visible={query.properties}
								url={url}
								open={contact.id === openId}
							/>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

/**
 * Renders the contacts screen. A `contact` parameter opens that contact's sheet over the
 * list it was found in; `state` shows the loading or first-run state the demo links to.
 */
export function ContactsScreen(handle: Handle<ContactsScreen.Props>) {
	return () => {
		let { url, collapsed, state } = handle.props;
		let query = readContactQuery(url);
		let list = filterContacts(query);
		let open = iife(() => {
			let id = url.searchParams.get("contact");
			return id === null ? undefined : CONTACTS.find((contact) => contact.id === id);
		});

		return (
			<RelayShell current="contacts" collapsed={collapsed} crumb="Contacts">
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						title="Contacts"
						description={`${CONTACTS.length} people at ${COMPANIES.length} companies`}
					/>
					{state === "first-run" ? (
						<HeadingScope level={2}>
							<Empty kind="first-run">
								<Empty.Title>No contacts yet</Empty.Title>
								<Empty.Description>
									A contact appears here the first time someone writes to support@fernway.app.
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={href("contacts")}>Show sample contacts</LinkButton>
								</Empty.Action>
							</Empty>
						</HeadingScope>
					) : (
						<>
							<ContactsToolbar url={url} query={query} />
							<ContactsTable url={url} query={query} state={state} />
						</>
					)}
				</div>
				{open && state === null ? <ContactSheet contact={open} list={list} url={url} /> : null}
			</RelayShell>
		);
	};
}
