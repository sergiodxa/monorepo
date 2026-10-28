/**
 * Dedicated `/mcp` marketing view — sells Streamable HTTP MCP to anonymous
 * visitors, and shows signed-in teammates the remote client config and scopes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { IntlProvider } from "@sdxc/i18n/ui";
import { ArrowRightIcon, CheckIcon } from "@sdxc/icons";
import { animation } from "@sdxc/u/animation";
import { bg, border, fg, linearGradient, radialGradient } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { listStyle, pointerEvents } from "@sdxc/u/general";
import {
	absolute,
	flex,
	flexWrap,
	gap,
	inlineFlex,
	insBs,
	insIs,
	items,
	justify,
	relative,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { dark, media, motionSafe } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, mi, minBs, mbs, p, pb, pbs, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { translateX, translateY } from "@sdxc/u/transform";
import {
	font,
	fontSize,
	leading,
	textAlign,
	tracking,
	weight,
	whiteSpace,
} from "@sdxc/u/typography";
import { Heading, LinkButton, Text } from "@sdxc/ui";
import { easings } from "@sdxc/ui/animations";

import CopyButton from "~/resources/components/copy-button";
import AuthCta from "~/resources/components/marketing/auth-cta";
import SectionHeader from "~/resources/components/marketing/section-header";
import routes from "~/routes/web";

namespace McpLandingView {
	export interface Props {
		isSignedIn: boolean;
		brand: string;
		heroTitle: string;
		heroHighlight: string;
		heroDescription: string;
		heroCtaOut: string;
		heroCtaIn: string;
		signalLabel: string;
		endpoint: string;
		protocol: string;
		protocolBadge: string;
		protocolTitle: string;
		protocolDescription: string;
		toolsBadge: string;
		toolsTitle: string;
		toolsDescription: string;
		toolsApi: string;
		toolsScopes: string;
		toolsRemote: string;
		setupBadge: string;
		setupHeading: string;
		setupLead: string;
		setupSteps: [string, string, string, string];
		scopesNote: string;
		configLabel: string;
		configJson: string;
		copyLabel: string;
		openKeysLabel: string;
		dashboardLabel: string;
		finalCtaTitle: string;
		finalCtaBody: string;
		finalCtaLabel: string;
		/** Translator for the copy-button island. */
		intl: I18n;
	}
}

/** Vertical section padding shared with other marketing landings. */
function sectionPadding() {
	return [pb(16), media("(min-width: 640px)", pb(24)), media("(min-width: 1024px)", pb(32))];
}

/** Centered content wrapper capped at 1152px. */
function marketingContainer() {
	return [
		maxIs("1152px"),
		mi("auto"),
		pi(4),
		media("(min-width: 640px)", pi(6)),
		media("(min-width: 1024px)", pi(8)),
	];
}

/** Soft alternate-section background. */
function tintedSection() {
	return [bg("color.neutral.100"), dark(bg("color.neutral.900"))];
}

/** Breathing radial glow behind the hero brand — gated to motion-safe visitors. */
function pulseGlow() {
	return motionSafe(
		animation("uptime-mcp-pulse", {
			keyframes: {
				"0%, 100%": { opacity: 0.45, transform: "translate(-50%, -50%) scale(1)" },
				"50%": { opacity: 0.85, transform: "translate(-50%, -50%) scale(1.12)" },
			},
			duration: "5.5s",
			easing: easings.standard,
			iterationCount: "infinite",
		}),
	);
}

/** Horizontal stream sweep suggesting Streamable HTTP traffic. */
function streamSweep(delay: string) {
	return motionSafe(
		animation(`uptime-mcp-stream-${delay.replace(".", "")}`, {
			keyframes: {
				"0%": { transform: "translateX(-30%)", opacity: 0 },
				"20%": { opacity: 0.7 },
				"80%": { opacity: 0.7 },
				"100%": { transform: "translateX(30%)", opacity: 0 },
			},
			duration: "7s",
			easing: easings.linear,
			delay,
			iterationCount: "infinite",
		}),
	);
}

/** Soft entrance for the hero copy stack. */
function heroRise() {
	return motionSafe(
		animation("uptime-mcp-rise", {
			keyframes: {
				from: { opacity: 0, transform: "translateY(14px)" },
				to: { opacity: 1, transform: "translateY(0)" },
			},
			duration: "700ms",
			easing: easings.decelerate,
			fillMode: "both",
		}),
	);
}

/** Live endpoint beacon beside the signal label. */
function beaconPulse() {
	return motionSafe(
		animation("uptime-mcp-beacon", {
			keyframes: {
				"0%, 100%": { opacity: 1, transform: "scale(1)" },
				"50%": { opacity: 0.35, transform: "scale(0.7)" },
			},
			duration: "2.2s",
			easing: easings.standard,
			iterationCount: "infinite",
		}),
	);
}

/**
 * Renders the `/mcp` landing: a brand-first hero with Streamable HTTP atmosphere,
 * then either the sell pitch or signed-in setup instructions with the remote config.
 */
export default function McpLandingView(handle: Handle<McpLandingView.Props>) {
	return () => {
		let {
			isSignedIn,
			brand,
			heroTitle,
			heroHighlight,
			heroDescription,
			heroCtaOut,
			heroCtaIn,
			signalLabel,
			endpoint,
			protocol,
			protocolBadge,
			protocolTitle,
			protocolDescription,
			toolsBadge,
			toolsTitle,
			toolsDescription,
			toolsApi,
			toolsScopes,
			toolsRemote,
			setupBadge,
			setupHeading,
			setupLead,
			setupSteps,
			scopesNote,
			configLabel,
			configJson,
			copyLabel,
			openKeysLabel,
			dashboardLabel,
			finalCtaTitle,
			finalCtaBody,
			finalCtaLabel,
			intl,
		} = handle.props;

		let toolPoints = [toolsApi, toolsScopes, toolsRemote];

		return (
			<>
				<section
					mix={[
						...sectionPadding(),
						relative(),
						overflow("hidden"),
						minBs("calc(100dvh - 4.5rem)"),
						flex(),
						items("center"),
						bg({
							image: linearGradient(
								"to bottom",
								"var(--ui-brand-bg-tint)",
								"var(--ui-neutral-bg-tint)",
							),
						}),
					]}
				>
					<div
						aria-hidden="true"
						mix={[
							absolute(),
							insBs("35%"),
							insIs("50%"),
							is("min(920px, 140vw)"),
							bs("min(920px, 140vw)"),
							translateX("-50%"),
							translateY("-50%"),
							pointerEvents("none"),
							bg({
								image: radialGradient(
									"circle closest-side",
									{ color: "var(--ui-brand-bg-tint)", position: "0%" },
									{ color: "transparent", position: "100%" },
								),
							}),
							pulseGlow(),
						]}
					/>

					{[
						{ top: "28%", delay: "0s" },
						{ top: "46%", delay: "1.8s" },
						{ top: "64%", delay: "3.4s" },
					].map((stream) => (
						<div
							key={stream.delay}
							aria-hidden="true"
							mix={[
								absolute(),
								insBs(stream.top),
								insIs(0),
								is("100%"),
								bs("1px"),
								pointerEvents("none"),
								opacity(40),
								bg({
									image: linearGradient(
										"to right",
										"transparent",
										"var(--ui-brand-border)",
										"transparent",
									),
								}),
								streamSweep(stream.delay),
							]}
						/>
					))}

					<div
						mix={[
							...marketingContainer(),
							relative(),
							z(1),
							vstack({ gap: 12, align: "center" }),
							textAlign("center"),
							pbs(10),
							heroRise(),
						]}
					>
						<div mix={[vstack({ gap: 5, align: "center" }), maxIs("720px")]}>
							<p
								mix={[
									m(0),
									fontSize("5xl"),
									weight(700),
									leading(1),
									tracking("tight"),
									fg("brand"),
									media("(min-width: 640px)", fontSize("6xl")),
									media("(min-width: 1024px)", fontSize("7xl")),
								]}
							>
								{brand}
							</p>
							<Heading
								level={1}
								mix={[
									m(0),
									fontSize("3xl"),
									weight(700),
									leading(1.15),
									tracking("tight"),
									media("(min-width: 640px)", fontSize("4xl")),
									media("(min-width: 1024px)", fontSize("5xl")),
								]}
							>
								{heroTitle} <span mix={[fg("brand")]}>{heroHighlight}</span>
							</Heading>
							<p mix={[m(0), maxIs("560px"), fontSize("lg"), leading(1.625), fg("neutral")]}>
								{heroDescription}
							</p>
							<div mix={[flex(), flexWrap("wrap"), gap(3), justify("center"), mbs(1)]}>
								{isSignedIn ? (
									<LinkButton href="#setup" color="brand" size="lg">
										{heroCtaIn}
										<ArrowRightIcon size={20} strokeWidth={1.5} />
									</LinkButton>
								) : (
									<AuthCta
										isSignedIn={false}
										startLabel={heroCtaOut}
										dashboardLabel={dashboardLabel}
										icon={<ArrowRightIcon size={20} strokeWidth={1.5} />}
									/>
								)}
							</div>
						</div>

						<div
							aria-hidden="true"
							mix={[
								relative(),
								is("full"),
								maxIs("840px"),
								minBs("11rem"),
								vstack({ gap: 4, align: "center", justify: "center" }),
								pi(4),
							]}
						>
							<div
								mix={[
									inlineFlex(),
									items("center"),
									gap(2),
									fontSize("xs"),
									weight(600),
									tracking("wide"),
									fg("brand"),
								]}
							>
								<span
									mix={[is(2), bs(2), rounded("50%"), bg("brand.solid"), shrink(0), beaconPulse()]}
								/>
								{signalLabel}
							</div>
							<p
								mix={[
									m(0),
									font("mono"),
									fontSize("lg"),
									weight(600),
									leading(1.3),
									tracking("tight"),
									fg("neutral.emphasis"),
									whiteSpace("pre-wrap"),
									textAlign("center"),
									media("(min-width: 640px)", fontSize("2xl")),
									media("(min-width: 1024px)", fontSize("3xl")),
								]}
							>
								{endpoint}
							</p>
							<p mix={[m(0), font("mono"), fontSize("sm"), fg("neutral"), opacity(80)]}>
								protocol {protocol}
							</p>
						</div>
					</div>
				</section>

				{isSignedIn ? (
					<section id="setup" mix={[...sectionPadding(), ...tintedSection()]}>
						<div mix={[...marketingContainer(), maxIs("820px"), mi("auto")]}>
							<SectionHeader badge={setupBadge} title={setupHeading} description={setupLead} />

							<ol
								mix={[
									m(0, 0, 8, 0),
									p(0),
									vstack({ gap: 3 }),
									listStyle("none"),
									fontSize("base"),
									leading("relaxed"),
									fg("neutral"),
								]}
							>
								{setupSteps.map((step, index) => (
									<li key={step} mix={[inlineFlex(), items("start"), gap(3)]}>
										<span
											mix={[
												inlineFlex(),
												items("center"),
												justify("center"),
												is(7),
												bs(7),
												shrink(0),
												rounded("50%"),
												bg("brand.solid"),
												fg("brand.onSolid"),
												fontSize("sm"),
												weight(700),
											]}
										>
											{index + 1}
										</span>
										<span mix={[mbs("0.35rem")]}>{step}</span>
									</li>
								))}
							</ol>

							<div mix={[vstack({ gap: 4 })]}>
								<Text mix={[m(0), fontSize("sm"), weight(600), fg("neutral.emphasis")]}>
									{configLabel}
								</Text>
								<pre
									mix={[
										m(0),
										p(5),
										rounded("xl"),
										bg("color.neutral.900"),
										dark(bg("color.neutral.950")),
										fg("color.neutral.100"),
										font("mono"),
										fontSize("xs"),
										leading("relaxed"),
										whiteSpace("pre"),
										overflow("auto"),
										bs("full"),
										border({ color: "brand", width: 1 }),
									]}
								>
									<code>{configJson}</code>
								</pre>
								<p mix={[m(0), fontSize("sm"), leading("relaxed"), fg("neutral")]}>{scopesNote}</p>
								<div mix={[flex(), flexWrap("wrap"), gap(3), items("center")]}>
									<IntlProvider intl={intl}>
										<CopyButton value={configJson} label={copyLabel} />
									</IntlProvider>
									<LinkButton href={routes.app.index.href()} color="brand">
										{openKeysLabel}
										<ArrowRightIcon size={18} strokeWidth={1.5} />
									</LinkButton>
								</div>
							</div>
						</div>
					</section>
				) : (
					<>
						<section mix={[...sectionPadding()]}>
							<div mix={[...marketingContainer()]}>
								<SectionHeader
									badge={protocolBadge}
									title={protocolTitle}
									description={protocolDescription}
								/>
							</div>
						</section>

						<section mix={[...sectionPadding(), ...tintedSection()]}>
							<div mix={[...marketingContainer()]}>
								<SectionHeader
									badge={toolsBadge}
									title={toolsTitle}
									description={toolsDescription}
								/>
								<ul
									mix={[m(0, "auto"), p(0), maxIs("720px"), vstack({ gap: 4 }), listStyle("none")]}
								>
									{toolPoints.map((point) => (
										<li
											key={point}
											mix={[
												inlineFlex(),
												items("start"),
												gap(3),
												fontSize("base"),
												leading("relaxed"),
												fg("neutral"),
											]}
										>
											<CheckIcon
												size={18}
												strokeWidth={2}
												mix={[fg("brand"), mbs("3px"), shrink(0)]}
											/>
											{point}
										</li>
									))}
								</ul>
							</div>
						</section>

						<section mix={[...sectionPadding()]}>
							<div mix={[...marketingContainer()]}>
								<div
									mix={[
										vstack({ gap: 6, align: "center" }),
										p(10),
										rounded("2xl"),
										bg("brand.solid"),
										textAlign("center"),
									]}
								>
									<Heading
										level={2}
										mix={[m(0), fontSize("3xl"), weight(700), fg("brand.onSolid")]}
									>
										{finalCtaTitle}
									</Heading>
									<p mix={[m(0), maxIs("540px"), fontSize("lg"), fg("brand.onSolid")]}>
										{finalCtaBody}
									</p>
									<AuthCta
										isSignedIn={false}
										startLabel={finalCtaLabel}
										dashboardLabel={dashboardLabel}
										color="neutral"
										icon={<ArrowRightIcon size={20} strokeWidth={1.5} />}
									/>
								</div>
							</div>
						</section>
					</>
				)}
			</>
		);
	};
}
