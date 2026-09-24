/**
 * Matching cases ported from Google's open-source robots.txt parser test suite, which checks its
 * matcher against RFC 9309. Source: github.com/google/robotstxt, robots_test.cc at commit
 * 22b355ff855419e6a3ff8ff09c0ad7fdb17116f9, Copyright 2019 Google LLC, Apache License 2.0
 * (LICENSE-google-robotstxt.txt beside this file). Changed: translated from C++ to data, and
 * limited to the RFC cases; Google-only extensions are left out, as listed in the README.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One robots.txt and the decisions Google's suite expects for it. */
export interface GoogleCase {
	/** The gtest name the case comes from. */
	name: string;
	robotstxt: string;
	/** Each expectation as the agent, the URL, and whether the agent may fetch it. */
	expectations: [userAgent: string, url: string, allowed: boolean][];
}

/** Every ported case, in the order the upstream file declares them. */
export const GOOGLE_CASES: GoogleCase[] = [
	{
		name: "GoogleOnly_SystemTest (RFC subset)",
		robotstxt: "user-agent: FooBot\ndisallow: /\n",
		expectations: [["", "http://foo.bar/", true]],
	},
	{
		name: "GoogleOnly_SystemTest (empty file)",
		robotstxt: "",
		expectations: [
			["FooBot", "http://foo.bar/", true],
			["", "http://foo.bar/", true],
		],
	},
	{
		name: "ID_LineSyntax_Line (correct)",
		robotstxt: "user-agent: FooBot\ndisallow: /\n",
		expectations: [["FooBot", "http://foo.bar/x/y", false]],
	},
	{
		name: "ID_LineSyntax_Line (incorrect)",
		robotstxt: "foo: FooBot\nbar: /\n",
		expectations: [["FooBot", "http://foo.bar/x/y", true]],
	},
	{
		name: "ID_LineSyntax_Groups",
		robotstxt:
			"allow: /foo/bar/\n" +
			"\n" +
			"user-agent: FooBot\n" +
			"disallow: /\n" +
			"allow: /x/\n" +
			"user-agent: BarBot\n" +
			"disallow: /\n" +
			"allow: /y/\n" +
			"\n" +
			"\n" +
			"allow: /w/\n" +
			"user-agent: BazBot\n" +
			"\n" +
			"user-agent: FooBot\n" +
			"allow: /z/\n" +
			"disallow: /\n",
		expectations: [
			["FooBot", "http://foo.bar/x/b", true],
			["FooBot", "http://foo.bar/z/d", true],
			["FooBot", "http://foo.bar/y/c", false],
			["BarBot", "http://foo.bar/y/c", true],
			["BarBot", "http://foo.bar/w/a", true],
			["BarBot", "http://foo.bar/z/d", false],
			["BazBot", "http://foo.bar/z/d", true],
			["FooBot", "http://foo.bar/foo/bar/", false],
			["BarBot", "http://foo.bar/foo/bar/", false],
			["BazBot", "http://foo.bar/foo/bar/", false],
		],
	},
	{
		name: "ID_LineSyntax_Groups_OtherRules (sitemap)",
		robotstxt: "User-agent: BarBot\nSitemap: https://foo.bar/sitemap\nUser-agent: *\nDisallow: /\n",
		expectations: [
			["FooBot", "http://foo.bar/", false],
			["BarBot", "http://foo.bar/", false],
		],
	},
	{
		name: "ID_LineSyntax_Groups_OtherRules (unknown line)",
		robotstxt: "User-agent: FooBot\nInvalid-Unknown-Line: unknown\nUser-agent: *\nDisallow: /\n",
		expectations: [
			["FooBot", "http://foo.bar/", false],
			["BarBot", "http://foo.bar/", false],
		],
	},
	...[
		"USER-AGENT: FooBot\nALLOW: /x/\nDISALLOW: /\n",
		"uSeR-aGeNt: FooBot\nAlLoW: /x/\ndIsAlLoW: /\n",
	].map((robotstxt): GoogleCase => ({
		name: "ID_REPLineNamesCaseInsensitive",
		robotstxt,
		expectations: [
			["FooBot", "http://foo.bar/x/y", true],
			["FooBot", "http://foo.bar/a/b", false],
		],
	})),
	...["FOO BAR", "foo bar", "FoO bAr"].map((agent): GoogleCase => ({
		name: "ID_UserAgentValueCaseInsensitive",
		robotstxt: `User-Agent: ${agent}\nAllow: /x/\nDisallow: /\n`,
		expectations: [
			["Foo", "http://foo.bar/x/y", true],
			["Foo", "http://foo.bar/a/b", false],
			["foo", "http://foo.bar/x/y", true],
			["foo", "http://foo.bar/a/b", false],
		],
	})),
	{
		name: "GoogleOnly_AcceptUserAgentUpToFirstSpace",
		robotstxt: "User-Agent: *\nDisallow: /\nUser-Agent: Foo Bar\nAllow: /x/\nDisallow: /\n",
		expectations: [["Foo", "http://foo.bar/x/y", true]],
	},
	{
		name: "ID_GlobalGroups_Secondary (empty)",
		robotstxt: "",
		expectations: [["FooBot", "http://foo.bar/x/y", true]],
	},
	{
		name: "ID_GlobalGroups_Secondary (global)",
		robotstxt: "user-agent: *\nallow: /\nuser-agent: FooBot\ndisallow: /\n",
		expectations: [
			["FooBot", "http://foo.bar/x/y", false],
			["BarBot", "http://foo.bar/x/y", true],
		],
	},
	{
		name: "ID_GlobalGroups_Secondary (only specific)",
		robotstxt:
			"user-agent: FooBot\nallow: /\nuser-agent: BarBot\ndisallow: /\nuser-agent: BazBot\ndisallow: /\n",
		expectations: [["QuxBot", "http://foo.bar/x/y", true]],
	},
	{
		name: "ID_AllowDisallow_Value_CaseSensitive (lowercase)",
		robotstxt: "user-agent: FooBot\ndisallow: /x/\n",
		expectations: [["FooBot", "http://foo.bar/x/y", false]],
	},
	{
		name: "ID_AllowDisallow_Value_CaseSensitive (uppercase)",
		robotstxt: "user-agent: FooBot\ndisallow: /X/\n",
		expectations: [["FooBot", "http://foo.bar/x/y", true]],
	},
	{
		name: "ID_LongestMatch (disallow longer)",
		robotstxt: "user-agent: FooBot\ndisallow: /x/page.html\nallow: /x/\n",
		expectations: [["FooBot", "http://foo.bar/x/page.html", false]],
	},
	{
		name: "ID_LongestMatch (allow longer)",
		robotstxt: "user-agent: FooBot\nallow: /x/page.html\ndisallow: /x/\n",
		expectations: [
			["FooBot", "http://foo.bar/x/page.html", true],
			["FooBot", "http://foo.bar/x/", false],
		],
	},
	{
		name: "ID_LongestMatch (empty patterns)",
		robotstxt: "user-agent: FooBot\ndisallow: \nallow: \n",
		expectations: [["FooBot", "http://foo.bar/x/page.html", true]],
	},
	{
		name: "ID_LongestMatch (equal root patterns)",
		robotstxt: "user-agent: FooBot\ndisallow: /\nallow: /\n",
		expectations: [["FooBot", "http://foo.bar/x/page.html", true]],
	},
	{
		name: "ID_LongestMatch (trailing slash)",
		robotstxt: "user-agent: FooBot\ndisallow: /x\nallow: /x/\n",
		expectations: [
			["FooBot", "http://foo.bar/x", false],
			["FooBot", "http://foo.bar/x/", true],
		],
	},
	{
		name: "ID_LongestMatch (equal page patterns)",
		robotstxt: "user-agent: FooBot\ndisallow: /x/page.html\nallow: /x/page.html\n",
		expectations: [["FooBot", "http://foo.bar/x/page.html", true]],
	},
	{
		name: "ID_LongestMatch (wildcard longer)",
		robotstxt: "user-agent: FooBot\nallow: /page\ndisallow: /*.html\n",
		expectations: [
			["FooBot", "http://foo.bar/page.html", false],
			["FooBot", "http://foo.bar/page", true],
		],
	},
	{
		name: "ID_LongestMatch (prefix longer than wildcard)",
		robotstxt: "user-agent: FooBot\nallow: /x/page.\ndisallow: /*.html\n",
		expectations: [
			["FooBot", "http://foo.bar/x/page.html", true],
			["FooBot", "http://foo.bar/x/y.html", false],
		],
	},
	{
		name: "ID_LongestMatch (specific group replaces global)",
		robotstxt: "User-agent: *\nDisallow: /x/\nUser-agent: FooBot\nDisallow: /y/\n",
		expectations: [
			["FooBot", "http://foo.bar/x/page", true],
			["FooBot", "http://foo.bar/y/page", false],
		],
	},
	{
		name: "ID_Encoding (query left unencoded)",
		robotstxt:
			"User-agent: FooBot\nDisallow: /\nAllow: /foo/bar?qux=taz&baz=http://foo.bar?tar&par\n",
		expectations: [["FooBot", "http://foo.bar/foo/bar?qux=taz&baz=http://foo.bar?tar&par", true]],
	},
	{
		name: "ID_Encoding (3-byte character in the pattern)",
		robotstxt: "User-agent: FooBot\nDisallow: /\nAllow: /foo/bar/ツ\n",
		expectations: [["FooBot", "http://foo.bar/foo/bar/%E3%83%84", true]],
	},
	{
		name: "ID_Encoding (percent-encoded 3-byte character)",
		robotstxt: "User-agent: FooBot\nDisallow: /\nAllow: /foo/bar/%E3%83%84\n",
		expectations: [["FooBot", "http://foo.bar/foo/bar/%E3%83%84", true]],
	},
	{
		name: "ID_Encoding (percent-encoded unreserved characters)",
		robotstxt: "User-agent: FooBot\nDisallow: /\nAllow: /foo/bar/%62%61%7A\n",
		expectations: [["FooBot", "http://foo.bar/foo/bar/%62%61%7A", true]],
	},
	{
		name: "ID_SpecialCharacters (star)",
		robotstxt: "User-agent: FooBot\nDisallow: /foo/bar/quz\nAllow: /foo/*/qux\n",
		expectations: [
			["FooBot", "http://foo.bar/foo/bar/quz", false],
			["FooBot", "http://foo.bar/foo/quz", true],
			["FooBot", "http://foo.bar/foo//quz", true],
			["FooBot", "http://foo.bar/foo/bax/quz", true],
		],
	},
	{
		name: "ID_SpecialCharacters (dollar)",
		robotstxt: "User-agent: FooBot\nDisallow: /foo/bar$\nAllow: /foo/bar/qux\n",
		expectations: [
			["FooBot", "http://foo.bar/foo/bar", false],
			["FooBot", "http://foo.bar/foo/bar/qux", true],
			["FooBot", "http://foo.bar/foo/bar/", true],
			["FooBot", "http://foo.bar/foo/bar/baz", true],
		],
	},
	{
		name: "ID_SpecialCharacters (comments)",
		robotstxt: "User-agent: FooBot\n# Disallow: /\nDisallow: /foo/quz#qux\nAllow: /\n",
		expectations: [
			["FooBot", "http://foo.bar/foo/bar", true],
			["FooBot", "http://foo.bar/foo/quz", false],
		],
	},
	{
		name: "GoogleOnly_DocumentationChecks (/fish)",
		robotstxt: "user-agent: FooBot\ndisallow: /\nallow: /fish\n",
		expectations: [
			["FooBot", "http://foo.bar/bar", false],
			["FooBot", "http://foo.bar/fish", true],
			["FooBot", "http://foo.bar/fish.html", true],
			["FooBot", "http://foo.bar/fish/salmon.html", true],
			["FooBot", "http://foo.bar/fishheads", true],
			["FooBot", "http://foo.bar/fishheads/yummy.html", true],
			["FooBot", "http://foo.bar/fish.html?id=anything", true],
			["FooBot", "http://foo.bar/Fish.asp", false],
			["FooBot", "http://foo.bar/catfish", false],
			["FooBot", "http://foo.bar/?id=fish", false],
		],
	},
	{
		name: "GoogleOnly_DocumentationChecks (/fish*)",
		robotstxt: "user-agent: FooBot\ndisallow: /\nallow: /fish*\n",
		expectations: [
			["FooBot", "http://foo.bar/bar", false],
			["FooBot", "http://foo.bar/fish", true],
			["FooBot", "http://foo.bar/fish.html", true],
			["FooBot", "http://foo.bar/fish/salmon.html", true],
			["FooBot", "http://foo.bar/fishheads", true],
			["FooBot", "http://foo.bar/fishheads/yummy.html", true],
			["FooBot", "http://foo.bar/fish.html?id=anything", true],
			["FooBot", "http://foo.bar/Fish.bar", false],
			["FooBot", "http://foo.bar/catfish", false],
			["FooBot", "http://foo.bar/?id=fish", false],
		],
	},
	{
		name: "GoogleOnly_DocumentationChecks (/fish/)",
		robotstxt: "user-agent: FooBot\ndisallow: /\nallow: /fish/\n",
		expectations: [
			["FooBot", "http://foo.bar/bar", false],
			["FooBot", "http://foo.bar/fish/", true],
			["FooBot", "http://foo.bar/fish/salmon", true],
			["FooBot", "http://foo.bar/fish/?salmon", true],
			["FooBot", "http://foo.bar/fish/salmon.html", true],
			["FooBot", "http://foo.bar/fish/?id=anything", true],
			["FooBot", "http://foo.bar/fish", false],
			["FooBot", "http://foo.bar/fish.html", false],
			["FooBot", "http://foo.bar/Fish/Salmon.html", false],
		],
	},
	{
		name: "GoogleOnly_DocumentationChecks (/*.php)",
		robotstxt: "user-agent: FooBot\ndisallow: /\nallow: /*.php\n",
		expectations: [
			["FooBot", "http://foo.bar/bar", false],
			["FooBot", "http://foo.bar/filename.php", true],
			["FooBot", "http://foo.bar/folder/filename.php", true],
			["FooBot", "http://foo.bar/folder/filename.php?parameters", true],
			["FooBot", "http://foo.bar//folder/any.php.file.html", true],
			["FooBot", "http://foo.bar/filename.php/", true],
			["FooBot", "http://foo.bar/index?f=filename.php/", true],
			["FooBot", "http://foo.bar/php/", false],
			["FooBot", "http://foo.bar/index?php", false],
			["FooBot", "http://foo.bar/windows.PHP", false],
		],
	},
	{
		name: "GoogleOnly_DocumentationChecks (/*.php$)",
		robotstxt: "user-agent: FooBot\ndisallow: /\nallow: /*.php$\n",
		expectations: [
			["FooBot", "http://foo.bar/bar", false],
			["FooBot", "http://foo.bar/filename.php", true],
			["FooBot", "http://foo.bar/folder/filename.php", true],
			["FooBot", "http://foo.bar/filename.php?parameters", false],
			["FooBot", "http://foo.bar/filename.php/", false],
			["FooBot", "http://foo.bar/filename.php5", false],
			["FooBot", "http://foo.bar/php/", false],
			["FooBot", "http://foo.bar/filename?php", false],
			["FooBot", "http://foo.bar/aaaphpaaa", false],
			["FooBot", "http://foo.bar//windows.PHP", false],
		],
	},
	{
		name: "GoogleOnly_DocumentationChecks (/fish*.php)",
		robotstxt: "user-agent: FooBot\ndisallow: /\nallow: /fish*.php\n",
		expectations: [
			["FooBot", "http://foo.bar/bar", false],
			["FooBot", "http://foo.bar/fish.php", true],
			["FooBot", "http://foo.bar/fishheads/catfish.php?parameters", true],
			["FooBot", "http://foo.bar/Fish.PHP", false],
		],
	},
	{
		name: "GoogleOnly_DocumentationChecks (precedence /p)",
		robotstxt: "user-agent: FooBot\nallow: /p\ndisallow: /\n",
		expectations: [["FooBot", "http://example.com/page", true]],
	},
	{
		name: "GoogleOnly_DocumentationChecks (precedence equal)",
		robotstxt: "user-agent: FooBot\nallow: /folder\ndisallow: /folder\n",
		expectations: [["FooBot", "http://example.com/folder/page", true]],
	},
	{
		name: "GoogleOnly_DocumentationChecks (precedence wildcard)",
		robotstxt: "user-agent: FooBot\nallow: /page\ndisallow: /*.htm\n",
		expectations: [["FooBot", "http://example.com/page.htm", false]],
	},
	{
		name: "GoogleOnly_DocumentationChecks (precedence anchored root)",
		robotstxt: "user-agent: FooBot\nallow: /$\ndisallow: /\n",
		expectations: [
			["FooBot", "http://example.com/", true],
			["FooBot", "http://example.com/page.html", false],
		],
	},
];
