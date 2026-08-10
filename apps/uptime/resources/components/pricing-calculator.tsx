/**
 * Client island: the homepage's usage-based pricing calculator. One slider per
 * monitor sets that monitor's check frequency in minutes; the island sums the
 * resulting monthly pings across every monitor and prices them against the base
 * subscription, re-rendering on each drag. Monitors can be added and removed, so the
 * shape of the estimate — not just its numbers — is the visitor's to change.
 *
 * This needs JS: the whole point is a running total that responds to a drag, which
 * no server round trip and no CSS-only trick can produce. Server-side it renders the
 * same markup with the initial frequencies, so the panel is never blank and the
 * sliders still work as native `<input type="range">` controls before hydration —
 * only the totals stay at their initial values until the island's module lands.
 *
 * Its copy reads through `@pkg/i18n/ui`'s `intl(handle)` rather than arriving as a
 * dozen already-translated props, since the numbers themselves also need the active
 * language for `Intl.NumberFormat`. Server-side that resolves the `IntlProvider` its
 * caller wraps it in; client-side, the module-scoped instance `bootstrap/browser.ts`
 * registers with `setIntl()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { intl } from "@pkg/i18n/ui";
import { PlusIcon, XIcon } from "@pkg/lucide-remix";
import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, fg, linearGradient } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { counterIncrement, counterReset, listStyle, pseudoContent } from "@pkg/u/general";
import {
	absolute,
	flex,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	insBs,
	insIs,
	items,
	justify,
	relative,
	vstack,
} from "@pkg/u/layout";
import { dark, media } from "@pkg/u/responsive";
import { bs, is, m, mbs, p, pis } from "@pkg/u/size";
import { before } from "@pkg/u/state";
import { fontSize, tabularNums, weight } from "@pkg/u/typography";
import { Button, Card, Heading, HeadingScope, Label, Separator, Slider } from "@pkg/ui";
import { clientEntry, on } from "remix/ui";

import {
	BASE_PRICE_USD,
	INCLUDED_PINGS,
	monthlyCost,
	monthlyPings,
	PINGS_PER_BLOCK,
	PRICE_PER_BLOCK_USD,
} from "~/app/lib/pricing";

/** Slider bounds, in minutes: as often as every minute, as rarely as hourly. */
const MIN_FREQUENCY = 1;
const MAX_FREQUENCY = 60;

/** Frequency a newly added monitor starts at, in minutes. */
const DEFAULT_FREQUENCY = 10;

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type PricingCalculatorProps = {
	/** Check frequencies in minutes, one slider each, the calculator starts with. */
	initialFrequencies: number[];
};

/** One monitor row's state: a stable id for keyed re-renders plus its check frequency in minutes. */
interface CalculatorMonitor {
	id: string;
	frequency: number;
}

/** Monthly pings every monitor in `monitors` adds up to at its own frequency. */
function totalPingsPerMonth(monitors: CalculatorMonitor[]): number {
	return monitors.reduce(
		(total, monitor) => total + monthlyPings({ monitors: 1, intervalMinutes: monitor.frequency }),
		0,
	);
}

/** Renders one slider per monitor and the running monthly cost they add up to. */
export const PricingCalculator = clientEntry(
	"/resources/components/pricing-calculator.tsx#PricingCalculator",
	function PricingCalculator(handle: Handle<PricingCalculatorProps>) {
		let monitors: CalculatorMonitor[] = handle.props.initialFrequencies.map((frequency, index) => ({
			id: `${handle.id}-monitor-${index}`,
			frequency,
		}));

		/**
		 * Only ever increments, so a removed monitor's id is never handed to a
		 * later one — reusing an id would let keyed reconciliation match a fresh
		 * slider against the removed one's DOM node and carry its dragged value over.
		 */
		let nextMonitorIndex = monitors.length;

		function addMonitor() {
			monitors = monitors.concat({
				id: `${handle.id}-monitor-${nextMonitorIndex++}`,
				frequency: DEFAULT_FREQUENCY,
			});
			handle.update();
		}

		function removeMonitor(id: string) {
			monitors = monitors.filter((monitor) => monitor.id !== id);
			handle.update();
		}

		function setFrequency(id: string, frequency: number) {
			monitors = monitors.map((monitor) =>
				monitor.id === id ? { ...monitor, frequency } : monitor,
			);
			handle.update();
		}

		return () => {
			let i18n = intl(handle);
			let t = i18n.t;
			let language = i18n.language;

			let minutes = new Intl.NumberFormat(language, {
				style: "unit",
				unit: "minute",
				unitDisplay: "narrow",
				maximumFractionDigits: 0,
			});
			let count = new Intl.NumberFormat(language, { maximumFractionDigits: 0 });
			/**
			 * Every amount this panel can show is a whole dollar — the base price plus
			 * some number of whole blocks — so the cents stay off. The two digits are
			 * available rather than forbidden so that a price that *did* land on cents
			 * would render honestly instead of being silently rounded.
			 */
			let money = new Intl.NumberFormat(language, {
				style: "currency",
				currency: "USD",
				minimumFractionDigits: 0,
				maximumFractionDigits: 2,
			});

			let pingsPerMonth = totalPingsPerMonth(monitors);
			let { additionalPings, billedBlocks, additionalCostUsd, totalUsd } =
				monthlyCost(pingsPerMonth);

			/**
			 * The model's own figures, formatted for the visitor's locale, for the copy
			 * that quotes them. Every pricing string interpolates these rather than
			 * spelling the numbers out, so `app/lib/pricing.ts` stays the only place a
			 * price is stated — see that module's docblock.
			 */
			let pricingCopyValues = {
				price: money.format(BASE_PRICE_USD),
				included: count.format(INCLUDED_PINGS),
				blockPrice: money.format(PRICE_PER_BLOCK_USD),
				blockSize: count.format(PINGS_PER_BLOCK),
			};

			return (
				// `level={2}`: the calculator sits under the pricing section's own `<h2>`,
				// so its card title is an `<h3>` and the panels inside it `<h4>`.
				<HeadingScope level={2}>
					<Card>
						<Card.Header
							mix={[
								bg({
									image: linearGradient(
										"to right",
										"var(--ui-brand-bg-tint)",
										"var(--ui-brand-bg-tint-hover)",
									),
								}),
							]}
						>
							<div mix={[flex(), flexWrap("wrap"), items("baseline"), justify("between"), gap(4)]}>
								<div>
									<Card.Title mix={[fontSize("2xl")]}>
										{t("landing.pricing.calculator.title")}
									</Card.Title>
									<Card.Description mix={[fontSize("base"), opacity(100), fg("neutral")]}>
										{t("landing.pricing.calculator.description")}
									</Card.Description>
								</div>

								<Button
									type="button"
									color="brand"
									variant="outline"
									size="sm"
									mix={[on("click", addMonitor)]}
								>
									<PlusIcon size={16} strokeWidth={1.5} />
									{t("landing.pricing.calculator.add")}
								</Button>
							</div>
						</Card.Header>

						<Card.Content mix={[vstack({ gap: 6 }), mbs(6)]}>
							<ul
								mix={[
									grid(),
									gap(4),
									m(0),
									p(0),
									listStyle("none"),
									// Two columns only once there's a second monitor to put in one.
									monitors.length > 1 &&
										media("(min-width: 1024px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
								]}
							>
								{monitors.map((monitor) => (
									<li key={monitor.id}>
										<div
											mix={[
												p(4),
												rounded("lg"),
												border({ color: "neutral", width: 1 }),
												bg("color.neutral.100"),
												dark(bg("color.neutral.800")),
											]}
										>
											<Slider min={MIN_FREQUENCY} max={MAX_FREQUENCY} value={monitor.frequency}>
												<div mix={[flex(), items("center"), justify("between"), gap(2)]}>
													<Label htmlFor={monitor.id} mix={[fontSize("sm"), weight(500)]}>
														{t("landing.pricing.calculator.monitor.label")}
													</Label>
													{/* The last monitor can't be removed — an empty calculator
													has nothing to price. */}
													{monitors.length > 1 && (
														<Button
															type="button"
															color="danger"
															variant="ghost"
															size="sm"
															mix={[on("click", () => removeMonitor(monitor.id))]}
														>
															<XIcon size={16} strokeWidth={1.5} />
															<span mix={[visuallyHidden()]}>
																{t("landing.pricing.calculator.monitor.delete")}
															</span>
														</Button>
													)}
												</div>

												<Slider.Track>
													<Slider.Thumb
														id={monitor.id}
														mix={[
															on<HTMLInputElement, "input">("input", (event) => {
																setFrequency(monitor.id, event.currentTarget.valueAsNumber);
															}),
														]}
													/>
												</Slider.Track>

												<div mix={[flex(), items("center"), justify("between"), fontSize("sm")]}>
													<span mix={[fg("neutral.muted")]}>
														{t("landing.pricing.calculator.monitor.frequency.lower")}
													</span>
													<Slider.Output
														htmlFor={monitor.id}
														mix={[fg("brand"), weight(600), tabularNums()]}
													>
														{minutes.format(monitor.frequency)}
													</Slider.Output>
													<span mix={[fg("neutral.muted")]}>
														{t("landing.pricing.calculator.monitor.frequency.upper")}
													</span>
												</div>
											</Slider>
										</div>
									</li>
								))}
							</ul>

							<Separator />

							<div
								mix={[
									grid(),
									gap(6),
									media("(min-width: 1024px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
								]}
							>
								<dl
									mix={[
										vstack({ gap: 3 }),
										m(0),
										p(5),
										rounded("lg"),
										border({ color: "neutral", width: 1 }),
										bg("color.neutral.100"),
										dark(bg("color.neutral.800")),
									]}
								>
									<div mix={[flex(), items("center"), justify("between")]}>
										<dt mix={[fg("neutral")]}>
											{t("landing.pricing.calculator.stats.pingsPerMonth")}
										</dt>
										<dd
											mix={[
												m(0),
												fontSize("lg"),
												weight(700),
												tabularNums(),
												fg("neutral.emphasis"),
											]}
										>
											{count.format(pingsPerMonth)}
										</dd>
									</div>

									<Separator />

									<div mix={[vstack({ gap: 2 })]}>
										<div mix={[flex(), items("center"), justify("between")]}>
											<dt mix={[fg("neutral")]}>
												{t("landing.pricing.calculator.stats.baseSubscription")}
											</dt>
											<dd mix={[m(0), weight(600), tabularNums(), fg("neutral.emphasis")]}>
												{money.format(BASE_PRICE_USD)}
											</dd>
										</div>
										<p mix={[m(0), pis(4), fontSize("sm"), fg("neutral.muted")]}>
											{t("landing.pricing.calculator.stats.includes", {
												amount: count.format(INCLUDED_PINGS),
											})}
										</p>

										<div mix={[flex(), items("center"), justify("between")]}>
											<dt mix={[fg("neutral")]}>
												{t("landing.pricing.calculator.stats.additionalPings")}
											</dt>
											<dd mix={[m(0), weight(600), tabularNums(), fg("neutral.emphasis")]}>
												{money.format(additionalCostUsd)}
											</dd>
										</div>
										<p mix={[m(0), pis(4), fontSize("sm"), fg("neutral.muted")]}>
											{/* Shows the *blocks* billed, not the ping volume times a unit
											rate: blocks are indivisible, so a rate-shaped line would
											disagree with the charge beside it — 10,001 pings over is $2,
											not $1.01. */}
											{t("landing.pricing.calculator.stats.additionalPingsCost", {
												...pricingCopyValues,
												blocks: count.format(billedBlocks),
												pings: count.format(additionalPings),
											})}
										</p>
									</div>

									<Separator />

									<div
										mix={[
											flex(),
											items("center"),
											justify("between"),
											p(3),
											rounded("lg"),
											bg("brand.tint"),
										]}
									>
										<dt mix={[fontSize("lg"), weight(700), fg("neutral.emphasis")]}>
											{t("landing.pricing.calculator.stats.totalCost")}
										</dt>
										<dd mix={[m(0), fontSize("2xl"), weight(700), tabularNums(), fg("brand")]}>
											{money.format(totalUsd)}
										</dd>
									</div>
								</dl>

								<article
									mix={[
										vstack({ gap: 4 }),
										p(6),
										rounded("lg"),
										border({ color: "brand", width: 1 }),
										bg("brand.tint"),
									]}
								>
									<Heading level={3} mix={[m(0), fontSize("xl"), weight(600)]}>
										{t("landing.pricing.howItWorks.title")}
									</Heading>

									<ol
										mix={[
											vstack({ gap: 4 }),
											m(0),
											p(0),
											listStyle("none"),
											counterReset("pricing-step"),
										]}
									>
										{(["first", "second", "third"] as const).map((step) => (
											<li
												key={step}
												// Numbered by a CSS counter drawn in a brand-solid circle at
												// the item's inline-start edge — no client script involved.
												mix={[
													relative(),
													pis(10),
													counterIncrement("pricing-step"),
													before([
														pseudoContent("counter(pricing-step)"),
														absolute(),
														insIs(0),
														insBs(0),
														flex(),
														items("center"),
														justify("center"),
														is(7),
														bs(7),
														rounded("full"),
														bg("brand.solid"),
														fg("brand.onSolid"),
														fontSize("sm"),
														weight(700),
														tabularNums(),
													]),
												]}
											>
												<strong mix={[fg("brand.emphasis")]}>
													{t(`landing.pricing.howItWorks.list.${step}.title`, pricingCopyValues)}
												</strong>
												<p mix={[m(0), fontSize("sm"), fg("neutral")]}>
													{t(
														`landing.pricing.howItWorks.list.${step}.description`,
														pricingCopyValues,
													)}
												</p>
											</li>
										))}
									</ol>
								</article>
							</div>
						</Card.Content>
					</Card>
				</HeadingScope>
			);
		};
	},
);

export default PricingCalculator;
