/**
 * Indic shaper tests against Noto fonts: syllables, base consonants, reph, matra and
 * pre-base reordering, joiners and dotted circles for every Indic script and Khmer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../../font.js";

import { parseFont } from "../../index.js";
import { shape } from "../index.js";

/** Fonts by fixture path, parsed once. */
const FONTS = new Map<string, Font>();

/**
 * A fixture font, parsed on first use.
 *
 * @param path - Path under `src/fixtures`.
 */
function font(path: string): Font {
	let cached = FONTS.get(path);
	if (cached !== undefined) return cached;
	let parsed = unwrap(parseFont(readFileSync(new URL(`../../fixtures/${path}`, import.meta.url))));
	FONTS.set(path, parsed);
	return parsed;
}

/**
 * A shaped run in compact notation, `glyph@xOffset,yOffset+xAdvance` with the offset only
 * when non-zero, glyphs joined by `|`.
 *
 * @param path - Fixture path under `NotoSans/`.
 * @param text - The run.
 */
function hb(path: string, text: string): string {
	return shape(font(`NotoSans/${path}`), text)
		.glyphs.map((glyph) => {
			let offset =
				glyph.xOffset !== 0 || glyph.yOffset !== 0 ? `@${glyph.xOffset},${glyph.yOffset}` : "";
			return `${glyph.glyph}${offset}+${glyph.xAdvance}`;
		})
		.join("|");
}

describe("shapes Kannada text", () => {
	test.each([
		["SHKNDA-1/1", "NotoSerifKannada-Regular.ttf", "ಲ್ಲಿ", "250+1550|126+0"],
		["SHKNDA-1/2", "NotoSerifKannada-Regular.ttf", "ಟ್ಸ್", "194+2092|130+96"],
		["SHKNDA-1/3", "NotoSerifKannada-Regular.ttf", "ಳಿ", "257+1441"],
		["SHKNDA-1/4", "NotoSerifKannada-Regular.ttf", "ಡಿ", "235+1565"],
		["SHKNDA-1/5", "NotoSerifKannada-Regular.ttf", "ಮೆ", "295+2196"],
		["SHKNDA-1/6", "NotoSerifKannada-Regular.ttf", "ರಿ", "249+1289"],
		["SHKNDA-1/7", "NotoSerifKannada-Regular.ttf", "ಖ್ಯೆ", "272+1733|124+164"],
		["SHKNDA-1/8", "NotoSerifKannada-Regular.ttf", "ಫ್ರಿ", "244+1505|125+170"],
		["SHKNDA-1/9", "NotoSerifKannada-Regular.ttf", "ನೆ", "290+1422"],
		["SHKNDA-1/10", "NotoSerifKannada-Regular.ttf", "ಗಿ", "225+1271"],
		["SHKNDA-1/11", "NotoSerifKannada-Regular.ttf", "ಷ್ಟಿ", "253+1528|109+141"],
		["SHKNDA-1/12", "NotoSerifKannada-Regular.ttf", "ಯಿಂ", "248+2564|73+1205"],
		["SHKNDA-1/13", "NotoSerifKannada-Regular.ttf", "ಚೀ", "228+1569|35+845"],
		["SHKNDA-1/14", "NotoSerifKannada-Regular.ttf", "ನಿ", "242+1389"],
		["SHKNDA-1/15", "NotoSerifKannada-Regular.ttf", "ಗ್ಲಿ", "225+1271|126+0"],
		["SHKNDA-1/16", "NotoSerifKannada-Regular.ttf", "ಷಿ", "253+1528"],
		["SHKNDA-1/17", "NotoSerifKannada-Regular.ttf", "ಗೆ", "273+1276"],
		["SHKNDA-1/18", "NotoSerifKannada-Regular.ttf", "ದ್ವಿ", "240+1516|127+57"],
		["SHKNDA-1/19", "NotoSerifKannada-Regular.ttf", "ತೀ", "238+1255|35+845"],
		["SHKNDA-1/20", "NotoSerifKannada-Regular.ttf", "ಮಿ", "247+2186"],
		["SHKNDA-1/21", "NotoSerifKannada-Regular.ttf", "ಲಿ", "250+1550"],
		["SHKNDA-1/22", "NotoSerifKannada-Regular.ttf", "ಗಿ", "225+1271"],
		["SHKNDA-1/23", "NotoSerifKannada-Regular.ttf", "ನ್", "203+1911"],
		["SHKNDA-1/24", "NotoSerifKannada-Regular.ttf", "ಬಿ", "245+1579"],
		["SHKNDA-1/25", "NotoSerifKannada-Regular.ttf", "ಲಿ", "250+1550"],
		["SHKNDA-1/26", "NotoSerifKannada-Regular.ttf", "ನ್ನಿಂ", "242+1389|118+158|73+1205"],
		["SHKNDA-1/27", "NotoSerifKannada-Regular.ttf", "ಲ್ಲಿ", "250+1550|126+0"],
		["SHKNDA-1/28", "NotoSerifKannada-Regular.ttf", "ಧಿ", "241+1516"],
		["SHKNDA-1/29", "NotoSerifKannada-Regular.ttf", "ಪೌ", "168+1514|34+773"],
		["SHKNDA-1/30", "NotoSerifKannada-Regular.ttf", "ವಿಂ", "251+1533|73+1205"],
		["SHKNDA-1/31", "NotoSerifKannada-Regular.ttf", "ಡಿ", "235+1565"],
		["SHKNDA-1/32", "NotoSerifKannada-Regular.ttf", "ಟಿ", "233+1621"],
		["SHKNDA-1/33", "NotoSerifKannada-Regular.ttf", "ನಿ", "242+1389"],
		["SHKNDA-1/34", "NotoSerifKannada-Regular.ttf", "ಧಿ", "241+1516"],
		["SHKNDA-2/1", "NotoSansKannada-Regular.ttf", "ನ್ನಾ", "150+1456|57+919|116+215"],
		["SHKNDA-2/2", "NotoSansKannada-Regular.ttf", "ನ್ನಾ", "150+1456|57+919|116+215"],
		["SHKNDA-2/3", "NotoSansKannada-Regular.ttf", "ತ್ತಾ", "146+1275|57+919|112+133"],
		["SHKNDA-2/4", "NotoSansKannada-Regular.ttf", "ಟ್ಟಾ", "141+1669|57+919|107+277"],
		["SHKNDA-2/5", "NotoSansKannada-Regular.ttf", "ಡೋಂಗಿ", "249+1573|61+1526|71+843|4+1127|207+1327"],
		[
			"SHKNDA-2/6",
			"NotoSansKannada-Regular.ttf",
			"ಜಿ಼ೕಬೆನ್",
			"211+1590|55@-254,0+0|71+843|259+1651|186+2096",
		],
		[
			"SHKNDA-2/7",
			"NotoSansKannada-Regular.ttf",
			"ಜಾ಼ಕಿರ್",
			"139+1590|57+919|55@-1173,0+0|205+1176|193+1974",
		],
		[
			"SHKNDA-2/8",
			"NotoSansKannada-Regular.ttf",
			"ಇನ್ಫ್ಲೆಕ್ಷನಲ್",
			"8+1457|256+1456|118+346|335+791|282+1176|39+1456|195+2234",
		],
		[
			"SHKNDA-2/9",
			"NotoSansKannada-Regular.ttf",
			"ಇನ್ಫ್ಲೆಕ್ಷನ್",
			"8+1457|256+1456|118+346|335+791|282+1176|186+2096",
		],
		["SHKNDA-2/10", "NotoSansKannada-Regular.ttf", "ದಟ್ಸ್", "37+1566|177+2150|130+245"],
		["SHKNDA-2/11", "NotoSansKannada-Regular.ttf", "ಎಕ್ಸ್", "14+1612|167+1656|130+245"],
		["SHKNDA-2/12", "NotoSansKannada-Regular.ttf", "ಮಾರ್ಚ್", "155+2367|57+919|172+2281|94+1161"],
		["SHKNDA-2/13", "NotoSansKannada-Regular.ttf", "ಟೆಕ್ಸ್ಟ್", "247+1669|167+1656|130+346|317+970"],
		["SHKNDA-2/14", "NotoSansKannada-Regular.ttf", "ಬುಕ್ಸ್", "42+1641|60+745|167+1656|130+245"],
		["SHKNDA-2/15", "NotoSansKannada-Regular.ttf", "ಸಾಫ್ಟ್", "163+1452|57+919|188+2101|107+277"],
		["SHKNDA-2/16", "NotoSansKannada-Regular.ttf", "ಜಸ್ಟ್", "27+1590|200+1932|107+277"],
		["SHKNDA-3/1", "NotoSansKannada-Regular.ttf", "ಕೋಂ", "239+1176|61+1526|71+843|4+1127"],
		["SHKNDA-3/2", "NotoSansKannada-Regular.ttf", "ಖೋಂ", "240+1772|61+1526|71+843|4+1127"],
		["SHKNDA-3/3", "NotoSansKannada-Regular.ttf", "ಗೋಂ", "241+1327|61+1526|71+843|4+1127"],
		["SHKNDA-3/4", "NotoSansKannada-Regular.ttf", "ಘೋಂ", "242+2041|279+1526|71+843|4+1127"],
		["SHKNDA-3/5", "NotoSansKannada-Regular.ttf", "ಙೋಂ", "24+1510|67+2009|71+843|4+1127"],
		["SHKNDA-3/6", "NotoSansKannada-Regular.ttf", "ಚೋಂ", "243+1628|61+1526|71+843|4+1127"],
		["SHKNDA-3/7", "NotoSansKannada-Regular.ttf", "ಛೋಂ", "244+1727|61+1526|71+843|4+1127"],
		["SHKNDA-3/8", "NotoSansKannada-Regular.ttf", "ಜೋಂ", "245+1590|61+1526|71+843|4+1127"],
		["SHKNDA-3/9", "NotoSansKannada-Regular.ttf", "ಝೋಂ", "246+2824|61+1526|71+843|4+1127"],
		["SHKNDA-3/10", "NotoSansKannada-Regular.ttf", "ಞೋಂ", "29+1982|67+2009|71+843|4+1127"],
		["SHKNDA-3/11", "NotoSansKannada-Regular.ttf", "ಟೋಂ", "247+1669|61+1526|71+843|4+1127"],
		["SHKNDA-3/12", "NotoSansKannada-Regular.ttf", "ಠೋಂ", "248+1334|61+1526|71+843|4+1127"],
		["SHKNDA-3/13", "NotoSansKannada-Regular.ttf", "ಡೋಂ", "249+1573|61+1526|71+843|4+1127"],
		["SHKNDA-3/14", "NotoSansKannada-Regular.ttf", "ಢೋಂ", "250+1573|61+1526|71+843|4+1127"],
		["SHKNDA-3/15", "NotoSansKannada-Regular.ttf", "ಣೋಂ", "251+1775|61+1526|71+843|4+1127"],
		["SHKNDA-3/16", "NotoSansKannada-Regular.ttf", "ತೋಂ", "252+1275|61+1526|71+843|4+1127"],
		["SHKNDA-3/17", "NotoSansKannada-Regular.ttf", "ಥೋಂ", "253+1566|61+1526|71+843|4+1127"],
		["SHKNDA-3/18", "NotoSansKannada-Regular.ttf", "ದೋಂ", "254+1566|61+1526|71+843|4+1127"],
		["SHKNDA-3/19", "NotoSansKannada-Regular.ttf", "ಧೋಂ ", "255+1566|61+1526|71+843|4+1127|3+590"],
		["SHKNDA-3/20", "NotoSansKannada-Regular.ttf", "ನೋಂ", "256+1456|61+1526|71+843|4+1127"],
		["SHKNDA-3/21", "NotoSansKannada-Regular.ttf", "ಪೋಂ", "257+1621|275+1316|71+843|4+1127"],
		["SHKNDA-3/22", "NotoSansKannada-Regular.ttf", "ಫೋಂ", "258+1621|277+1316|71+843|4+1127"],
		["SHKNDA-3/23", "NotoSansKannada-Regular.ttf", "ಬೋಂ", "259+1651|61+1526|71+843|4+1127"],
		["SHKNDA-3/24", "NotoSansKannada-Regular.ttf", "ಭೋಂ", "260+1651|61+1526|71+843|4+1127"],
		["SHKNDA-3/25", "NotoSansKannada-Regular.ttf", "ಮೋಂ", "280+3152|71+843|4+1127"],
		["SHKNDA-3/26", "NotoSansKannada-Regular.ttf", "ಯೋಂ", "281+3506|71+843|4+1127"],
		["SHKNDA-3/27", "NotoSansKannada-Regular.ttf", "ರೋಂ", "263+1334|61+1526|71+843|4+1127"],
		["SHKNDA-3/28", "NotoSansKannada-Regular.ttf", "ಱೋಂ", "47+1701|67+2009|71+843|4+1127"],
		["SHKNDA-3/29", "NotoSansKannada-Regular.ttf", "ಲೋಂ", "264+1574|61+1526|71+843|4+1127"],
		["SHKNDA-3/30", "NotoSansKannada-Regular.ttf", "ವೋಂ", "266+1626|275+1316|71+843|4+1127"],
		[
			"SHKNDA-3/31",
			"NotoSansKannada-Regular.ttf",
			"ಆ್ಯಕ್ಷಿಸ್\u{200C}",
			"7+1717|122+532|285+1176|200+2092|3+0",
		],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Telugu text", () => {
	test.each([
		["HB-TELU-1", "NotoSansTelugu-Regular.ttf", "కై", "326+1065"],
		["HB-TELU-2", "NotoSansTelugu-Regular.ttf", "క్", "102+1065"],
		["HB-TELU-3", "NotoSansTelugu-Regular.ttf", "క్కై", "326+1065|511+1079"],
		["HB-TELU-4", "NotoSansTelugu-Regular.ttf", "క్ర", "21+1065|549+0"],
		["HB-TELU-5", "NotoSansTelugu-Regular.ttf", "క్రి", "174+1065|549+0"],
		["HB-TELU-6", "NotoSansTelugu-Regular.ttf", "క్రై", "326+1065|496+860"],
		["HB-TELU-7", "NotoSansTelugu-Regular.ttf", "క్ర్", "102+1065|549+0"],
		["HB-TELU-8", "NotoSansTelugu-Regular.ttf", "క్ర్క", "21+1065|549+0|511+1079"],
		["HB-TELU-9", "NotoSansTelugu-Regular.ttf", "క్ష", "101+1065"],
		["HB-TELU-10", "NotoSansTelugu-Regular.ttf", "క్ష్", "137+1065"],
		["HB-TELU-11", "NotoSansTelugu-Regular.ttf", "క్ష్ణ", "21+1065|605+0"],
		["HB-TELU-12", "NotoSansTelugu-Regular.ttf", "ఽం", "56+1208|5+1038"],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Tamil text", () => {
	test.each([
		[
			"HB-TAML-1",
			"NotoSansTamil-Regular.ttf",
			"தமிழ்நாடு",
			"25+1689|29+1762|42+537|94+1762|26+1616|41+1311|112+2078",
		],
		["HB-TAML-2", "NotoSansTamil-Regular.ttf", "ஓர்", "16+2018|90+1311"],
		["HB-TAML-3", "NotoSansTamil-Regular.ttf", "இந்திய", "8+2306|85+1616|25+1689|149+537|30+1972"],
		[
			"HB-TAML-4",
			"NotoSansTamil-Regular.ttf",
			"மாநிலமாகும்.",
			"29+1762|41+1311|26+1616|149+537|33+2075|29+1762|41+1311|101+2175|88+1762|164+549",
		],
		[
			"HB-TAML-5",
			"NotoSansTamil-Regular.ttf",
			"தமிழ்நாடு,",
			"25+1689|29+1762|42+537|94+1762|26+1616|41+1311|112+2078|162+512",
		],
		[
			"HB-TAML-6",
			"NotoSansTamil-Regular.ttf",
			"தமிழகம்",
			"25+1689|29+1762|42+537|35+1762|18+1689|88+1762",
		],
		["HB-TAML-7", "NotoSansTamil-Regular.ttf", "என்றும்", "12+1640|86+2528|132+2329|88+1762"],
		[
			"HB-TAML-8",
			"NotoSansTamil-Regular.ttf",
			"பரவலாக",
			"28+1593|31+1311|36+2139|33+2075|41+1311|18+1689",
		],
		[
			"HB-TAML-9",
			"NotoSansTamil-Regular.ttf",
			"அழைக்கப்படுகிறது.",
			"6+2295|48+2384|35+1762|77+1689|18+1689|87+1593|28+1593|112+2078|18+1689|149+537|32+1792|116+2234|164+549",
		],
		[
			"HB-TAML-10",
			"NotoSansTamil-Regular.ttf",
			"ஆங்கிலத்தில்",
			"7+2690|78+2139|18+1689|149+537|33+2075|84+1689|25+1689|149+537|92+2075",
		],
		[
			"HB-TAML-11",
			"NotoSansTamil-Regular.ttf",
			"மெட்ராஸ்",
			"46+1846|29+1762|82+1419|31+1311|41+1311|98+2631",
		],
		["HB-TAML-12", "NotoSansTamil-Regular.ttf", "ஸ்டேட்", "98+2631|47+1491|23+1419|82+1419"],
		["HB-TAML-13", "NotoSansTamil-Regular.ttf", "என்றும்", "12+1640|86+2528|132+2329|88+1762"],
		[
			"HB-TAML-14",
			"NotoSansTamil-Regular.ttf",
			"தமிழில்",
			"25+1689|29+1762|42+537|35+1762|42+537|92+2075",
		],
		["HB-TAML-15", "NotoSansTamil-Regular.ttf", "சென்னை", "46+1846|20+1481|86+2528|48+2384|27+2528"],
		[
			"HB-TAML-16",
			"NotoSansTamil-Regular.ttf",
			"ராஜ்ஜியம்",
			"31+1311|41+1311|80+2094|21+2094|42+537|30+1972|88+1762",
		],
		["HB-TAML-17", "NotoSansTamil-Regular.ttf", "என்றும்", "12+1640|86+2528|132+2329|88+1762"],
		[
			"HB-TAML-18",
			"NotoSansTamil-Regular.ttf",
			"அழைக்கப்பெற்றது.",
			"6+2295|48+2384|35+1762|77+1689|18+1689|87+1593|46+1846|28+1593|91+1788|32+1792|116+2234|164+549",
		],
		["HB-TAML-19", "NotoSansTamil-Regular.ttf", "இதனை", "8+2306|25+1689|48+2384|27+2528"],
		[
			"HB-TAML-20",
			"NotoSansTamil-Regular.ttf",
			"தமிழ்நாடு",
			"25+1689|29+1762|42+537|94+1762|26+1616|41+1311|112+2078",
		],
		["HB-TAML-21", "NotoSansTamil-Regular.ttf", "என்று", "12+1640|86+2528|132+2329"],
		[
			"HB-TAML-22",
			"NotoSansTamil-Regular.ttf",
			"மாற்றக்கோரி",
			"29+1762|41+1311|91+1788|32+1792|77+1689|47+1491|18+1689|41+1311|31+1311|42+537",
		],
		[
			"HB-TAML-23",
			"NotoSansTamil-Regular.ttf",
			"போராட்டங்கள்",
			"47+1491|28+1593|41+1311|31+1311|41+1311|82+1419|23+1419|78+2139|18+1689|93+2192",
		],
		[
			"HB-TAML-24",
			"NotoSansTamil-Regular.ttf",
			"நடைபெற்றன.",
			"26+1616|48+2384|23+1419|46+1846|28+1593|91+1788|32+1792|27+2528|164+549",
		],
		[
			"HB-TAML-25",
			"NotoSansTamil-Regular.ttf",
			"சங்கரலிங்கனார்",
			"20+1481|78+2139|18+1689|31+1311|134+2603|78+2139|18+1689|27+2528|41+1311|90+1311",
		],
		["HB-TAML-26", "NotoSansTamil-Regular.ttf", "என்பவர்", "12+1640|86+2528|28+1593|36+2139|90+1311"],
		["HB-TAML-27", "NotoSansTamil-Regular.ttf", "நாட்கள்", "26+1616|41+1311|82+1419|18+1689|93+2192"],
		[
			"HB-TAML-28",
			"NotoSansTamil-Regular.ttf",
			"உண்ணாவிரதம்",
			"10+2185|83+3377|24+3377|41+1311|36+2139|148+537|31+1311|25+1689|88+1762",
		],
		["HB-TAML-29", "NotoSansTamil-Regular.ttf", "இருந்து", "8+2306|130+2153|85+1616|116+2234"],
		[
			"HB-TAML-30",
			"NotoSansTamil-Regular.ttf",
			"உயிர்துறந்தார்.",
			"10+2185|30+1972|148+537|90+1311|116+2234|32+1792|85+1616|25+1689|41+1311|90+1311|164+549",
		],
		["HB-TAML-31", "NotoSansTamil-Regular.ttf", "பின்னர்", "28+1593|148+537|86+2528|27+2528|90+1311"],
		[
			"HB-TAML-32",
			"NotoSansTamil-Regular.ttf",
			"மதராசு",
			"29+1762|25+1689|31+1311|41+1311|106+1776",
		],
		["HB-TAML-33", "NotoSansTamil-Regular.ttf", "ஸ்டேட்", "98+2631|47+1491|23+1419|82+1419"],
		["HB-TAML-34", "NotoSansTamil-Regular.ttf", "என்று", "12+1640|86+2528|132+2329"],
		["HB-TAML-35", "NotoSansTamil-Regular.ttf", "இருந்த", "8+2306|130+2153|85+1616|25+1689"],
		["HB-TAML-36", "NotoSansTamil-Regular.ttf", "பெயர்", "46+1846|28+1593|30+1972|90+1311"],
		["HB-TAML-37", "NotoSansTamil-Regular.ttf", "ஆம்", "7+2690|88+1762"],
		["HB-TAML-38", "NotoSansTamil-Regular.ttf", "ஆண்டு", "7+2690|83+3377|112+2078"],
		[
			"HB-TAML-39",
			"NotoSansTamil-Regular.ttf",
			"தமிழ்நாடு",
			"25+1689|29+1762|42+537|94+1762|26+1616|41+1311|112+2078",
		],
		["HB-TAML-40", "NotoSansTamil-Regular.ttf", "என்று", "12+1640|86+2528|132+2329"],
		[
			"HB-TAML-41",
			"NotoSansTamil-Regular.ttf",
			"மாற்றப்பட்டது.",
			"29+1762|41+1311|91+1788|32+1792|87+1593|28+1593|82+1419|23+1419|116+2234|164+549",
		],
		["HB-TAML-42", "NotoSansTamil-Regular.ttf", "ஸ்ரீ", "147+3100"],
		["HB-TAML-43", "NotoSansTamil-Regular.ttf", "க்ஷ", "76+3795"],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Devanagari text / joiners", () => {
	test.each([
		["HB-DEVA-joiners-1", "NotoSansDevanagari-Regular.ttf", "र्ह", "61+1088|181+0"],
		[
			"HB-DEVA-joiners-2",
			"NotoSansDevanagari-Regular.ttf",
			"र्\u{200C}ह",
			"52+838|81@-48,0+0|3+0|61+1088",
		],
		["HB-DEVA-joiners-3", "NotoSansDevanagari-Regular.ttf", "र्\u{200D}ह", "209+818|61+1088"],
		["HB-DEVA-joiners-4", "NotoSansDevanagari-Regular.ttf", "ऱ्ह", "209+818|61+1088"],
		[
			"HB-DEVA-joiners-5",
			"NotoSansDevanagari-Regular.ttf",
			"ऱ्\u{200C}ह",
			"53+838|81@-48,0+0|3+0|61+1088",
		],
		["HB-DEVA-joiners-6", "NotoSansDevanagari-Regular.ttf", "ऱ्\u{200D}ह", "209+818|3+0|61+1088"],
		["HB-DEVA-joiners-7", "NotoSansDevanagari-Regular.ttf", "क्क", "183+1104|25+1561"],
		["HB-DEVA-joiners-8", "NotoSansDevanagari-Regular.ttf", "क्\u{200D}", "183+1204|3+0"],
		[
			"HB-DEVA-joiners-9",
			"NotoSansDevanagari-Regular.ttf",
			"क्\u{200C}क",
			"25+1561|81@-454,0+0|3+0|25+1561",
		],
		["HB-DEVA-joiners-10", "NotoSansDevanagari-Regular.ttf", "क्\u{200D}क", "183+1104|3+0|25+1561"],
		["HB-DEVA-joiners-11", "NotoSansDevanagari-Regular.ttf", "क्कि", "558+530|183+1104|25+1561"],
		[
			"HB-DEVA-joiners-12",
			"NotoSansDevanagari-Regular.ttf",
			"क्\u{200C}कि",
			"25+1561|81@-454,0+0|3+0|561+530|25+1561",
		],
		[
			"HB-DEVA-joiners-13",
			"NotoSansDevanagari-Regular.ttf",
			"क्\u{200D}कि",
			"558+530|183+1104|3+0|25+1561",
		],
		["HB-DEVA-joiners-14", "NotoSansDevanagari-Regular.ttf", "क्ष", "179+1458"],
		[
			"HB-DEVA-joiners-15",
			"NotoSansDevanagari-Regular.ttf",
			"क्\u{200C}ष",
			"25+1561|81@-454,0+0|3+0|59+1184",
		],
		["HB-DEVA-joiners-16", "NotoSansDevanagari-Regular.ttf", "क्\u{200D}ष", "183+1204|3+0|59+1184"],
		[
			"HB-DEVA-joiners-17",
			"NotoSansDevanagari-Regular.ttf",
			"द्सि",
			"42+1064|81@96,0+0|563+530|60+1375",
		],
		[
			"HB-DEVA-joiners-18",
			"NotoSansDevanagari-Regular.ttf",
			"द्\u{200C}सि",
			"42+1064|81@96,0+0|3+0|563+530|60+1375",
		],
		[
			"HB-DEVA-joiners-19",
			"NotoSansDevanagari-Regular.ttf",
			"द्\u{200D}सि",
			"558+530|200+1064|60+1375",
		],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Devanagari text / misc", () => {
	test.each([
		["HB-DEVA-misc-1", "NotoSansDevanagari-Regular.ttf", "क", "25+1561"],
		["HB-DEVA-misc-2", "NotoSansDevanagari-Regular.ttf", "क़", "92+1561"],
		["HB-DEVA-misc-3", "NotoSansDevanagari-Regular.ttf", "कि", "561+530|25+1561"],
		["HB-DEVA-misc-4", "NotoSansDevanagari-Regular.ttf", "क्", "25+1561|81@-454,0+0"],
		["HB-DEVA-misc-5", "NotoSansDevanagari-Regular.ttf", "क्क", "183+1104|25+1561"],
		["HB-DEVA-misc-6", "NotoSansDevanagari-Regular.ttf", "क्र", "254+1561"],
		["HB-DEVA-misc-7", "NotoSansDevanagari-Regular.ttf", "क्र्क", "327+1204|25+1561"],
		["HB-DEVA-misc-8", "NotoSansDevanagari-Regular.ttf", "क्र्\u{200D}", "327+1204|3+0"],
		["HB-DEVA-misc-9", "NotoSansDevanagari-Regular.ttf", "क्ष", "179+1458"],
		["HB-DEVA-misc-10", "NotoSansDevanagari-Regular.ttf", "क्ष्", "179+1458|81+0"],
		[
			"HB-DEVA-misc-11",
			"NotoSansDevanagari-Regular.ttf",
			"क्\u{200C}ष",
			"25+1561|81@-454,0+0|3+0|59+1184",
		],
		["HB-DEVA-misc-12", "NotoSansDevanagari-Regular.ttf", "क्\u{200D}", "183+1204|3+0"],
		["HB-DEVA-misc-13", "NotoSansDevanagari-Regular.ttf", "क्\u{200D}ष", "183+1204|3+0|59+1184"],
		["HB-DEVA-misc-14", "NotoSansDevanagari-Regular.ttf", "छ्र्क", "334+1435|25+1561"],
		["HB-DEVA-misc-15", "NotoSansDevanagari-Regular.ttf", "ज्ञ्", "180+1313|81+0"],
		["HB-DEVA-misc-16", "NotoSansDevanagari-Regular.ttf", "ट्रु", "35+1032|657@-10,0+0"],
		["HB-DEVA-misc-17", "NotoSansDevanagari-Regular.ttf", "र्क", "25+1561|181@-454,0+0"],
		["HB-DEVA-misc-18", "NotoSansDevanagari-Regular.ttf", "र्कि", "585+530|25+1561|606+0"],
		["HB-DEVA-misc-19", "NotoSansDevanagari-Regular.ttf", "र्क्रि", "585+530|254+1561|606+0"],
		["HB-DEVA-misc-20", "NotoSansDevanagari-Regular.ttf", "र्\u{200D}", "209+818"],
		["HB-DEVA-misc-21", "NotoSansDevanagari-Regular.ttf", "ि", "67+530|135+1044"],
		["HB-DEVA-misc-22", "NotoSansDevanagari-Regular.ttf", "फ़्र", "314+1579"],
		["HB-DEVA-misc-23", "NotoSansDevanagari-Regular.ttf", "फ्र", "275+1579"],
		["HB-DEVA-misc-24", "NotoSansDevanagari-Regular.ttf", "द्दि", "560+530|511+1105"],
		["HB-DEVA-misc-25", "NotoSansDevanagari-Regular.ttf", "क्ष", "179+1458"],
		[
			"HB-DEVA-misc-26",
			"NotoSansDevanagari-Regular.ttf",
			"क्\u{200C}ष",
			"25+1561|81@-454,0+0|3+0|59+1184",
		],
		["HB-DEVA-misc-27", "NotoSansDevanagari-Regular.ttf", "क्\u{200D}ष", "183+1204|3+0|59+1184"],
		["HB-DEVA-misc-28", "NotoSansDevanagari-Regular.ttf", "र्अ्", "9+1565|81+0|181+0"],
		["HB-DEVA-misc-29", "NotoSansDevanagari-Regular.ttf", "र्अ्\u{200C}", "9+1565|81+0|3+0|181+0"],
		[
			"HB-DEVA-misc-30",
			"NotoSansDevanagari-Regular.ttf",
			"र्अ्\u{200D}",
			"52+838|81@-48,0+0|9+1565|81+0|3+0",
		],
		[
			"HB-DEVA-misc-31",
			"NotoSansDevanagari-Regular.ttf",
			"र्आ्र्",
			"10+2095|81+0|181+0|52+838|81@-48,0+0",
		],
		["HB-DEVA-misc-32", "NotoSansDevanagari-Regular.ttf", "क\u{200C}ि", "561+530|25+1561|3+0"],
		["HB-DEVA-misc-33", "NotoSansDevanagari-Regular.ttf", "ऽं", "65+957|6+0"],
		["HB-DEVA-misc-34", "NotoSansDevanagari-Regular.ttf", "रुँः", "413+1152|5@-314,0+0|7+558"],
		["HB-DEVA-misc-35", "NotoSansDevanagari-Regular.ttf", "1ि", "558+530|748+1128"],
		["HB-DEVA-misc-36", "NotoSansDevanagari-Regular.ttf", "१॑", "107+1128|85@-298,0+0"],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Devanagari text / dotted circle", () => {
	test.each([
		["HB-DEVA-dottedcircle-1", "NotoSansDevanagari-Regular.ttf", "र्◌", "135+1044|181+0"],
		[
			"HB-DEVA-dottedcircle-2",
			"NotoSansDevanagari-Regular.ttf",
			"र्◌्च",
			"135+1044|81+0|181+0|30+1299",
		],
		[
			"HB-DEVA-dottedcircle-3",
			"NotoSansDevanagari-Regular.ttf",
			"र्◌्च्छे",
			"135+1044|81+0|181+0|188+810|31+1435|75@-156,0+0",
		],
		["HB-DEVA-dottedcircle-4", "NotoSansDevanagari-Regular.ttf", "र्◌ि", "67+530|135+1044|181+0"],
		["HB-DEVA-dottedcircle-5", "NotoSansDevanagari-Regular.ttf", "र्◌्", "135+1044|81+0|181+0"],
		["HB-DEVA-dottedcircle-6", "NotoSansDevanagari-Regular.ttf", "र्◌़", "135+1044|64+0|181+0"],
		[
			"HB-DEVA-dottedcircle-7",
			"NotoSansDevanagari-Regular.ttf",
			"◌्च्छे",
			"135+1044|81+0|188+810|31+1435|75@-156,0+0",
		],
		[
			"HB-DEVA-dottedcircle-8",
			"NotoSansDevanagari-Regular.ttf",
			"र्\u{A0}",
			"52+838|81@-48,0+0|3+532",
		],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Devanagari text / eyelash", () => {
	test.each([
		["HB-DEVA-eyelash-1", "NotoSansDevanagari-Regular.ttf", "त्र्क", "347+782|25+1561"],
		["HB-DEVA-eyelash-2", "NotoSansDevanagari-Regular.ttf", "त्र्\u{200D}क", "347+782|3+0|25+1561"],
		[
			"HB-DEVA-eyelash-3",
			"NotoSansDevanagari-Regular.ttf",
			"त्र्\u{200C}क",
			"269+1130|81+0|3+0|25+1561",
		],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Bengali text", () => {
	test.each([
		["HB-BENG-1", "NotoSansBengali-Regular.ttf", "অ্য", "7+1828|198+523"],
		["HB-BENG-2", "NotoSansBengali-Regular.ttf", "ক", "19+1653"],
		["HB-BENG-3", "NotoSansBengali-Regular.ttf", "ক়", "96+1653"],
		["HB-BENG-4", "NotoSansBengali-Regular.ttf", "কি", "54+545|19+1653"],
		["HB-BENG-5", "NotoSansBengali-Regular.ttf", "ক্", "19+1653|64@-453,0+0"],
		["HB-BENG-6", "NotoSansBengali-Regular.ttf", "ক্ক", "280+1575"],
		["HB-BENG-7", "NotoSansBengali-Regular.ttf", "ক্র", "199+1905"],
		["HB-BENG-8", "NotoSansBengali-Regular.ttf", "ক্র্ক", "199+1905|64@-436,0+0|19+1653"],
		["HB-BENG-9", "NotoSansBengali-Regular.ttf", "ক্\u{200C}ক", "19+1653|64@-453,0+0|3+0|19+1653"],
		["HB-BENG-10", "NotoSansBengali-Regular.ttf", "ক্\u{200D}ক", "130+1397|3+0|19+1653"],
		["HB-BENG-11", "NotoSansBengali-Regular.ttf", "দ্য", "36+1235|198+523"],
		["HB-BENG-12", "NotoSansBengali-Regular.ttf", "ন্ক", "149+756|19+1653"],
		["HB-BENG-13", "NotoSansBengali-Regular.ttf", "ন্ধ", "360+1586"],
		["HB-BENG-14", "NotoSansBengali-Regular.ttf", "ন্ব", "260+1253"],
		["HB-BENG-15", "NotoSansBengali-Regular.ttf", "ন্য", "38+1236|198+523"],
		["HB-BENG-16", "NotoSansBengali-Regular.ttf", "ন্র", "219+1357"],
		["HB-BENG-17", "NotoSansBengali-Regular.ttf", "ন্\u{200C}ক", "38+1236|64+0|3+0|19+1653"],
		["HB-BENG-18", "NotoSansBengali-Regular.ttf", "ন্\u{200C}ধ", "38+1236|64+0|3+0|37+1221"],
		["HB-BENG-19", "NotoSansBengali-Regular.ttf", "ন্\u{200C}ব", "38+1236|64+0|3+0|41+1221"],
		["HB-BENG-20", "NotoSansBengali-Regular.ttf", "ন্\u{200C}র", "38+1236|64+0|3+0|45+1221"],
		["HB-BENG-21", "NotoSansBengali-Regular.ttf", "ন্\u{200D}ক", "149+756|3+0|19+1653"],
		["HB-BENG-22", "NotoSansBengali-Regular.ttf", "ন্\u{200D}ধ", "149+756|3+0|37+1221"],
		["HB-BENG-23", "NotoSansBengali-Regular.ttf", "ন্\u{200D}ব", "149+756|3+0|41+1221"],
		["HB-BENG-24", "NotoSansBengali-Regular.ttf", "ন্\u{200D}র", "149+756|3+0|45+1221"],
		["HB-BENG-25", "NotoSansBengali-Regular.ttf", "য্", "44+1282|64+0"],
		["HB-BENG-26", "NotoSansBengali-Regular.ttf", "র্ক", "19+1653|127@-453,0+0"],
		["HB-BENG-27", "NotoSansBengali-Regular.ttf", "র্কি", "54+545|19+1653|127@-453,0+0"],
		["HB-BENG-28", "NotoSansBengali-Regular.ttf", "র্কৌ", "446+708|19+1653|127@-453,0+0|66+545"],
		["HB-BENG-29", "NotoSansBengali-Regular.ttf", "র্ন্\u{200D}", "45+1221|64+0|38+1236|64+0|3+0"],
		["HB-BENG-30", "NotoSansBengali-Regular.ttf", "র্ব্ব", "263+2001|127+0"],
		["HB-BENG-31", "NotoSansBengali-Regular.ttf", "শ্য", "47+1386|198+523"],
		["HB-BENG-32", "NotoSansBengali-Regular.ttf", "ষ্য", "48+1296|198+523"],
		["HB-BENG-33", "NotoSansBengali-Regular.ttf", "স্য", "49+1397|198+523"],
		["HB-BENG-34", "NotoSansBengali-Regular.ttf", "ি", "54+545|575+1044"],
		["HB-BENG-35", "NotoSansBengali-Regular.ttf", "কো", "446+708|19+1653|53+545"],
		["HB-BENG-36", "NotoSansBengali-Regular.ttf", "কৌ", "446+708|19+1653|66+545"],
		["HB-BENG-37", "NotoSansBengali-Regular.ttf", "ক্র্ক", "199+1905|64@-436,0+0|19+1653"],
		["HB-BENG-38", "NotoSansBengali-Regular.ttf", "ন্\u{200C}ক", "38+1236|64+0|3+0|19+1653"],
		["HB-BENG-39", "NotoSansBengali-Regular.ttf", "ন্\u{200C}ব", "38+1236|64+0|3+0|41+1221"],
		["HB-BENG-40", "NotoSansBengali-Regular.ttf", "ন্\u{200D}ক", "149+756|3+0|19+1653"],
		["HB-BENG-41", "NotoSansBengali-Regular.ttf", "ন্\u{200D}ব", "149+756|3+0|41+1221"],
		["HB-BENG-42", "NotoSansBengali-Regular.ttf", "ন্\u{200D}র", "149+756|3+0|45+1221"],
		["HB-BENG-43", "NotoSansBengali-Regular.ttf", "র্কাং", "19+1653|127@-453,0+0|53+545|5+938"],
		["HB-BENG-44", "NotoSansBengali-Regular.ttf", "র্কাঃ", "19+1653|127@-453,0+0|53+545|6+938"],
		["HB-BENG-45", "NotoSansBengali-Regular.ttf", "র্কৌ", "446+708|19+1653|127@-453,0+0|66+545"],
		["HB-BENG-46", "NotoSansBengali-Regular.ttf", "র্ভ", "42+1476|127@-339,0+0"],
		["HB-BENG-47", "NotoSansBengali-Regular.ttf", "ৰ্ভ", "42+1476|127@-339,0+0"],
		["HB-BENG-48", "NotoSansBengali-Regular.ttf", "ৱ্ভ", "85+1221|64+0|42+1476"],
		["HB-BENG-49", "NotoSansBengali-Regular.ttf", "অৗ", "7+1828|66+545"],
		["HB-BENG-50", "NotoSansBengali-Regular.ttf", "ন্ত্র", "365+1403"],
		["HB-BENG-51", "NotoSansBengali-Regular.ttf", "ত্যু", "34+1447|518@-222,0+0|198+523"],
		["HB-BENG-52", "NotoSansBengali-Regular.ttf", "চ্য্র", "135+1014|225+1408"],
		["HB-BENG-53", "NotoSansBengali-Regular.ttf", "ক্\u{200D}ষ", "130+1397|3+0|48+1296"],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Gurmukhi text", () => {
	test.each([
		["HB-GURU-1", "NotoSansGurmukhi-Regular.ttf", "ਕ੍ਹ", "17+1273|111@75,0+0"],
		["HB-GURU-2", "NotoSansGurmukhi-Regular.ttf", "ਤ੍ਯੋ", "32+1110|175+1363|58+0"],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Gujarati text", () => {
	test.each([
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ગ્ષ", "132+839|52+1183"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ગ્સ", "132+839|53+1457"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ગ્હ", "132+839|54+1296"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ક", "133+899|21+1047"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ખ", "133+899|22+1528"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ગ", "133+899|23+1339"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ઘ", "133+729|24+1271"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ઙ", "133+899|25+1004"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ચ", "133+899|26+1353"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્છ", "133+899|27+1512"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્જ", "133+899|28+1786"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ઝ", "133+899|29+1430"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ઞ", "133+899|30+1417"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ટ", "133+899|31+923"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ઠ", "133+899|32+1059"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ડ", "133+899|33+986"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ઢ", "133+899|34+1056"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ણ", "133+899|35+1683"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્ત", "133+899|36+1173"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્થ", "133+899|37+1280"],
		["HB-GURU-1", "NotoSansGujarati-Regular.ttf", "ઘ્દ", "133+899|38+956"],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Malayalam text", () => {
	test.each([
		["HB-MLYM-1", "NotoSansMalayalam-Regular.ttf", "അൎത്ഥം", "6+3058|180+3448|73@-2606,0+0|4+927"],
		[
			"HB-MLYM-2",
			"NotoSansMalayalam-Regular.ttf",
			"അഥൎവ്വം",
			"6+3058|36+1835|208+1963|73@-1864,0+0|4+927",
		],
		["HB-MLYM-3", "NotoSansMalayalam-Regular.ttf", "ക്\u{200D}", "101+2470"],
		[
			"HB-MLYM-4",
			"NotoSansMalayalam-Regular.ttf",
			"കായ്\u{200C}കറി",
			"20+2125|59+1033|46+2120|72+0|3+0|20+2125|48+1381|60+467",
		],
		[
			"HB-MLYM-5",
			"NotoSansMalayalam-Regular.ttf",
			"കാര്\u{200D}ക്കോടകന്\u{200D}",
			"20+2125|59+1033|98+1507|67+1219|147+3085|59+1033|30+1152|20+2125|97+2173",
		],
		[
			"HB-MLYM-6",
			"NotoSansMalayalam-Regular.ttf",
			"കുറ്റ്യാടി",
			"20+2125|62+679|203+1271|229+697|59+1033|30+1152|60+467",
		],
		["HB-MLYM-7", "NotoSansMalayalam-Regular.ttf", "കെ", "66+1465|20+2125"],
		["HB-MLYM-8", "NotoSansMalayalam-Regular.ttf", "കേ", "67+1219|20+2125"],
		["HB-MLYM-9", "NotoSansMalayalam-Regular.ttf", "കൈ", "68+2935|20+2125"],
		["HB-MLYM-10", "NotoSansMalayalam-Regular.ttf", "കൊ", "66+1465|20+2125|59+1033"],
		["HB-MLYM-11", "NotoSansMalayalam-Regular.ttf", "കോ", "67+1219|20+2125|59+1033"],
		["HB-MLYM-12", "NotoSansMalayalam-Regular.ttf", "കൌ", "66+1465|20+2125|74+1555"],
		["HB-MLYM-13", "NotoSansMalayalam-Regular.ttf", "ക്കെ", "66+1465|147+3085"],
		["HB-MLYM-14", "NotoSansMalayalam-Regular.ttf", "ക്കൊ", "66+1465|147+3085|59+1033"],
		["HB-MLYM-15", "NotoSansMalayalam-Regular.ttf", "ക്ത്ര", "146+409|148+3707"],
		["HB-MLYM-16", "NotoSansMalayalam-Regular.ttf", "ക്യ", "20+2125|144+497"],
		["HB-MLYM-17", "NotoSansMalayalam-Regular.ttf", "ക്വ", "20+2125|145+467"],
		["HB-MLYM-18", "NotoSansMalayalam-Regular.ttf", "ഖ്യ", "21+2047|144+497"],
		["HB-MLYM-19", "NotoSansMalayalam-Regular.ttf", "ഖ്ര", "146+469|21+2047"],
		[
			"HB-MLYM-20",
			"NotoSansMalayalam-Regular.ttf",
			"ഗ്ദ്ധ്രോ",
			"22+1837|72+0|67+1219|146+444|183+2428|59+1033",
		],
		["HB-MLYM-21", "NotoSansMalayalam-Regular.ttf", "ട്ട", "167+1152"],
		["HB-MLYM-22", "NotoSansMalayalam-Regular.ttf", "ട്ടു്", "167+1206|225+719|72+0"],
		["HB-MLYM-23", "NotoSansMalayalam-Regular.ttf", "ണ്\u{200D}", "96+3110"],
		["HB-MLYM-24", "NotoSansMalayalam-Regular.ttf", "ണ്ട", "174+2995"],
		["HB-MLYM-25", "NotoSansMalayalam-Regular.ttf", "ത്ത", "179+3603"],
		["HB-MLYM-26", "NotoSansMalayalam-Regular.ttf", "ത്തെ", "66+1465|179+3603"],
		["HB-MLYM-27", "NotoSansMalayalam-Regular.ttf", "ത്തൊ", "66+1465|179+3603|59+1033"],
		["HB-MLYM-28", "NotoSansMalayalam-Regular.ttf", "ദ്ദ", "182+1310"],
		["HB-MLYM-29", "NotoSansMalayalam-Regular.ttf", "ന്\u{200D}", "97+2173"],
		["HB-MLYM-30", "NotoSansMalayalam-Regular.ttf", "ന്ത", "189+2734"],
		["HB-MLYM-31", "NotoSansMalayalam-Regular.ttf", "ന്ത്യ", "189+2734|144+497"],
		["HB-MLYM-32", "NotoSansMalayalam-Regular.ttf", "ന്ത്ര്യ", "146+499|189+2734|144+497"],
		["HB-MLYM-33", "NotoSansMalayalam-Regular.ttf", "പ്ര", "146+420|41+1835"],
		["HB-MLYM-34", "NotoSansMalayalam-Regular.ttf", "പ്ലോ", "67+1219|192+1835|59+1033"],
		[
			"HB-MLYM-35",
			"NotoSansMalayalam-Regular.ttf",
			"മുഖ്യമന്ത്രി",
			"45+1485|62+679|21+2047|144+497|45+1485|146+499|189+2734|60+467",
		],
		["HB-MLYM-36", "NotoSansMalayalam-Regular.ttf", "മ്പ", "199+2447"],
		[
			"HB-MLYM-37",
			"NotoSansMalayalam-Regular.ttf",
			"യാത്രാകൂലി",
			"46+2120|59+1033|146+475|35+2077|59+1033|20+2125|63+679|49+1759|60+467",
		],
		["HB-MLYM-38", "NotoSansMalayalam-Regular.ttf", "യും", "46+2050|62+659|4+927"],
		["HB-MLYM-39", "NotoSansMalayalam-Regular.ttf", "യ്ക്കു", "46+2120|72+0|147+3010|62+679"],
		["HB-MLYM-40", "NotoSansMalayalam-Regular.ttf", "യ്യ", "202+2120"],
		["HB-MLYM-41", "NotoSansMalayalam-Regular.ttf", "ര്", "47+1507|72+0"],
		["HB-MLYM-42", "NotoSansMalayalam-Regular.ttf", "ര്\u{200D}", "98+1507"],
		["HB-MLYM-43", "NotoSansMalayalam-Regular.ttf", "ര്ക", "47+1507|72+0|20+2125"],
		["HB-MLYM-44", "NotoSansMalayalam-Regular.ttf", "ര്യ", "47+1507|144+497"],
		["HB-MLYM-45", "NotoSansMalayalam-Regular.ttf", "ര്\u{200D}വ്വ", "98+1507|208+1963"],
		["HB-MLYM-46", "NotoSansMalayalam-Regular.ttf", "ല്\u{200D}", "99+2454"],
		["HB-MLYM-47", "NotoSansMalayalam-Regular.ttf", "ല്യ", "49+1759|144+497"],
		["HB-MLYM-48", "NotoSansMalayalam-Regular.ttf", "ല്ല", "205+1759"],
		["HB-MLYM-49", "NotoSansMalayalam-Regular.ttf", "ല്ലാം", "205+1759|59+1033|4+927"],
		["HB-MLYM-50", "NotoSansMalayalam-Regular.ttf", "വ്വ", "208+1963"],
		["HB-MLYM-51", "NotoSansMalayalam-Regular.ttf", "ഷ്ട്രീ", "54+2354|72+0|146+519|30+1152|61+467"],
		[
			"HB-MLYM-52",
			"NotoSansMalayalam-Regular.ttf",
			"സോഫ്റ്റ്\u{200C}വെയര്\u{200D}",
			"67+1219|55+2505|59+1033|42+2312|72+0|203+1381|72+0|3+0|66+1465|52+1963|46+2120|98+1507",
		],
		["HB-MLYM-53", "NotoSansMalayalam-Regular.ttf", "സ്പ്രി", "55+2505|72+0|146+420|41+1835|60+467"],
		["HB-MLYM-54", "NotoSansMalayalam-Regular.ttf", "സ്പ്രേ", "55+2505|72+0|67+1219|146+420|41+1835"],
		["HB-MLYM-55", "NotoSansMalayalam-Regular.ttf", "സ്പ്ലേ", "55+2505|72+0|67+1219|192+1835"],
		[
			"HB-MLYM-56",
			"NotoSansMalayalam-Regular.ttf",
			"സ്വാതന്ത്ര്യം",
			"55+2505|145+467|59+1033|35+2077|146+499|189+2734|144+497|4+927",
		],
		[
			"HB-MLYM-57",
			"NotoSansMalayalam-Regular.ttf",
			"ഹാര്\u{200D}ഡ്\u{200C}വെയര്\u{200D}",
			"56+2437|59+1033|98+1507|32+2505|72+0|3+0|66+1465|52+1963|46+2120|98+1507",
		],
		["HB-MLYM-58", "NotoSansMalayalam-Regular.ttf", "ള്\u{200D}", "100+2139"],
		["HB-MLYM-59", "NotoSansMalayalam-Regular.ttf", "ള്യം", "50+1466|229+697|4+927"],
		["HB-MLYM-60", "NotoSansMalayalam-Regular.ttf", "ള്ള", "206+2906"],
		["HB-MLYM-61", "NotoSansMalayalam-Regular.ttf", "ല്\u{200D}പ്പേ", "99+2454|67+1219|191+1836"],
		["HB-MLYM-62", "NotoSansMalayalam-Regular.ttf", "ശിം\u{200C}", "53+2130|60+467|3+0|4+927"],
		[
			"HB-MLYM-63",
			"NotoSansMalayalam-Regular.ttf",
			"കോം\u{200C}",
			"67+1219|20+2125|59+1033|3+0|4+927",
		],
		["HB-MLYM-64", "NotoSansMalayalam-Regular.ttf", "യ\u{200D}്യ", "46+2120|3+0|144+497"],
		["HB-MLYM-65", "NotoSansMalayalam-Regular.ttf", "സ്റ്റ്", "214+2505|72+0"],
		[
			"should not crash on null GPOS anchors",
			"NotoSansMalayalam-Hinted.ttf",
			"പുസ്തകം",
			"44+896|67+332|58+1223|77+0|38+1014|23+1038|6+453",
		],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Oriya text", () => {
	test.each([
		["HB-ORYA-1", "NotoSansOriya-Regular.ttf", "କ୍ତ୍ର", "165+1354|527@-225,0+0"],
		["HB-ORYA-2", "NotoSansOriya-Regular.ttf", "ତ୍ତ୍ବ", "195+1397|150@-333,0+0"],
		["HB-ORYA-3", "NotoSansOriya-Regular.ttf", "ନ୍ତ୍ବ", "206+1298|525@-280,0+0"],
		["HB-ORYA-4", "NotoSansOriya-Regular.ttf", "ନ୍ତ୍ର", "38+1298|161@-280,0+0"],
		["HB-ORYA-5", "NotoSansOriya-Regular.ttf", "ନ୍ତ୍ର୍ଯ", "38+1298|161@-280,0+0|162+768"],
		["HB-ORYA-6", "NotoSansOriya-Regular.ttf", "ସ୍ତ୍ର", "51+1317|161+0"],
		["HB-ORYA-7", "NotoSansOriya-Regular.ttf", "ମୁଁ", "43+1327|4+0|58+0"],
		["HB-ORYA-8", "NotoSansOriya-Regular.ttf", "ମୁଂ", "43+1327|58+0|5+618"],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes Khmer text", () => {
	test.each([
		["HB-KHMR-1", "NotoSansKhmer-Regular.ttf", "ខ្មែ", "108+588|45+1300|169+0"],
		["HB-KHMR-2", "NotoSansKhmer-Regular.ttf", "ជា", "51+1300|96+588"],
		["HB-KHMR-3", "NotoSansKhmer-Regular.ttf", "ថ្ងៃ", "109+588|60+1300|148+0"],
		["HB-KHMR-4", "NotoSansKhmer-Regular.ttf", "មា", "68+1300|96+588"],
		["HB-KHMR-5", "NotoSansKhmer-Regular.ttf", "ម្ពុ", "68+1300|167+0|177+0"],
		["HB-KHMR-6", "NotoSansKhmer-Regular.ttf", "រ", "70+588"],
		["HB-KHMR-7", "NotoSansKhmer-Regular.ttf", "រី", "70+588|194+0"],
		["HB-KHMR-8", "NotoSansKhmer-Regular.ttf", "រ៍", "70+588|199+0"],
		["HB-KHMR-9", "NotoSansKhmer-Regular.ttf", "សៅ", "107+588|75+1900|111+588"],
		["HB-KHMR-10", "NotoSansKhmer-Regular.ttf", "រ្ឥ", "70+588|124+0|81+1300"],
		["HB-KHMR-11", "NotoSansKhmer-Regular.ttf", "ងឹ្ឈ", "48+1300|99+0|152+588"],
		["HB-KHMR-12", "NotoSansKhmer-Regular.ttf", "ង្ឈឹ", "48+1300|152+588|99+0"],
		["HB-KHMR-13", "NotoSansKhmer-Regular.ttf", "ង្គ្រ", "189+588|48+1300|146+0"],
		["HB-KHMR-14", "NotoSansKhmer-Regular.ttf", "ង្រ្គ", "189+588|48+1300|146+0"],
		["HB-KHMR-15", "NotoSansKhmer-Regular.ttf", "ម៉្លេះ", "107+588|68+1300|115+0|172+0|113+850"],
		[
			"HB-KHMR-16",
			"NotoSansKhmer-Regular.ttf",
			"ម\u{200C}៉្លេះ",
			"107+588|68+1300|3+0|115+0|172+0|113+850",
		],
		["HB-KHMR-17", "NotoSansKhmer-Regular.ttf", "ប៊័", "64+1300|116+0|122+0"],
		["HB-KHMR-18", "NotoSansKhmer-Regular.ttf", "នែ៎", "108+588|63+1300|120+0"],
		["HB-KHMR-19", "NotoSansKhmer-Regular.ttf", "កេ្រ", "107+588|171+588|44+1300"],
		["HB-KHMR-20", "NotoSansKhmer-Regular.ttf", "កៀ្រ", "171+588|107+588|44+1300|106+588"],
		["HB-KHMR-21", "NotoSansKhmer-Regular.ttf", "កោ្រ", "171+588|107+588|44+1300|110+588"],
		["HB-KHMR-22", "NotoSansKhmer-Regular.ttf", "កៅ្រ", "171+588|107+588|44+1300|111+588"],
		["HB-KHMR-23", "NotoSansKhmer-Regular.ttf", "ព៑ា", "66+1300|123+0|96+588"],
		[
			"decomposes split matras",
			"NotoSansKhmer-Regular.ttf",
			"ដើម្បីឲ្យបានកាន់តែប្រសើរឡើងសម្រាប់ការធ្វើដំណើររបស់ភ្ញៀវទេសចរណ៍",
			"107+588|54+1300|104+0|68+1300|165+588|98+0|94+1300|170+588|188+1300|96+588|63+1300|44+1300|96+588|63+1300|117+0|108+588|59+1300|171+588|64+1300|107+588|75+1900|104+0|70+588|107+588|77+1900|104+0|48+1300|75+1900|171+588|68+1300|96+588|64+1300|117+0|44+1300|96+588|70+588|107+588|62+1300|173+0|104+0|54+1300|112+0|107+588|58+2538|104+0|70+588|70+588|64+1300|75+1900|117+0|107+588|67+1300|153+0|192+588|72+588|107+588|61+1300|75+1900|49+1300|70+588|58+2538|119+0",
		],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("Indic shaper behaviour", () => {
	test("selects the Indic shaper under the new Devanagari script tag", () => {
		let shaped = shape(font("NotoSans/NotoSansDevanagari-Regular.ttf"), "कि");
		expect(shaped.script).toBe("dev2");
		expect(shaped.features).toContain("rphf");
		expect(shaped.features).toContain("pres");
	});

	test("gives every glyph of a reordered syllable the syllable's first cluster", () => {
		let { glyphs } = shape(font("NotoSans/NotoSansDevanagari-Regular.ttf"), "किक");
		expect(glyphs.map((glyph) => glyph.cluster)).toEqual([0, 0, 2]);
	});

	test("shapes a long run of viramas and marks without throwing", () => {
		let text = "क्".repeat(2000) + "ि".repeat(2000) + "‍".repeat(2000);
		let { glyphs } = shape(font("NotoSans/NotoSansDevanagari-Regular.ttf"), text);
		expect(glyphs.length).toBeGreaterThan(2000);
	});

	test("shapes Indic text with a font that has no Indic tables", () => {
		let { glyphs } = shape(font("NotoSans/NotoSansKhmer-Regular.ttf"), "क्षि", { script: "dev2" });
		expect(glyphs.length).toBeGreaterThan(0);
	});
});
