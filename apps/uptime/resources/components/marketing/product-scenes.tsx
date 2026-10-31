/**
 * Small product scenes for marketing cards: monitor rows with their response-time line, an
 * alert going down and recovering, and a status page. Each is drawn from the product's own
 * components and copy over example hosts, so a card shows the product rather than an icon.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Badge } from "@sdxc/ui";
import { marketingSurface } from "@sdxc/ui/styles";

import { badgeVariant } from "~/resources/components/badge";
import Sparkline from "~/resources/views/monitors/sparkline";

/** Example monitors: a host and recent response times in milliseconds, oldest first. */
const MONITORS = [
	{
		host: "api.example.com/health",
		times: [182, 176, 190, 171, 205, 188, 179, 184, 176, 192, 181, 174],
	},
	{ host: "example.com", times: [96, 102, 99, 141, 118, 104, 97, 101, 95, 99, 103, 98] },
	{
		host: "app.example.com/login",
		times: [312, 298, 305, 290, 336, 301, 296, 288, 309, 294, 300, 291],
	},
] as const;

/** Days of history each status page service row draws. */
const SERVICE_DAYS = 30;

/** Example status page services; `degradedDay` marks the one day a row shows as degraded. */
const SERVICES: ReadonlyArray<{ name: string; degradedDay?: number }> = [
	{ name: "API" },
	{ name: "Dashboard", degradedDay: 19 },
	{ name: "Webhooks" },
];

/** The scene's surface: a raised panel inset from the card's media edges. */
function panel() {
	return [
		marketingSurface(),
		raw({
			display: "grid",
			gap: "0.75rem",
			padding: "1rem",
			fontSize: "0.8125rem",
			lineHeight: "1.25rem",
			minInlineSize: "0",
		}),
	];
}

/**
 * The media slot's inner frame, one height for every scene so the titles under a row of
 * cards line up. The slot fades its lower half into the card, so each scene keeps its
 * story in the top of the frame and lets its last rows fall into the fade.
 */
function frame() {
	return raw({
		display: "grid",
		alignContent: "start",
		blockSize: "18rem",
		overflow: "hidden",
		padding: "1.5rem 1.5rem 0",
		minInlineSize: "0",
	});
}

/** A host or service name in mono, truncated rather than wrapped. */
function hostText() {
	return raw({
		fontFamily: "var(--ui-font-mono)",
		color: "var(--ui-neutral-fg-emphasis)",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		minInlineSize: "0",
	});
}

namespace MonitorsScene {
	export interface Props {
		/** The status badge's label (`statusPage.status.operational`). */
		upLabel: string;
	}
}

/**
 * Three monitors with the dashboard's response-time line under each host. The scene is
 * decorative; the card's title and copy say what it shows.
 */
export function MonitorsScene(handle: Handle<MonitorsScene.Props>) {
	return () => (
		<div aria-hidden="true" mix={[frame()]}>
			<div mix={[panel()]}>
				{MONITORS.map((monitor) => (
					<div
						key={monitor.host}
						mix={[raw({ display: "grid", gap: "0.375rem", minInlineSize: "0" })]}
					>
						<span
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "0.5rem",
									minInlineSize: "0",
								}),
							]}
						>
							<span mix={[hostText()]}>{monitor.host}</span>
							<Badge {...badgeVariant("up")}>{handle.props.upLabel}</Badge>
						</span>
						<span
							mix={[
								raw({ display: "block", overflow: "hidden" }),
								when("& svg", raw({ maxInlineSize: "100%", blockSize: "auto" })),
							]}
						>
							<Sparkline
								points={monitor.times.map((responseTimeMs, index) => ({
									timestamp: String(index),
									responseTimeMs,
								}))}
							/>
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

namespace AlertsScene {
	export interface Props {
		/** The alert heading for the outage, already interpolated. */
		down: string;
		/** The alert heading for the recovery, already interpolated. */
		recovered: string;
		/** Badge labels for the two states. */
		downLabel: string;
		upLabel: string;
	}
}

/**
 * The two alerts one incident sends: the outage, then the recovery. Each carries the same
 * heading the alert email and chat message use.
 */
export function AlertsScene(handle: Handle<AlertsScene.Props>) {
	return () => {
		let { down, downLabel, recovered, upLabel } = handle.props;
		let alerts = [
			{ text: down, tone: "down" as const, label: downLabel },
			{ text: recovered, tone: "up" as const, label: upLabel },
		];

		return (
			<div aria-hidden="true" mix={[frame()]}>
				<div mix={[panel(), raw({ gap: "0" })]}>
					{alerts.map((alert, index) => (
						<div
							key={alert.tone}
							mix={[
								raw({
									display: "grid",
									gap: "0.375rem",
									paddingBlock: "0.75rem",
									borderBlockStart:
										index === 0
											? "none"
											: "1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))",
								}),
							]}
						>
							<Badge {...badgeVariant(alert.tone)} mix={[raw({ justifySelf: "start" })]}>
								{alert.label}
							</Badge>
							<span
								mix={[
									raw({
										fontWeight: "600",
										color: "var(--ui-neutral-fg-emphasis)",
										overflowWrap: "anywhere",
									}),
								]}
							>
								{alert.text}
							</span>
						</div>
					))}
				</div>
			</div>
		);
	};
}

namespace StatusPageScene {
	export interface Props {
		/** The page banner (`statusPage.banner.operational`). */
		banner: string;
	}
}

/**
 * A public status page: the banner over three services, each with a month of daily bars
 * in the status page's own colours.
 */
export function StatusPageScene(handle: Handle<StatusPageScene.Props>) {
	return () => (
		<div aria-hidden="true" mix={[frame()]}>
			<div mix={[panel()]}>
				<span
					mix={[
						raw({
							padding: "0.5rem 0.75rem",
							borderRadius: "0.5rem",
							fontWeight: "600",
							color: "var(--ui-success-fg)",
							backgroundColor: "var(--ui-success-bg-tint)",
						}),
					]}
				>
					{handle.props.banner}
				</span>
				{SERVICES.map((service) => (
					<div key={service.name} mix={[raw({ display: "grid", gap: "0.375rem" })]}>
						<span mix={[hostText()]}>{service.name}</span>
						<span mix={[raw({ display: "flex", gap: "2px", blockSize: "1.5rem" })]}>
							{Array.from({ length: SERVICE_DAYS }, (_, index) => (
								<span
									key={index}
									mix={[
										raw({
											flex: "1",
											borderRadius: "1px",
											backgroundColor:
												index === service.degradedDay
													? "var(--ui-warning-bg-solid)"
													: "var(--ui-success-bg-solid)",
										}),
									]}
								/>
							))}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
