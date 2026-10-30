/**
 * Covers {@link FeatureBand} layout variants: split, grid, steps, timeline, and stage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Feature } from "../components/feature.js";

import { FeatureBand } from "./feature-band.js";
import { StepList } from "./step-list.js";
import { TabbedStage } from "./tabbed-stage.js";

describe("FeatureBand", () => {
	test("renders a split layout with checks and media", async () => {
		let html = await renderToString(
			<FeatureBand
				layout="split"
				title="Observability"
				description="See every check."
				media={<div>Spec</div>}
			>
				<ul>
					<li>Edge probes</li>
				</ul>
			</FeatureBand>,
		);

		expect(html).toContain("Observability");
		expect(html).toContain("See every check.");
		expect(html).toContain("Edge probes");
		expect(html).toContain("Spec");
		expect(html).toContain('data-slot="split"');
		expect(html).toContain('data-checks="true"');
	});

	test("renders a feature grid", async () => {
		let html = await renderToString(
			<FeatureBand layout="grid" title="Capabilities" columns={2}>
				<Feature>
					<Feature.Title>Fast</Feature.Title>
				</Feature>
				<Feature>
					<Feature.Title>Reliable</Feature.Title>
				</Feature>
			</FeatureBand>,
		);

		expect(html).toContain("Capabilities");
		expect(html).toContain("Fast");
		expect(html).toContain('data-slot="feature-grid"');
	});

	test("renders numbered steps", async () => {
		let html = await renderToString(
			<FeatureBand layout="steps" title="How it works">
				<StepList.Item title="Connect">Point DNS.</StepList.Item>
				<StepList.Item title="Monitor">Watch checks.</StepList.Item>
			</FeatureBand>,
		);

		expect(html).toContain("How it works");
		expect(html).toContain("Connect");
		expect(html).toContain('data-slot="step-list"');
	});

	test("renders a timeline of steps", async () => {
		let html = await renderToString(
			<FeatureBand layout="timeline" title="One incident">
				<StepList.Item meta="14:02 UTC" title="Detected">
					Probes agree.
				</StepList.Item>
			</FeatureBand>,
		);

		expect(html).toContain('data-variant="timeline"');
		expect(html).toContain("14:02 UTC");
	});

	test("renders a vertical stage named after the band id", async () => {
		let html = await renderToString(
			<FeatureBand
				layout="stage"
				id="how"
				title="How it works"
				eyebrow="Workflow"
				eyebrowVariant="numbered"
				eyebrowIndex="02"
				eyebrowHref="/docs"
			>
				<TabbedStage.Item value="detect" label="Detect" defaultChecked>
					<p>Detect panel</p>
				</TabbedStage.Item>
				<TabbedStage.Item value="page" label="Page">
					<p>Page panel</p>
				</TabbedStage.Item>
			</FeatureBand>,
		);

		expect(html).toContain('data-orientation="vertical"');
		expect(html).toContain('name="how-stage"');
		expect(html).toContain('aria-label="How it works"');
		expect(html).toContain('href="/docs"');
		expect(html).toContain('data-slot="eyebrow-index"');
	});

	test("prefers an explicit stage name and label", async () => {
		let html = await renderToString(
			<FeatureBand layout="stage" title="How it works" stageName="flow" stageLabel="Alert flow">
				<TabbedStage.Item value="detect" label="Detect" defaultChecked>
					<p>Detect panel</p>
				</TabbedStage.Item>
			</FeatureBand>,
		);

		expect(html).toContain('name="flow"');
		expect(html).toContain('aria-label="Alert flow"');
	});
});
