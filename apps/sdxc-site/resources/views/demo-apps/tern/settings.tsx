/**
 * Tern's settings: general preferences with this month's usage, personalisation of how Tern
 * answers, and data controls. Typed fields save with a button, switches save as they flip,
 * and deleting every chat asks for confirmation by name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { DownloadIcon } from "@sdxc/icons";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, minIs, p } from "@sdxc/u/size";
import { tabularNums, text, weight } from "@sdxc/u/typography";
import { Button, HeadingScope, Input, Select, Switch, TextArea } from "@sdxc/ui";
import { DangerZone } from "@sdxc/ui/app/danger-zone";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { SettingsSection } from "@sdxc/ui/app/settings-section";
import { Skeleton } from "@sdxc/ui/app/skeleton";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import { MAIN_FRAME } from "~/resources/views/demo-apps/main-frame";
import { MODELS, PERSON, actionHref, href } from "~/resources/views/demo-apps/tern/data";
import { SETTINGS_LABELS } from "~/resources/views/demo-apps/tern/labels";
import { TernShell } from "~/resources/views/demo-apps/tern/shell";

/** The settings pages, by the path after `settings/`. */
export const SETTINGS_PAGES = ["general", "personalization", "data"] as const;

/** One settings page. */
export type SettingsPage = (typeof SETTINGS_PAGES)[number];

/** This month's messages per model, against the plan's monthly allowance. */
const USAGE = [
	{ model: "Tern Glide", used: 412, limit: 2000 },
	{ model: "Tern Soar", used: 1180, limit: 1500 },
	{ model: "Tern Dive", used: 61, limit: 100 },
] as const;

/** This month's usage as bars, or with `ghost` its placeholder at the same size. */
export function UsagePanel(handle: Handle<{ ghost?: boolean }>) {
	return () => {
		let ghost = handle.props.ghost ?? false;
		let shown = (value: string) => (ghost ? <Skeleton.Text>{value}</Skeleton.Text> : value);
		return (
			<ul
				aria-label={ghost ? undefined : "Messages this month"}
				aria-hidden={ghost ? "true" : undefined}
				mix={[vstack({ gap: 4, align: "stretch" }), m(0), p(0), listStyle()]}
			>
				{USAGE.map((row) => {
					let share = Math.round((row.used / row.limit) * 100);
					return (
						<li mix={[vstack({ gap: 1.5, align: "stretch" })]}>
							<div mix={[hstack({ gap: 2, align: "baseline", justify: "between" }), text("sm")]}>
								<span mix={[weight("medium")]}>{shown(row.model)}</span>
								<span mix={[tabularNums(), fg("neutral.muted")]}>
									{shown(`${row.used.toLocaleString("en")} of ${row.limit.toLocaleString("en")}`)}
								</span>
							</div>
							<div
								mix={[
									raw({
										blockSize: "0.375rem",
										borderRadius: "999px",
										background: "var(--ui-neutral-bg-tint-pressed)",
										overflow: "hidden",
									}),
								]}
							>
								<div
									mix={[
										raw({
											blockSize: "100%",
											inlineSize: ghost ? "0%" : `${share}%`,
											borderRadius: "999px",
											background:
												share >= 75 ? "var(--ui-warning-bg-solid)" : "var(--ui-brand-bg-solid)",
										}),
									]}
								/>
							</div>
						</li>
					);
				})}
			</ul>
		);
	};
}

/** Theme, language and default model, saved together, then usage. */
function General() {
	return () => (
		<div mix={[vstack({ gap: 8, align: "stretch" }), minIs(0)]}>
			<SettingsSection
				title="General"
				description="How Tern looks and which model a new chat starts on."
				save="explicit"
				form={{
					action: actionHref("settings/general"),
					fields: <input type="hidden" name="section" value="general" />,
				}}
				labels={{ save: "Save preferences" }}
			>
				<SettingsSection.Row label="Theme" htmlFor="tern-settings-theme">
					<Select id="tern-settings-theme" name="theme">
						<Select.Option value="system" selected>
							Match the system
						</Select.Option>
						<Select.Option value="light">Light</Select.Option>
						<Select.Option value="dark">Dark</Select.Option>
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Language"
					description="Tern answers in the language you write in."
					htmlFor="tern-settings-language"
				>
					<Select id="tern-settings-language" name="language">
						<Select.Option value="en-GB" selected>
							English (UK)
						</Select.Option>
						<Select.Option value="pt-PT">Português (Portugal)</Select.Option>
						<Select.Option value="es">Español</Select.Option>
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row label="Default model" htmlFor="tern-settings-model">
					<Select id="tern-settings-model" name="model">
						{MODELS.map((model) => (
							<Select.Option value={model.id} selected={model.id === "soar"}>
								{model.name}
							</Select.Option>
						))}
					</Select>
				</SettingsSection.Row>
			</SettingsSection>
			<section
				aria-labelledby="tern-usage-title"
				mix={[
					vstack({ gap: 4, align: "stretch" }),
					p(5),
					rounded("lg"),
					border({ color: "neutral", width: 1 }),
				]}
			>
				<div mix={[vstack({ gap: 1, align: "start" })]}>
					<h2 id="tern-usage-title" mix={[m(0), text("base"), weight("semibold")]}>
						Usage this month
					</h2>
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
						Resets on 1 December. Dive has the smallest allowance.
					</p>
				</div>
				<DemoAppFrame app="tern" part="settings/usage" fallback={<UsagePanel ghost />} />
			</section>
		</div>
	);
}

/** What Tern should know about Ines and how it should answer. */
function Personalization() {
	return () => (
		<div mix={[vstack({ gap: 8, align: "stretch" }), minIs(0)]}>
			<SettingsSection
				title="About you"
				description="Tern reads this before every chat."
				save="explicit"
				form={{
					action: actionHref("settings/personalization"),
					fields: <input type="hidden" name="section" value="about" />,
				}}
				labels={{ save: "Save" }}
			>
				<SettingsSection.Row label="What should Tern call you?" htmlFor="tern-settings-name">
					<Input id="tern-settings-name" name="nickname" defaultValue={PERSON.name.split(" ")[0]} />
				</SettingsSection.Row>
				<SettingsSection.Row label="What do you do?" htmlFor="tern-settings-role">
					<Input
						id="tern-settings-role"
						name="role"
						defaultValue="Designer and co-founder at Harbor"
					/>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="How should Tern reply?"
					description="Tone, length, format, anything you would tell a new colleague."
					htmlFor="tern-settings-style"
					layout="stacked"
				>
					<TextArea
						id="tern-settings-style"
						name="style"
						rows={4}
						defaultValue="Short and direct. British spelling. Tables when comparing things. No emoji."
					/>
				</SettingsSection.Row>
			</SettingsSection>
			<SettingsSection
				title="Memory"
				description="Each change saves as soon as you flip it."
				save="instant"
				form={{
					action: actionHref("settings/personalization"),
					fields: <input type="hidden" name="section" value="memory" />,
				}}
				labels={{ save: "Save memory setting" }}
			>
				<SettingsSection.Row
					layout="inline-switch"
					label="Remember things across chats"
					description="Tern keeps short notes, such as your studio’s name, and shows each one before using it."
					labelId="tern-settings-memory"
					descriptionId="tern-settings-memory-help"
				>
					<Switch
						name="memory"
						aria-labelledby="tern-settings-memory"
						aria-describedby="tern-settings-memory-help"
						checked
					/>
				</SettingsSection.Row>
			</SettingsSection>
		</div>
	);
}

/** Training, export and deleting every chat. */
function DataControls() {
	return () => (
		<div mix={[vstack({ gap: 8, align: "stretch" }), minIs(0)]}>
			<SettingsSection
				title="Your data"
				description="Each change saves as soon as you flip it."
				save="instant"
				form={{
					action: actionHref("settings/data"),
					fields: <input type="hidden" name="section" value="training" />,
				}}
				labels={{ save: "Save data setting" }}
			>
				<SettingsSection.Row
					layout="inline-switch"
					label="Improve Tern with my chats"
					description="Off: your chats are never used to train models."
					labelId="tern-settings-training"
					descriptionId="tern-settings-training-help"
				>
					<Switch
						name="training"
						aria-labelledby="tern-settings-training"
						aria-describedby="tern-settings-training-help"
					/>
				</SettingsSection.Row>
			</SettingsSection>
			<section
				aria-labelledby="tern-export-title"
				mix={[
					hstack({ gap: 4, align: "center", justify: "between" }),
					raw({ flexWrap: "wrap" }),
					p(5),
					rounded("lg"),
					border({ color: "neutral", width: 1 }),
				]}
			>
				<div mix={[vstack({ gap: 1, align: "start" }), raw({ flex: "1 1 16rem" })]}>
					<h2 id="tern-export-title" mix={[m(0), text("base"), weight("semibold")]}>
						Export chats
					</h2>
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
						We email {PERSON.email} a link to a file of every chat, valid for 24 hours.
					</p>
				</div>
				<form method="post" action={actionHref("settings/data")}>
					<input type="hidden" name="section" value="export" />
					<Button type="submit" variant="outline" color="neutral">
						<DownloadIcon size={16} aria-hidden="true" />
						Export chats
					</Button>
				</form>
			</section>
			<DangerZone title="Danger zone">
				<DangerZone.Action
					id="tern-settings-delete-all"
					title="Delete every chat"
					description="Removes all chats and their canvases. Projects stay, empty."
					consequences={["8 chats deleted", "Shared links stop working"]}
					buttonLabel="Delete all chats…"
					confirm={{
						title: "Delete every chat?",
						description: "This cannot be undone.",
						confirmLabel: "Delete all chats",
						cancelLabel: "Cancel",
						typeToConfirm: {
							value: "delete my chats",
							label: "Type “delete my chats”",
							name: "confirmation",
						},
						form: {
							action: actionHref("settings/data"),
							fields: <input type="hidden" name="section" value="delete-all" />,
						},
					}}
				/>
			</DangerZone>
		</div>
	);
}

/** Renders a settings page: the section nav beside the section, or the nav alone on a phone. */
export function SettingsScreen(handle: Handle<{ collapsed: boolean; page: SettingsPage | null }>) {
	return () => {
		let { collapsed, page } = handle.props;
		let shown = page ?? "general";
		let item = (slug: SettingsPage, label: string) => ({
			href: href(`settings/${slug}`),
			label,
			current: shown === slug,
		});

		return (
			<TernShell collapsed={collapsed} crumb="Settings">
				<div mix={[vstack({ gap: 6, align: "stretch" })]}>
					<PageHeader title="Settings" description={`For ${PERSON.email}`} />
					<SettingsLayout
						sections={[
							{
								label: "Account",
								items: [
									item("general", "General"),
									item("personalization", "Personalisation"),
									item("data", "Data controls"),
								],
							},
						]}
						page={page === null ? "index" : "section"}
						backHref={href("settings")}
						frame={MAIN_FRAME}
						labels={SETTINGS_LABELS}
					>
						<HeadingScope level={2}>
							{shown === "personalization" ? <Personalization /> : null}
							{shown === "data" ? <DataControls /> : null}
							{shown === "general" ? <General /> : null}
						</HeadingScope>
					</SettingsLayout>
				</div>
			</TernShell>
		);
	};
}
