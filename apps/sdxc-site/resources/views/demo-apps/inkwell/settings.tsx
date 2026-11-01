/**
 * Inkwell's settings: a section nav that is the parent page on phones, General as sections
 * that each save on their own, Publishing as one long form with a sticky "Unsaved changes"
 * bar, and Team as the masthead with an invite form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Input, Select } from "@sdxc/ui";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SaveBar } from "@sdxc/ui/app/save-bar";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { SettingsSection } from "@sdxc/ui/app/settings-section";
import { Table } from "@sdxc/ui/app/table";

import {
	AUTHORS,
	minutesBefore,
	POSTS,
	PUBLICATION,
} from "~/resources/views/demo-apps/inkwell/data";
import { action, Byline, href, SerifTitle } from "~/resources/views/demo-apps/inkwell/shell";

/** The settings sections, each its own route under `settings/`. */
export type SettingsTab = "general" | "publishing" | "team";

/** Every settings section's name in the nav and the top bar. */
export const SETTINGS_TITLES: Record<SettingsTab, string> = {
	general: "General",
	publishing: "Publishing",
	team: "Team",
};

/** The Save button every explicit section shows. */
const SAVE_LABELS = { save: "Save changes" };

/** Props accepted by {@link SettingsScreen}. */
interface SettingsScreenProps {
	tab: SettingsTab;
	/** `true` on `settings` itself, which a phone shows as the section nav alone. */
	index: boolean;
	now: Date;
}

/** The settings frame around one section. */
export function SettingsScreen(handle: Handle<SettingsScreenProps>) {
	return () => {
		let { tab, index, now } = handle.props;
		let item = (key: SettingsTab) => ({
			href: href(`settings/${key}`),
			label: SETTINGS_TITLES[key],
			current: key === tab && !index,
		});

		return (
			<div mix={[vstack({ gap: 5, align: "stretch" })]}>
				<PageHeader
					title={<SerifTitle>Settings</SerifTitle>}
					description={`How ${PUBLICATION.name} looks, publishes and who writes for it.`}
				/>
				<SettingsLayout
					sections={[
						{ label: "Publication", items: [item("general"), item("publishing")] },
						{ label: "People", items: [item("team")] },
					]}
					page={index ? "index" : "section"}
					backHref={href("settings")}
					labels={{ nav: "Settings", back: "Settings" }}
				>
					{tab === "general" ? <GeneralSettings /> : null}
					{tab === "publishing" ? <PublishingSettings /> : null}
					{tab === "team" ? <TeamSettings now={now} /> : null}
				</SettingsLayout>
			</div>
		);
	};
}

/** The publication's identity and newsletter, each a section with its own Save. */
function GeneralSettings() {
	return () => (
		<div mix={[vstack({ gap: 8, align: "stretch" })]}>
			<SettingsSection
				title="Publication"
				description="What readers see in the masthead, search results and shared links."
				form={{
					action: action("settings/general"),
					fields: <input type="hidden" name="section" value="publication" />,
				}}
				labels={SAVE_LABELS}
			>
				<SettingsSection.Row label="Name" htmlFor="settings-name">
					<Input id="settings-name" name="name" defaultValue={PUBLICATION.name} required />
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Tagline"
					description="One sentence under the masthead."
					htmlFor="settings-tagline"
				>
					<Input id="settings-tagline" name="tagline" defaultValue={PUBLICATION.tagline} />
				</SettingsSection.Row>
				<SettingsSection.Row label="Language" htmlFor="settings-language">
					<Select id="settings-language" name="language">
						<Select.Option value="en" selected>
							English
						</Select.Option>
						<Select.Option value="nb">Norwegian Bokmål</Select.Option>
						<Select.Option value="pt">Portuguese</Select.Option>
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Time zone"
					description="Scheduled posts go out at this zone's time."
					htmlFor="settings-zone"
				>
					<Select id="settings-zone" name="timeZone">
						<Select.Option value="Europe/Oslo" selected>
							Europe/Oslo
						</Select.Option>
						<Select.Option value="Europe/Lisbon">Europe/Lisbon</Select.Option>
						<Select.Option value="America/New_York">America/New_York</Select.Option>
					</Select>
				</SettingsSection.Row>
			</SettingsSection>
			<SettingsSection
				title="Newsletter"
				description="Who the issue comes from, and where replies land."
				form={{
					action: action("settings/general"),
					fields: <input type="hidden" name="section" value="newsletter" />,
				}}
				labels={SAVE_LABELS}
			>
				<SettingsSection.Row label="Sender name" htmlFor="settings-sender">
					<Input id="settings-sender" name="sender" defaultValue="Maya at Lantern Review" />
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Reply-to address"
					description="Readers' replies go here, not to each author."
					htmlFor="settings-reply"
				>
					<Input
						id="settings-reply"
						name="replyTo"
						type="email"
						defaultValue="letters@lanternreview.example"
					/>
				</SettingsSection.Row>
			</SettingsSection>
		</div>
	);
}

/**
 * Publishing defaults as one long form. Each section's Save submits the whole form, and the
 * bar appears once anything differs, with ⌘S and a guard against leaving unsaved.
 */
function PublishingSettings() {
	return () => (
		<form
			id="publishing-form"
			method="post"
			action={action("settings/publishing")}
			mix={[vstack({ gap: 8, align: "stretch" })]}
		>
			<SettingsSection
				title="Defaults for new posts"
				description="What a new draft starts with; every post can change its own."
				labels={SAVE_LABELS}
			>
				<SettingsSection.Row label="Author" htmlFor="publishing-author">
					<Select id="publishing-author" name="author">
						<Select.Option value="writer" selected>
							Whoever creates the post
						</Select.Option>
						{AUTHORS.map((author) => (
							<Select.Option value={author.id}>{author.name}</Select.Option>
						))}
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Review"
					description="Contributors' posts wait for an editor before they can go live."
					htmlFor="publishing-review"
				>
					<Select id="publishing-review" name="review">
						<Select.Option value="contributors" selected>
							Contributors need review
						</Select.Option>
						<Select.Option value="everyone">Everyone needs review</Select.Option>
						<Select.Option value="nobody">Nobody needs review</Select.Option>
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row label="Default tags" htmlFor="publishing-tags">
					<Input id="publishing-tags" name="tags" defaultValue="Essays" />
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Excerpt length"
					description="Words taken from the body when a post has no excerpt."
					htmlFor="publishing-excerpt"
				>
					<Input
						id="publishing-excerpt"
						name="excerptWords"
						type="number"
						min="10"
						max="120"
						defaultValue="40"
					/>
				</SettingsSection.Row>
				<SettingsSection.Row label="Reading time" htmlFor="publishing-reading">
					<Select id="publishing-reading" name="readingTime">
						<Select.Option value="show" selected>
							Show under the title
						</Select.Option>
						<Select.Option value="hide">Hide</Select.Option>
					</Select>
				</SettingsSection.Row>
			</SettingsSection>
			<SettingsSection
				title="Addresses"
				description="Changing the structure redirects every old address to its new one."
				labels={SAVE_LABELS}
			>
				<SettingsSection.Row label="Post addresses" htmlFor="publishing-permalinks">
					<Select id="publishing-permalinks" name="permalinks">
						<Select.Option value="slug" selected>
							/on-slow-reading
						</Select.Option>
						<Select.Option value="year">/2026/on-slow-reading</Select.Option>
						<Select.Option value="tag">/essays/on-slow-reading</Select.Option>
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row label="Tag pages" htmlFor="publishing-tag-base">
					<Input id="publishing-tag-base" name="tagBase" defaultValue="topics" />
				</SettingsSection.Row>
			</SettingsSection>
			<SettingsSection
				title="Feeds"
				description="What feed readers and the newsletter receive."
				labels={SAVE_LABELS}
			>
				<SettingsSection.Row label="Posts in the feed" htmlFor="publishing-feed-count">
					<Input
						id="publishing-feed-count"
						name="feedCount"
						type="number"
						min="1"
						max="100"
						defaultValue="20"
					/>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Feed content"
					description="Full text keeps readers in their reader; excerpts bring them to the site."
					htmlFor="publishing-feed-content"
				>
					<Select id="publishing-feed-content" name="feedContent">
						<Select.Option value="full" selected>
							Full text
						</Select.Option>
						<Select.Option value="excerpt">Excerpt only</Select.Option>
					</Select>
				</SettingsSection.Row>
			</SettingsSection>
			<SaveBar
				labels={{
					message: "Unsaved changes",
					discard: "Discard",
					save: "Save changes",
					shortcut: "⌘S",
				}}
			/>
		</form>
	);
}

/** Props accepted by {@link TeamSettings}. */
interface TeamSettingsProps {
	now: Date;
}

/** The masthead with each person's role and output, then the form that invites someone new. */
function TeamSettings(handle: Handle<TeamSettingsProps>) {
	return () => (
		<div mix={[vstack({ gap: 8, align: "stretch" })]}>
			<section aria-labelledby="team-masthead" mix={[vstack({ gap: 3, align: "stretch" })]}>
				<h2
					id="team-masthead"
					mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}
				>
					Masthead
				</h2>
				<Table.Container>
					<Table aria-labelledby="team-masthead" pinFirstColumn>
						<Table.Header>
							<Table.Row>
								<Table.Column>Name</Table.Column>
								<Table.Column>Role</Table.Column>
								<Table.Column numeric>Posts</Table.Column>
								<Table.Column>Last active</Table.Column>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{AUTHORS.map((author) => (
								<Table.Row key={author.id}>
									<Table.Cell>
										<Byline author={author} />
									</Table.Cell>
									<Table.Cell mix={[fg("neutral.muted")]}>{author.role}</Table.Cell>
									<Table.NumberCell
										value={POSTS.filter((post) => post.authorId === author.id).length}
										locale="en-US"
									/>
									<Table.DateCell
										date={minutesBefore(handle.props.now, author.activeMinutesAgo)}
										now={handle.props.now}
										locale="en-US"
										local
									/>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</Table.Container>
			</section>
			<SettingsSection
				title="Invite a writer"
				description="They get an email with a link that works for seven days."
				form={{ action: action("settings/team") }}
				labels={{ save: "Send invite" }}
			>
				<SettingsSection.Row label="Email" htmlFor="invite-email">
					<Input
						id="invite-email"
						name="email"
						type="email"
						placeholder="name@example.com"
						required
					/>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Role"
					description="Contributors write; editors also publish and schedule."
					htmlFor="invite-role"
				>
					<Select id="invite-role" name="role">
						<Select.Option value="contributor" selected>
							Contributor
						</Select.Option>
						<Select.Option value="editor">Editor</Select.Option>
					</Select>
				</SettingsSection.Row>
			</SettingsSection>
		</div>
	);
}
