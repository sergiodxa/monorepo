/**
 * The bands that show what Rooftree does: a vertical tour through four screens, a grid
 * of the small things that make it stick, the privacy and sync band, and the platforms
 * it runs on. Each band reads on its own, so a reader can land on any of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BellRingIcon,
	CloudOffIcon,
	GlobeIcon,
	KeyRoundIcon,
	LaptopIcon,
	LockIcon,
	MapPinIcon,
	MicIcon,
	MonitorIcon,
	ScanBarcodeIcon,
	SmartphoneIcon,
	TabletIcon,
	UsersIcon,
	WatchIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { Feature, MarketingHeader, MarketingSection } from "@sdxc/ui";
import { FeatureBand, IconWell, TabbedStage } from "@sdxc/ui/patterns";

import {
	CalendarScreen,
	ChoresScreen,
	ListsScreen,
	MealsScreen,
} from "~/resources/views/demos/app/screens";

/** The devices the privacy band shows on one household key, with their last sync. */
const DEVICES = [
	{ name: "Maya's iPhone", icon: SmartphoneIcon, synced: "0.3 s ago" },
	{ name: "Jonah's Pixel", icon: SmartphoneIcon, synced: "0.4 s ago" },
	{ name: "Kitchen iPad", icon: TabletIcon, synced: "2 s ago" },
	{ name: "Ari's MacBook", icon: LaptopIcon, synced: "1 min ago" },
] as const;

/**
 * The tour: a rail of four screens beside a sticky phone, switched with native radios,
 * so the band walks the app without a line of script.
 *
 * @returns The render function producing the band.
 */
export function Tour() {
	return () => (
		<FeatureBand
			id="features"
			layout="stage"
			eyebrow="How it works"
			title="Four screens, one household"
			description={
				<>
					Every list, rota and plan is shared the moment you make it, and{" "}
					<strong>everyone sees who has what</strong> without a group chat.
				</>
			}
			stageLabel="Rooftree's screens"
		>
			<TabbedStage.Item
				value="lists"
				defaultChecked
				label="Lists that know who's at the shop"
				description="Whoever is out sees the list by aisle, and everyone at home watches items tick off live, so nothing is bought twice."
			>
				<ListsScreen />
			</TabbedStage.Item>
			<TabbedStage.Item
				value="chores"
				label="Chores that rotate themselves"
				description="Set a chore once and Rooftree passes it along every Monday. The streak shows the fairness instead of a debate."
			>
				<ChoresScreen />
			</TabbedStage.Item>
			<TabbedStage.Item
				value="calendar"
				label="One calendar, a colour each"
				description="School runs, repairs and practice in one week view, each person in their own colour, with reminders where they're needed."
			>
				<CalendarScreen />
			</TabbedStage.Item>
			<TabbedStage.Item
				value="meals"
				label="Meal plans that fill the list"
				description="Plan the week's dinners, pick a cook for each, and add every missing ingredient to the groceries in one tap."
			>
				<MealsScreen />
			</TabbedStage.Item>
		</FeatureBand>
	);
}

/**
 * The details grid: six smaller features that make a shared list stick, on the tinted
 * band so it reads apart from the tour above it.
 *
 * @returns The render function producing the band.
 */
export function Details() {
	return () => (
		<FeatureBand
			layout="grid"
			tone="tinted"
			columns={3}
			eyebrow="The small things"
			title="Built for the aisle, not the desk"
			description="The features families asked for once they had used Rooftree for a month."
		>
			<Feature>
				<Feature.Icon>
					<CloudOffIcon />
				</Feature.Icon>
				<Feature.Title>Works without signal</Feature.Title>
				<Feature.Description>
					Tick items off in the basement aisle; Rooftree{" "}
					<strong>syncs the moment you're back</strong> online.
				</Feature.Description>
			</Feature>
			<Feature>
				<Feature.Icon>
					<ScanBarcodeIcon />
				</Feature.Icon>
				<Feature.Title>Scan to restock</Feature.Title>
				<Feature.Description>
					Point the camera at an empty box and it lands on the list with{" "}
					<strong>its exact name</strong>.
				</Feature.Description>
			</Feature>
			<Feature>
				<Feature.Icon>
					<MicIcon />
				</Feature.Icon>
				<Feature.Title>Add by voice</Feature.Title>
				<Feature.Description>
					Say "oat milk and two lemons" with flour on your hands, and{" "}
					<strong>both rows appear</strong>.
				</Feature.Description>
			</Feature>
			<Feature>
				<Feature.Icon>
					<MapPinIcon />
				</Feature.Icon>
				<Feature.Title>Reminders by place</Feature.Title>
				<Feature.Description>
					Your phone nudges you <strong>as you walk past the shop</strong>, not at a time you
					guessed.
				</Feature.Description>
			</Feature>
			<Feature>
				<Feature.Icon>
					<UsersIcon />
				</Feature.Icon>
				<Feature.Title>Accounts for kids</Feature.Title>
				<Feature.Description>
					Children see their chores and the calendar, and <strong>nothing they can delete</strong>.
				</Feature.Description>
			</Feature>
			<Feature>
				<Feature.Icon>
					<BellRingIcon />
				</Feature.Icon>
				<Feature.Title>Quiet by default</Feature.Title>
				<Feature.Description>
					One summary each evening instead of a ping per tick, <strong>unless it's yours</strong> to
					do.
				</Feature.Description>
			</Feature>
		</FeatureBand>
	);
}

/**
 * The privacy band: what end-to-end encryption means for a household, beside the
 * household key and the devices it unlocks, on an inset inverse panel.
 *
 * @returns The render function producing the band.
 */
export function Privacy() {
	return () => (
		<FeatureBand
			id="privacy"
			layout="split"
			tone="inverse"
			inset
			eyebrow="Privacy"
			title="What happens at home stays there"
			description={
				<>
					Lists, rotas and plans are encrypted on your devices with a key only your household holds.{" "}
					<strong>We can't read them, and we never sell a thing.</strong>
				</>
			}
			media={<HouseholdKey />}
		>
			<ul>
				<li>End-to-end encrypted on every device</li>
				<li>No ads, no trackers, no data brokers</li>
				<li>Export or delete everything in one tap</li>
			</ul>
		</FeatureBand>
	);
}

/**
 * The privacy band's picture: the household key over the devices it unlocks, each with
 * its last sync, drawn as a raised card in live markup.
 *
 * @returns The render function producing the card.
 */
function HouseholdKey() {
	return () => (
		<div
			mix={[
				vstack({ gap: 4, align: "stretch" }),
				text("sm"),
				raw({
					padding: "1.25rem",
					borderRadius: "1.25rem",
					backgroundColor: "var(--ui-surface-raised)",
					boxShadow: "var(--ui-shadow-stage)",
				}),
			]}
		>
			<div mix={[hstack({ gap: 3, align: "center" })]}>
				<span
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							inlineSize: "2.5rem",
							blockSize: "2.5rem",
							borderRadius: "0.75rem",
							color: "white",
							backgroundColor: "var(--ui-brand-bg-solid)",
						}),
					]}
				>
					<KeyRoundIcon size={18} />
				</span>
				<span mix={[vstack({ gap: 0, align: "start" }), raw({ flex: "1" })]}>
					<span mix={[weight("semibold"), fg("neutral.emphasis")]}>Ortega household key</span>
					<span mix={[text("xs"), fg("neutral.muted"), font("mono")]}>7F3A 92C1 E04B</span>
				</span>
			</div>
			<ul
				mix={[
					vstack({ gap: 0, align: "stretch" }),
					raw({ listStyle: "none", margin: "0", padding: "0" }),
				]}
			>
				{DEVICES.map((device) => {
					let Icon = device.icon;
					return (
						<li
							key={device.name}
							mix={[
								hstack({ gap: 3, align: "center" }),
								raw({
									paddingBlock: "0.75rem",
									borderBlockStart: "1px solid var(--ui-marketing-hairline)",
								}),
							]}
						>
							<span mix={[fg("neutral.muted")]}>
								<Icon size={18} />
							</span>
							<span mix={[raw({ flex: "1" }), fg("neutral.emphasis"), weight("medium")]}>
								{device.name}
							</span>
							<span mix={[text("xs"), fg("neutral.muted"), tabularNums()]}>
								Synced {device.synced}
							</span>
						</li>
					);
				})}
			</ul>
			<p mix={[hstack({ gap: 2, align: "start" }), text("xs"), fg("neutral.muted")]}>
				<span mix={[fg("success"), raw({ paddingBlockStart: "0.125rem" })]}>
					<LockIcon size={12} />
				</span>
				End-to-end encrypted. A new device joins only when someone at home approves it from a phone
				already on the key.
			</p>
		</div>
	);
}

/** Every place Rooftree runs, with the one thing it does best there. */
const PLATFORMS = [
	{ name: "iPhone & iPad", icon: SmartphoneIcon, detail: "Lock-screen list" },
	{ name: "Android", icon: SmartphoneIcon, detail: "Widgets and tiles" },
	{ name: "Apple Watch", icon: WatchIcon, detail: "Tick off at the till" },
	{ name: "Mac", icon: LaptopIcon, detail: "Plan the week" },
	{ name: "Windows", icon: MonitorIcon, detail: "Family PC calendar" },
	{ name: "Web", icon: GlobeIcon, detail: "Any browser" },
] as const;

/**
 * The platforms band: a centered header over a ruled row of six platform tiles, so a
 * household with mixed phones sees at a glance that nobody is left out.
 *
 * @returns The render function producing the band.
 */
export function Platforms() {
	return () => (
		<MarketingSection id="platforms" align="center">
			<MarketingHeader
				align="center"
				eyebrow="Everywhere you are"
				description={
					<>
						iPhone and Android in one family is the usual case.{" "}
						<strong>Every device gets every feature.</strong>
					</>
				}
			>
				Mixed phones, one household
			</MarketingHeader>
			<ul
				mix={[
					combine([
						raw({
							display: "grid",
							gap: "1px",
							gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
							margin: "0",
							padding: "0",
							listStyle: "none",
							inlineSize: "100%",
							overflow: "hidden",
							borderRadius: "var(--ui-marketing-radius-surface, 1rem)",
							backgroundColor: "var(--ui-marketing-hairline)",
							boxShadow: "inset 0 0 0 1px var(--ui-marketing-hairline)",
						}),
						at("md", raw({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" })),
						at("xl", raw({ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" })),
					]),
				]}
			>
				{PLATFORMS.map((platform) => {
					let Icon = platform.icon;
					return (
						<li
							key={platform.name}
							mix={[
								vstack({ gap: 3, align: "center" }),
								raw({
									paddingBlock: "2rem",
									paddingInline: "1rem",
									backgroundColor: "var(--ui-bg)",
								}),
							]}
						>
							<IconWell>
								<Icon />
							</IconWell>
							<span mix={[vstack({ gap: 0.5, align: "center" })]}>
								<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
									{platform.name}
								</span>
								<span mix={[text("xs"), fg("neutral.muted")]}>{platform.detail}</span>
							</span>
						</li>
					);
				})}
			</ul>
		</MarketingSection>
	);
}
