---
title: Draw charts as PNG images
description: Draw a response-time chart with an area fill, a stroked line, labels and a daily status strip on a canvas inside a Worker, and serve it as a PNG an email client shows where SVG and scripts never run.
section:
    title: Content & feeds
    order: 8
order: 35
lastUpdated: 2026-10-25
outcomes:
    - "How to draw a response-time chart on a canvas inside a Worker with `@sdxc/raster`"
    - "How to fill the area, stroke the line and mark each day's status"
    - "How to serve the chart as a PNG for email and check its pixels in a test"
---

A weekly report email wants a chart, and email is where charts are hardest: most clients strip
inline SVG, none run scripts, and some block images from domains they do not trust until the
reader clicks. A PNG served from your own domain is the one format every client shows. This
guide draws a month of response times as a PNG inside a Worker, with nothing but TypeScript.

[`@sdxc/raster`](/api/raster) is a 2D canvas that encodes to PNG through
[`@sdxc/png`](/api/png) and sets text in a font read by [`@sdxc/font`](/api/font). None of them
use WebAssembly, so they run in a Worker.

```bash
npm add @sdxc/font @sdxc/http @sdxc/png @sdxc/raster @sdxc/result remix
```

## Plan the image

The chart is shown 600 pixels wide in the email and drawn at 1200 by 400, twice its display
size, so it stays sharp on a high-density screen. The data is one row per day: the 95th
percentile response time and the share of checks that succeeded.

```typescript {% title="app/services/reports/latency-chart.ts" %}
import type { Font } from "@sdxc/font";
import type { Raster } from "@sdxc/raster";

import { Canvas, color, linearGradient, Path, withAlpha } from "@sdxc/raster";

export interface Day {
	p95: number;
	uptime: number;
}

export const CHART_SIZE = { width: 1200, height: 400 } as const;

const PLOT = { left: 140, right: 1160, top: 80, bottom: 300 };
const STRIP = { top: 326, height: 28 };
const PAPER = color("#ffffff");
const INK = color("#18181b");
const MUTED = color("#71717a");
const RULE = color("#e4e4e7");
const ACCENT = color("oklch(0.55 0.2 275)");
const UP = color("#16a34a");
const DEGRADED = color("#f59e0b");
const DOWN = color("#dc2626");
```

`color` parses hex, `rgb()` and `oklch()`, so the chart can share your stylesheet's tokens.

## Draw the axes and labels

Scale each value into the plot, draw three rules with their labels, and set a title and the
latest value above it. `text` takes the font, the size, and `x` and `y` for the baseline:

```typescript {% title="app/services/reports/latency-chart.ts" %}
export async function latencyChart(days: Day[], font: Font): Promise<Uint8Array> {
	let canvas = new Canvas(CHART_SIZE.width, CHART_SIZE.height);
	canvas.fillRect(0, 0, CHART_SIZE.width, CHART_SIZE.height, PAPER);

	let highest = Math.max(0, ...days.map((day) => day.p95));
	let ceiling = Math.max(100, Math.ceil(highest / 100) * 100);
	let plotWidth = PLOT.right - PLOT.left;
	let x = (index: number) =>
		PLOT.left + (index / Math.max(1, days.length - 1)) * plotWidth;
	let y = (ms: number) => PLOT.bottom - (ms / ceiling) * (PLOT.bottom - PLOT.top);

	for (let value of [0, ceiling / 2, ceiling]) {
		canvas.fillRect(PLOT.left, y(value) - 1, plotWidth, 2, RULE);
		canvas.text(`${value} ms`, {
			font,
			size: 22,
			x: PLOT.left - 16,
			y: y(value) + 8,
			align: "end",
			paint: MUTED,
		});
	}

	canvas.text("p95 response time, last 30 days", {
		font,
		size: 26,
		x: PLOT.left,
		y: 44,
		paint: INK,
	});
	let latest = days.at(-1);
	if (latest) {
		canvas.text(`${Math.round(latest.p95)} ms today`, {
			font,
			size: 26,
			x: PLOT.right,
			y: 44,
			align: "end",
			paint: ACCENT,
		});
	}

	let points = days.map((day, index): Raster.Point => [x(index), y(day.p95)]);
	drawArea(canvas, points);
	strokeLine(canvas, points, 4, ACCENT);
	drawStrip(canvas, days);

	return canvas.toPNG();
}
```

`fillRect` covers fractional edges partially, so a rule two pixels tall at `y(value) - 1` is
crisp, and one at a half pixel would be a soft band.

## Fill the area under the line

The area `Path` runs from the plot's floor up to each point and back down, filled with a
gradient that fades to nothing at the floor:

```typescript {% title="app/services/reports/latency-chart.ts" %}
function drawArea(canvas: Canvas, points: Raster.Point[]) {
	let first = points[0];
	let last = points.at(-1);
	if (!first || !last) return;

	let area = new Path().moveTo(first[0], PLOT.bottom);
	for (let [px, py] of points) area.lineTo(px, py);
	area.lineTo(last[0], PLOT.bottom).close();

	canvas.fillPath(
		area,
		linearGradient({
			from: [0, PLOT.top],
			to: [0, PLOT.bottom],
			stops: [
				[0, withAlpha(ACCENT, 0.28)],
				[1, withAlpha(ACCENT, 0)],
			],
		}),
	);
}
```

## Stroke the line

The canvas fills shapes, so a line is one thin rectangle along each segment, plus a round dot at
every point so the joins have no notches:

```typescript {% title="app/services/reports/latency-chart.ts" %}
function strokeLine(
	canvas: Canvas,
	points: Raster.Point[],
	width: number,
	paint: Raster.Paint,
) {
	let half = width / 2;
	let segments = new Path();
	for (let index = 1; index < points.length; index++) {
		let from = points[index - 1];
		let to = points[index];
		if (!from || !to) continue;
		let length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
		let nx = (-(to[1] - from[1]) / length) * half;
		let ny = ((to[0] - from[0]) / length) * half;
		segments
			.moveTo(from[0] - nx, from[1] - ny)
			.lineTo(to[0] - nx, to[1] - ny)
			.lineTo(to[0] + nx, to[1] + ny)
			.lineTo(from[0] + nx, from[1] + ny)
			.close();
	}
	canvas.fillPath(segments, paint);

	for (let [px, py] of points) {
		canvas.fillPath(
			Path.roundedRect(px - half, py - half, width, width, half),
			paint,
		);
	}
}
```

A square `Path.roundedRect` with a radius of half its side is a circle. To draw the line
translucent, wrap the call in `canvas.layer({ opacity: 0.8 }, () => …)`, so the overlaps fade as
one shape instead of darkening.

## Mark each day's status

Under the plot, one rounded cell per day shows whether the checks held:

```typescript {% title="app/services/reports/latency-chart.ts" %}
function drawStrip(canvas: Canvas, days: Day[]) {
	let cell = (PLOT.right - PLOT.left) / Math.max(1, days.length);
	days.forEach((day, index) => {
		let paint = day.uptime >= 0.999 ? UP : day.uptime >= 0.99 ? DEGRADED : DOWN;
		let cellPath = Path.roundedRect(
			PLOT.left + index * cell + 2,
			STRIP.top,
			cell - 4,
			STRIP.height,
			6,
		);
		canvas.fillPath(cellPath, paint);
	});
}
```

## Serve it to the email

Load the font as [Draw social card images](/docs/building-remix-apps/social-card-images) shows,
and serve the chart from a route such as `/reports/:id/latency.png`. `Reports` is your own model
holding a sent report's days:

```typescript {% title="app/http/controllers/report-chart.ts" %}
import { internalServerError, notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Reports from "~/app/models/report";
import { chartFont } from "~/app/initializers/chart-font";
import { latencyChart } from "~/app/services/reports/latency-chart";
import routes from "~/routes/web";

export default createAction(routes.reportChart, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
	let report = await Reports.find(ctx.db, id);
	if (report === null) return notFound("Not Found");

	let font = chartFont();
	if (isFailure(font)) {
		ctx.log.fail(font.error, { report: id });
		return internalServerError("The chart font could not be read.");
	}

	let png = await latencyChart(report.days, font.data);
	return new Response(png.slice(), {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
});
```

A sent report's numbers never change, so the image is cacheable for a year.

> [!WARNING]
> Anyone holding the link can load the image, so put a report id in the URL that a stranger
> cannot guess.

In the email, give the image its display size and an `alt` that states the numbers, which is
what a reader sees while images are blocked:

```html
<img
	src="https://example.com/reports/0192f8a4/latency.png"
	width="600"
	height="200"
	alt="p95 response time over the last 30 days: 182 ms today, 99.95% uptime"
/>
```

## Check the pixels in a test

Decoding the PNG gives the pixels back as RGBA, so a test can check that a down day is drawn red:

```typescript {% title="app/services/reports/latency-chart.test.ts" %}
import { readFileSync } from "node:fs";

import { parseFont } from "@sdxc/font";
import { decode } from "@sdxc/png";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { latencyChart } from "~/app/services/reports/latency-chart";

test("a day under 99% uptime is drawn red in the strip", async () => {
	let font = unwrap(
		parseFont(
			readFileSync(
				new URL(
					"../../../resources/fonts/inter-regular.ttf.bin",
					import.meta.url,
				),
			),
		),
	);
	let days = Array.from({ length: 30 }, (_, index) => ({
		p95: 180,
		uptime: index === 0 ? 0.9 : 1,
	}));
	let image = unwrap(await decode(await latencyChart(days, font)));

	let offset = (340 * image.width + 150) * 4;
	expect([...image.data.subarray(offset, offset + 3)]).toEqual([220, 38, 38]);
});
```

## Where to go next

- [Draw social card images](/docs/building-remix-apps/social-card-images) — gradients, wrapped
  text and R2 storage for an image drawn once per page.
- [Send email](/docs/data-and-background-work/send-email) — the message the chart goes into.
- [`@sdxc/raster`](/api/raster) — `mask`, `layer` and every text option.
