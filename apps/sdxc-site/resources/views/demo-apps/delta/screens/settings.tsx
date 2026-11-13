/**
 * The repository's settings: General (its name, description and website, saved explicitly,
 * then the features that switch on as they flip, then the danger zone) and Branches (the
 * protection rule on `main`). Archive and delete answer with Undo and never lose anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArchiveIcon, ShieldIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, text } from "@sdxc/u/typography";
import {
	Checkbox,
	FieldError,
	Group,
	HeadingScope,
	Input,
	Select,
	Switch,
	TextArea,
} from "@sdxc/ui";
import { DangerZone } from "@sdxc/ui/app/danger-zone";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { SettingsSection } from "@sdxc/ui/app/settings-section";
import { Banner } from "@sdxc/ui/banner";

import type { RepoSettings } from "../prefs";

import { actionHref, repoHref } from "../data";
import { COPY } from "../labels";
import { RepoHeader } from "../shell";

/** Which settings page the address names. */
export type SettingsPage = "index" | "general" | "branches";

/** What a failed General save typed, with why each field was refused, to draw the form again. */
export interface SettingsDraft {
	values: Pick<RepoSettings, "name" | "description" | "website">;
	errors: Partial<Record<"name" | "description" | "website", string>>;
}

/** The repository's full name as the delete confirmation asks for it. */
const FULL_NAME = `${COPY.org}/${COPY.repo}`;

/** The features the switches turn on and off, in the order they list. */
const FEATURES = ["issues", "discussions", "wiki", "projects"] as const;

namespace General {
	export interface Props {
		settings: RepoSettings;
		draft?: SettingsDraft;
	}
}

/**
 * The General page: the name, description and website with their own Save; the features,
 * each a switch that saves as it flips; then archive and delete, last and in red.
 */
function General(handle: Handle<General.Props>) {
	return () => {
		let { draft, settings } = handle.props;
		let copy = COPY.settings.general;
		let values = draft?.values ?? settings;
		let errors = draft?.errors ?? {};
		let described = (field: keyof SettingsDraft["errors"], hint?: string) =>
			[errors[field] ? `delta-settings-${field}-error` : "", hint ?? ""]
				.filter(Boolean)
				.join(" ") || undefined;
		return (
			<>
				{settings.archived ? (
					<Banner color="warning" label={copy.archivedTitle} icon={<ArchiveIcon />}>
						{copy.archivedHint}
					</Banner>
				) : null}
				<SettingsSection
					title={copy.section}
					description={copy.sectionHint}
					save="explicit"
					form={{
						action: actionHref("delta/settings"),
						fields: <input type="hidden" name="intent" value="general" />,
					}}
					labels={{ save: copy.save }}
				>
					<SettingsSection.Row
						label={copy.name}
						description={copy.nameHint}
						htmlFor="delta-settings-name"
						descriptionId="delta-settings-name-hint"
					>
						<Group>
							<Group.Text id="delta-settings-name-prefix" htmlFor="delta-settings-name">
								<span mix={[font("mono")]}>{`${COPY.org} /`}</span>
							</Group.Text>
							<Input
								id="delta-settings-name"
								name="name"
								defaultValue={values.name}
								required
								maxLength={100}
								spellcheck={false}
								autocomplete="off"
								aria-invalid={errors.name ? "true" : undefined}
								aria-describedby={described(
									"name",
									"delta-settings-name-prefix delta-settings-name-hint",
								)}
								mix={[font("mono")]}
							/>
						</Group>
						{errors.name ? (
							<FieldError id="delta-settings-name-error">{errors.name}</FieldError>
						) : null}
					</SettingsSection.Row>
					<SettingsSection.Row label={copy.description} htmlFor="delta-settings-description">
						<TextArea
							id="delta-settings-description"
							name="description"
							rows={3}
							maxLength={350}
							defaultValue={values.description}
							aria-invalid={errors.description ? "true" : undefined}
							aria-describedby={described("description")}
						/>
						{errors.description ? (
							<FieldError id="delta-settings-description-error">{errors.description}</FieldError>
						) : null}
					</SettingsSection.Row>
					<SettingsSection.Row label={copy.website} htmlFor="delta-settings-website">
						<Input
							id="delta-settings-website"
							name="website"
							type="url"
							inputmode="url"
							defaultValue={values.website}
							placeholder="https://"
							aria-invalid={errors.website ? "true" : undefined}
							aria-describedby={described("website")}
						/>
						{errors.website ? (
							<FieldError id="delta-settings-website-error">{errors.website}</FieldError>
						) : null}
					</SettingsSection.Row>
				</SettingsSection>
				<SettingsSection
					title={copy.features}
					description={copy.featuresHint}
					save="instant"
					form={{
						action: actionHref("delta/settings"),
						fields: <input type="hidden" name="intent" value="features" />,
					}}
					labels={{ save: copy.saveFeatures }}
				>
					{FEATURES.map((feature) => (
						<SettingsSection.Row
							layout="inline-switch"
							label={copy.featureNames[feature]}
							description={copy.featureHints[feature]}
							labelId={`delta-feature-${feature}`}
							descriptionId={`delta-feature-${feature}-hint`}
						>
							<Switch
								key={`${feature}-${settings[feature]}`}
								name={feature}
								checked={settings[feature]}
								aria-labelledby={`delta-feature-${feature}`}
								aria-describedby={`delta-feature-${feature}-hint`}
							/>
						</SettingsSection.Row>
					))}
				</SettingsSection>
				<DangerZone title={copy.danger}>
					{settings.archived ? (
						<DangerZone.Action
							id="delta-settings-unarchive"
							title={copy.unarchiveTitle}
							description={copy.unarchiveHint}
							actionPlacement="end"
							buttonLabel={copy.unarchive}
							confirm={{
								title: copy.unarchiveConfirmTitle,
								description: copy.unarchiveConfirmHint,
								confirmLabel: copy.unarchive,
								cancelLabel: copy.cancel,
								form: { action: actionHref("delta/settings/unarchive") },
							}}
						/>
					) : (
						<DangerZone.Action
							id="delta-settings-archive"
							title={copy.archiveTitle}
							description={copy.archiveHint}
							actionPlacement="end"
							buttonLabel={copy.archive}
							confirm={{
								title: copy.archiveConfirmTitle,
								description: copy.archiveConfirmHint,
								confirmLabel: copy.archive,
								cancelLabel: copy.cancel,
								form: { action: actionHref("delta/settings/archive") },
							}}
						/>
					)}
					<DangerZone.Action
						id="delta-settings-delete"
						title={copy.deleteTitle}
						description={copy.deleteHint}
						consequences={[...copy.deleteConsequences]}
						buttonLabel={copy.delete}
						confirm={{
							title: copy.deleteConfirmTitle,
							description: copy.deleteConfirmHint,
							confirmLabel: copy.deleteConfirm,
							cancelLabel: copy.cancel,
							typeToConfirm: {
								value: FULL_NAME,
								label: copy.deleteType(FULL_NAME),
								name: "confirmation",
							},
							form: { action: actionHref("delta/settings/delete") },
						}}
					/>
				</DangerZone>
			</>
		);
	};
}

/**
 * The Branches page: the one protection rule, on `main`, as a form with its own Save, since a
 * rule is read as a whole before it applies.
 */
function Branches(handle: Handle<{ settings: RepoSettings }>) {
	return () => {
		let { settings } = handle.props;
		let copy = COPY.settings.branches;
		return (
			<SettingsSection
				title={
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })]}>
						<ShieldIcon size={16} aria-hidden="true" mix={[fg("brand")]} />
						{copy.rule}
						<span
							mix={[
								font("mono"),
								text("sm"),
								raw({
									paddingInline: "0.375rem",
									borderRadius: "var(--ui-radius-md)",
									background: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
								}),
								fg("brand"),
							]}
						>
							main
						</span>
					</span>
				}
				description={copy.ruleHint}
				save="explicit"
				form={{
					action: actionHref("delta/settings/branches"),
					fields: <input type="hidden" name="intent" value="protection" />,
				}}
				labels={{ save: copy.save }}
			>
				<SettingsSection.Row
					label={copy.reviews}
					description={copy.reviewsHint}
					htmlFor="delta-rule-reviews"
				>
					<Select key={`reviews-${settings.reviews}`} id="delta-rule-reviews" name="reviews">
						{[0, 1, 2, 3, 4, 5, 6].map((count) => (
							<Select.Option value={String(count)} selected={count === settings.reviews}>
								{copy.reviewCount(count)}
							</Select.Option>
						))}
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row label={copy.checks} description={copy.checksHint} layout="stacked">
					<Checkbox name="checks" checked={settings.checks}>
						<span mix={[text("sm")]}>{copy.checksLabel}</span>
					</Checkbox>
					<ul
						aria-label={copy.requiredChecks}
						mix={[
							raw({
								listStyle: "none",
								margin: "0.25rem 0 0",
								padding: 0,
								display: "flex",
								flexWrap: "wrap",
								gap: "0.375rem",
							}),
						]}
					>
						{copy.checkNames.map((name) => (
							<li
								mix={[
									font("mono"),
									text("xs"),
									fg("neutral.muted"),
									raw({
										padding: "0.125rem 0.5rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "999px",
									}),
								]}
							>
								{name}
							</li>
						))}
					</ul>
				</SettingsSection.Row>
				<SettingsSection.Row label={copy.linear} description={copy.linearHint} layout="stacked">
					<Checkbox name="linear" checked={settings.linear}>
						<span mix={[text("sm")]}>{copy.linearLabel}</span>
					</Checkbox>
				</SettingsSection.Row>
			</SettingsSection>
		);
	};
}

namespace SettingsScreen {
	export interface Props {
		page: SettingsPage;
		settings: RepoSettings;
		commits: number;
		draft?: SettingsDraft;
	}
}

/**
 * Renders the repository's settings under its header: the section nav beside the page, which
 * a phone shows as the settings' first page, with a link back from each section.
 */
export function SettingsScreen(handle: Handle<SettingsScreen.Props>) {
	return () => {
		let { commits, draft, page, settings } = handle.props;
		let section = page === "branches" ? "branches" : "general";
		return (
			<>
				<RepoHeader
					title={COPY.settings.title}
					trail={[{ label: COPY.settings.title }]}
					tab="settings"
					commits={commits}
				/>
				<div mix={[raw({ paddingBlockStart: "1.25rem" })]}>
					<SettingsLayout
						page={page === "index" ? "index" : "section"}
						backHref={repoHref("settings")}
						labels={{ nav: COPY.settings.nav, back: COPY.settings.title }}
						sections={[
							{
								items: [
									{
										href: repoHref("settings/general"),
										label: COPY.settings.general.title,
										current: section === "general",
									},
									{
										href: repoHref("settings/branches"),
										label: COPY.settings.branches.title,
										current: section === "branches",
									},
								],
							},
						]}
					>
						<HeadingScope level={2}>
							{section === "general" ? (
								<General settings={settings} draft={draft} />
							) : (
								<Branches settings={settings} />
							)}
						</HeadingScope>
					</SettingsLayout>
				</div>
			</>
		);
	};
}
