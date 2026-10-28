/**
 * Covers composition craft primitives: frames, stages, checks, wells, and bento.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Heading } from "../components/heading.js";
import { LogoCloud } from "../components/logo-cloud.js";
import { StatStrip } from "../components/stat-strip.js";

import { AccentText } from "./accent-text.js";
import { AnnouncementChip } from "./announcement-chip.js";
import { Bento } from "./bento.js";
import { CheckList, CheckRow } from "./check-row.js";
import { CodeStage } from "./code-stage.js";
import { IconWell } from "./icon-well.js";
import { InstallTabs } from "./install-tabs.js";
import { ProductFrame } from "./product-frame.js";
import { ProofStrip } from "./proof-strip.js";
import { TabbedStage } from "./tabbed-stage.js";

describe("composition craft", () => {
	test("ProductFrame draws chrome around children", async () => {
		let html = await renderToString(
			<ProductFrame lights title="App" url="app.example.com">
				<div>Stage</div>
			</ProductFrame>,
		);

		expect(html).toContain('data-slot="product-frame"');
		expect(html).toContain("App");
		expect(html).toContain("app.example.com");
		expect(html).toContain("Stage");
		expect(html).toContain('aria-hidden="true"');
	});

	test("CodeStage renders a titled mono body", async () => {
		let html = await renderToString(<CodeStage title="install.sh">bun add @sdxc/ui</CodeStage>);

		expect(html).toContain('data-slot="code-stage"');
		expect(html).toContain("install.sh");
		expect(html).toContain("bun add @sdxc/ui");
	});

	test("CheckList lays checked rows", async () => {
		let html = await renderToString(
			<CheckList>
				<CheckRow>Edge probes</CheckRow>
			</CheckList>,
		);

		expect(html).toContain('data-slot="check-list"');
		expect(html).toContain('data-slot="check-row"');
		expect(html).toContain("Edge probes");
	});

	test("IconWell, AnnouncementChip, and AccentText render slots", async () => {
		let html = await renderToString(
			<div>
				<IconWell>★</IconWell>
				<AnnouncementChip>New</AnnouncementChip>
				<Heading size="display">
					Ship <AccentText>faster</AccentText>
				</Heading>
			</div>,
		);

		expect(html).toContain('data-slot="icon-well"');
		expect(html).toContain('data-slot="announcement-chip"');
		expect(html).toContain('data-slot="accent-text"');
		expect(html).toContain("faster");
	});

	test("Bento lays hairline cells", async () => {
		let html = await renderToString(
			<Bento columns={2}>
				<Bento.Cell>
					<Bento.Title>One</Bento.Title>
					<Bento.Body>Body</Bento.Body>
				</Bento.Cell>
				<Bento.Cell>
					<Bento.Title>Two</Bento.Title>
					<Bento.Body>Body</Bento.Body>
				</Bento.Cell>
			</Bento>,
		);

		expect(html).toContain('data-slot="bento"');
		expect(html).toContain("One");
		expect(html).toContain("Two");
	});

	test("InstallTabs and TabbedStage switch with radios", async () => {
		let install = await renderToString(
			<InstallTabs name="pkg" aria-label="Install">
				<InstallTabs.Option value="bun" label="bun" defaultChecked>
					bun add @sdxc/ui
				</InstallTabs.Option>
				<InstallTabs.Option value="npm" label="npm">
					npm add @sdxc/ui
				</InstallTabs.Option>
			</InstallTabs>,
		);

		expect(install).toContain('data-slot="install-tabs"');
		expect(install).toContain('type="radio"');
		expect(install).toContain("bun add @sdxc/ui");

		let stage = await renderToString(
			<TabbedStage name="demo" aria-label="Product views">
				<TabbedStage.Item value="inbox" label="Inbox" defaultChecked>
					Inbox shot
				</TabbedStage.Item>
				<TabbedStage.Item value="board" label="Board">
					Board shot
				</TabbedStage.Item>
			</TabbedStage>,
		);

		expect(stage).toContain('data-slot="tabbed-stage"');
		expect(stage).toContain("Inbox shot");
		expect(stage).toContain("Board shot");
	});

	test("ProofStrip wraps logo and stat children", async () => {
		let html = await renderToString(
			<ProofStrip>
				<LogoCloud muted>
					<span>Acme</span>
				</LogoCloud>
				<StatStrip>
					<StatStrip.Item label="Packages">80+</StatStrip.Item>
				</StatStrip>
			</ProofStrip>,
		);

		expect(html).toContain('data-spacing="compact"');
		expect(html).toContain("Acme");
		expect(html).toContain("80+");
	});
});
