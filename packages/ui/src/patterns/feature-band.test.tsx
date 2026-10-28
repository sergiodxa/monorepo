/**
 * Covers {@link FeatureBand} layout variants: split, grid, and steps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Feature } from "../components/feature.js";

import { FeatureBand } from "./feature-band.js";
import { StepList } from "./step-list.js";

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
});
