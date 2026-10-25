/**
 * The example of RFC 7095 Appendix B.1: the vCard of the author of RFC 6350 and the jCard
 * the appendix converts it to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Appendix B.1.1: the vCard text, folded as published. */
export const AUTHOR_VCARD = [
	"BEGIN:VCARD",
	"VERSION:4.0",
	"FN:Simon Perreault",
	"N:Perreault;Simon;;;ing. jr,M.Sc.",
	"BDAY:--0203",
	"ANNIVERSARY:20090808T1430-0500",
	"GENDER:M",
	"LANG;PREF=1:fr",
	"LANG;PREF=2:en",
	"ORG;TYPE=work:Viagenie",
	"ADR;TYPE=work:;Suite D2-630;2875 Laurier;",
	" Quebec;QC;G1V 2M2;Canada",
	'TEL;VALUE=uri;TYPE="work,voice";PREF=1:tel:+1-418-656-9254;ext=102',
	'TEL;VALUE=uri;TYPE="work,cell,voice,video,text":tel:+1-418-262-6501',
	"EMAIL;TYPE=work:simon.perreault@viagenie.ca",
	"GEO;TYPE=work:geo:46.772673,-71.282945",
	"KEY;TYPE=work;VALUE=uri:",
	" http://www.viagenie.ca/simon.perreault/simon.asc",
	"TZ:-0500",
	"URL;TYPE=home:http://nomis80.org",
	"END:VCARD",
	"",
].join("\r\n");

/** Appendix B.1.2: the jCard. */
export const AUTHOR_JCARD = [
	"vcard",
	[
		["version", {}, "text", "4.0"],
		["fn", {}, "text", "Simon Perreault"],
		["n", {}, "text", ["Perreault", "Simon", "", "", ["ing. jr", "M.Sc."]]],
		["bday", {}, "date-and-or-time", "--02-03"],
		["anniversary", {}, "date-and-or-time", "2009-08-08T14:30:00-05:00"],
		["gender", {}, "text", "M"],
		["lang", { pref: "1" }, "language-tag", "fr"],
		["lang", { pref: "2" }, "language-tag", "en"],
		["org", { type: "work" }, "text", "Viagenie"],
		[
			"adr",
			{ type: "work" },
			"text",
			["", "Suite D2-630", "2875 Laurier", "Quebec", "QC", "G1V 2M2", "Canada"],
		],
		["tel", { type: ["work", "voice"], pref: "1" }, "uri", "tel:+1-418-656-9254;ext=102"],
		["tel", { type: ["work", "cell", "voice", "video", "text"] }, "uri", "tel:+1-418-262-6501"],
		["email", { type: "work" }, "text", "simon.perreault@viagenie.ca"],
		["geo", { type: "work" }, "uri", "geo:46.772673,-71.282945"],
		["key", { type: "work" }, "uri", "http://www.viagenie.ca/simon.perreault/simon.asc"],
		["tz", {}, "utc-offset", "-05:00"],
		["url", { type: "home" }, "uri", "http://nomis80.org"],
	],
];
