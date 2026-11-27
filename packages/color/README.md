# @sdxc/color

Immutable CSS colors: parse every CSS color syntax, convert through OKLCH, gamut-map, mix, build scales and measure WCAG contrast.

## Installation

```sh
npm add @sdxc/color @sdxc/result
```

`Color.parse` and `ensureContrast` answer a [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) `Result`. The package has no other dependency and runs in Workers, browsers and Node.

## Usage

### Parse and print

`Color.parse` reads any CSS color, including what `getComputedStyle` returns, and never throws. `toString()` prints `rgb()` inside sRGB and `oklch()` outside it, so `${color}` is always valid CSS.

```typescript
import { Color } from "@sdxc/color";
import { isSuccess } from "@sdxc/result";

let result = Color.parse("oklch(0.62 0.19 260)");
if (isSuccess(result)) {
	let brand = result.data;
	brand.toString(); // "rgb(57.75 128.67 246.1)"
	brand.toString("hex"); // "#3a81f6"
}
```

### Adjust in OKLCH

Every operation answers a new `Color`. `darken(0.1)` is 10% darker in OKLCH lightness, keeping hue and chroma.

```typescript
let hover = brand.darken(0.1);
let muted = brand.desaturate(0.5).withAlpha(0.6);
let accent = brand.with({ hue: 30 });
```

### Check contrast

`contrast` paints a translucent foreground over the background (and a translucent background over white) before measuring with WCAG 2.1.

```typescript
let text = Color.rgb(0.47, 0.47, 0.47);
let page = Color.rgb(1, 1, 1);

text.contrast(page).ratio; // 4.42
text.contrast(page).aa.text; // false

let fixed = text.ensureContrast(page, 4.5); // Success: rgb(118.66 118.66 118.66)
page.contrastingText(); // black
```

### Mix and build scales

Interpolation follows CSS `color-mix()`: Oklab by default, premultiplied alpha, and a hue arc in OKLCH.

```typescript
let red = Color.rgb(1, 0, 0);
let blue = Color.rgb(0, 0, 1);

red.mix(blue); // rgb(140.36 83.03 162.31), as color-mix(in oklab, red, blue)
red.mix(blue, 0.25, { space: "oklch", hue: "longer" });

let heat = Color.scale([blue, Color.rgb(1, 1, 0), red]);
heat(0.5); // yellow
Color.steps([red, blue], 5); // 5 colors, both ends included
```

## API

### `Color`

A frozen value storing sRGB as unclamped floats (extended sRGB) plus alpha, so a wide-gamut color from `oklch()` or `color(display-p3 …)` survives losslessly. An authored hue on a gray and `none` components do not survive: a gray reads back with hue 0 and `none` reads as 0.

#### Creating

- `Color.parse(input)`: hex, named colors, `transparent`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and `color()` in `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `rec2020`, `prophoto-rgb` and `xyz`/`xyz-d50`/`xyz-d65`; a `ColorParseError` otherwise (including `currentcolor` and relative colors)
- `Color.rgb(r, g, b, alpha?)`: sRGB channels 0–1, unclamped
- `Color.hsl(h, s, l, alpha?)` and `Color.hwb(h, w, b, alpha?)`: hue in degrees, the rest 0–1
- `Color.oklab(l, a, b, alpha?)` and `Color.oklch(l, c, h, alpha?)`: lightness 0–1, hue in degrees

Alpha defaults to 1 and is clamped to 0–1; a non-finite number reads as 0.

#### Reading

- `toString(format?)`: `"hex"`, `"rgb"` and `"hsl"` gamut-map first; `"srgb"` (`color(srgb …)`), `"oklch"` and `"oklab"` are lossless
- `toRgb()`, `toHsl()`, `toOklab()`, `toOklch()`: plain objects with `alpha`; `toHsl()` is gamut-mapped
- `alpha`, `equals(other, epsilon = 1e-6)`, `inGamut()`
- `toGamut()`: CSS Color 4 gamut mapping, lowering OKLCH chroma until the color fits sRGB

#### Operations

- `over(background)`: source-over compositing in sRGB, as browsers paint
- `mix(other, amount = 0.5, { space, hue })`: `amount` is the share of `other`; `space` is `"oklab"` (default), `"oklch"` or `"srgb"`; `hue` is `"shorter"` (default), `"longer"`, `"increasing"` or `"decreasing"`
- `withAlpha(alpha)`, `fade(factor)`
- `lighten(n)`, `darken(n)`: OKLCH lightness × (1 ± n), clamped to 0–1
- `saturate(n)`, `desaturate(n)`: OKLCH chroma × (1 ± n)
- `rotate(degrees)`, `complement()`, `grayscale()`, `invert()`
- `with({ lightness, chroma, hue, alpha })`: exact OKLCH values

Operations do not gamut-map, so a result may leave sRGB; call `toGamut()` when it must fit.

#### Contrast

- `contrast(background, algorithm = "WCAG21")` and `Color.contrast(foreground, background)`: a `WcagContrast` with `ratio`, `aa.text` (4.5), `aa.largeText` (3), `aa.nonText` (3), `aaa.text` (7) and `aaa.largeText` (4.5). Both colors are gamut-mapped before measuring
- `ensureContrast(background, ratio)`: the closest color reaching `ratio` by changing only OKLCH lightness, or a `ContrastUnreachableError` whose `best` is the most contrasting lightness extreme
- `contrastingText()`: black or white, whichever contrasts more

#### Scales

- `Color.scale(colors, options?)`: a function from `t` in 0–1 to a color, evenly spaced across `colors`
- `Color.steps(colors, count, options?)`: `count` colors along that scale, both ends included

### Errors

- `ColorParseError`: `input` holds the rejected text
- `ContrastUnreachableError`: `target`, the best `ratio` reached and the `best` color

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/color": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
