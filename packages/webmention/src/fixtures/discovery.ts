/**
 * The 23 discovery tests of webmention.rocks, each page's `Link` headers and markup as the
 * site served them on 2026-09-24, so endpoint discovery is checked against the cases every
 * Webmention sender is held to. Source: github.com/aaronpk/webmention.rocks at 7b97198,
 * Apache-2.0; the page template is trimmed to the head and the post itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One discovery test: the response a sender receives and the endpoint it must find. */
export interface DiscoveryCase {
	test: number;
	description: string;
	/** Where the page was served from, after any redirect. */
	url: string;
	/** The URL the test hands a sender, when it redirects to `url`. */
	redirectedFrom?: string;
	/** Header lines in the order they were sent, name spelled as the site spelled it. */
	headers: [string, string][];
	body: string;
	endpoint: string;
}

/**
 * Rebuilds a test page from the site's template: its `<head>`, with the test's own
 * `<link>` last, and the post, whose content carries the test's markup.
 */
function page(test: number, head: string, content: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Webmention Rocks!</title>
  <link href="/assets/semantic.min.css" rel="stylesheet">
  <link href="/assets/style.css" rel="stylesheet">
  <script src="/assets/script.js"></script>
  ${head}
</head>
<body>
<div class="post-container h-entry">
  <div class="left p-author h-card">
    <a href="/"><img src="/assets/webmention-rocks-icon.png" width="80" class="u-photo" alt="Webmention Rocks!"></a>
  </div>
  <div class="right">
    <h1 class="p-name"><a href="/test/${test}">Discovery Test #${test}</a></h1>
    <div class="e-content">${content}</div>
    <div class="meta"><a href="/test/${test}" class="u-url">Published</a></div>
  </div>
</div>
</body>
</html>`;
}

/** Every discovery test, in the site's numbering. */
export const DISCOVERY_CASES: DiscoveryCase[] = [
	{
		test: 1,
		description: "Link header, relative URL",
		url: "https://webmention.rocks/test/1",
		headers: [["Link", "</test/1/webmention>; rel=webmention"]],
		body: page(
			1,
			"",
			"This post advertises its Webmention endpoint with an HTTP <code>Link</code> header. The URL is relative, so this will also test whether your discovery code properly resolves the relative URL.",
		),
		endpoint: "https://webmention.rocks/test/1/webmention",
	},
	{
		test: 2,
		description: "Link header, absolute URL",
		url: "https://webmention.rocks/test/2",
		headers: [["Link", "<https://webmention.rocks/test/2/webmention>; rel=webmention"]],
		body: page(
			2,
			"",
			"This post advertises its Webmention endpoint with an HTTP <code>Link</code> header. The Webmention endpoint is listed as an absolute URL.",
		),
		endpoint: "https://webmention.rocks/test/2/webmention",
	},
	{
		test: 3,
		description: "<link> element, relative URL",
		url: "https://webmention.rocks/test/3",
		headers: [],
		body: page(
			3,
			'<link rel="webmention" href="/test/3/webmention">',
			"This post advertises its Webmention endpoint with an HTML <code>&lt;link&gt;</code> tag in the document. The URL is relative, so this will also test whether your discovery code properly resolves the relative URL.",
		),
		endpoint: "https://webmention.rocks/test/3/webmention",
	},
	{
		test: 4,
		description: "<link> element, absolute URL",
		url: "https://webmention.rocks/test/4",
		headers: [],
		body: page(
			4,
			'<link href="https://webmention.rocks/test/4/webmention" rel="webmention">',
			"This post advertises its Webmention endpoint with an HTML <code>&lt;link&gt;</code> tag in the document. The Webmention endpoint is listed as an absolute URL.",
		),
		endpoint: "https://webmention.rocks/test/4/webmention",
	},
	{
		test: 5,
		description: "<a> element, relative URL",
		url: "https://webmention.rocks/test/5",
		headers: [],
		body: page(
			5,
			"",
			'This post advertises its <a rel="webmention" href="/test/5/webmention">Webmention endpoint</a> with an HTML <code>&lt;a&gt;</code> tag in the body. The URL is relative, so this will also test whether your discovery code properly resolves the relative URL.',
		),
		endpoint: "https://webmention.rocks/test/5/webmention",
	},
	{
		test: 6,
		description: "<a> element, absolute URL",
		url: "https://webmention.rocks/test/6",
		headers: [],
		body: page(
			6,
			"",
			'This post advertises its <a href="https://webmention.rocks/test/6/webmention" rel="webmention">Webmention endpoint</a> with an HTML <code>&lt;a&gt;</code> tag in the body. The Webmention endpoint is listed as an absolute URL.',
		),
		endpoint: "https://webmention.rocks/test/6/webmention",
	},
	{
		test: 7,
		description: "Link header with unusual casing (LinK)",
		url: "https://webmention.rocks/test/7",
		headers: [["LinK", "<https://webmention.rocks/test/7/webmention>; rel=webmention"]],
		body: page(
			7,
			"",
			'This post advertises its Webmention endpoint with an HTTP header with intentionally unusual casing, "<code>LinK</code>". This helps you test whether you are handling HTTP header names in a case insensitive way.',
		),
		endpoint: "https://webmention.rocks/test/7/webmention",
	},
	{
		test: 8,
		description: "Link header with a quoted rel value",
		url: "https://webmention.rocks/test/8",
		headers: [["Link", '<https://webmention.rocks/test/8/webmention>; rel="webmention"']],
		body: page(
			8,
			"",
			'This post advertises its Webmention endpoint with an HTTP <code>Link</code> header. Unlike tests #1 and #2, the rel value is quoted, since HTTP allows both <code>rel="webmention"</code> and <code>rel=webmention</code> for the Link header.',
		),
		endpoint: "https://webmention.rocks/test/8/webmention",
	},
	{
		test: 9,
		description: "<link> element with multiple rel values",
		url: "https://webmention.rocks/test/9",
		headers: [],
		body: page(
			9,
			'<link rel="webmention somethingelse" href="https://webmention.rocks/test/9/webmention">',
			"This post has a &lt;link&gt; tag with multiple rel values.",
		),
		endpoint: "https://webmention.rocks/test/9/webmention",
	},
	{
		test: 10,
		description: "Link header with multiple rel values",
		url: "https://webmention.rocks/test/10",
		headers: [
			["Link", '<https://webmention.rocks/test/10/webmention>; rel="webmention somethingelse"'],
		],
		body: page(10, "", "This post has an HTTP Link header with multiple rel values."),
		endpoint: "https://webmention.rocks/test/10/webmention",
	},
	{
		test: 11,
		description: "Link header wins over <link> and <a>",
		url: "https://webmention.rocks/test/11",
		headers: [["Link", '</test/11/webmention>; rel="webmention"']],
		body: page(
			11,
			'<link rel="webmention" href="/test/11/webmention/error">',
			'This post advertises its Webmention endpoint in the HTTP Link header, HTML &lt;link&gt; tag, as well as an <a href="/test/11/webmention/error" rel="webmention">&lt;a&gt; tag</a>. Your Webmention client must only send a Webmention to the one in the Link header.',
		),
		endpoint: "https://webmention.rocks/test/11/webmention",
	},
	{
		test: 12,
		description: 'rel="not-webmention" is not a match',
		url: "https://webmention.rocks/test/12",
		headers: [],
		body: page(
			12,
			'<link rel="not-webmention" href="/test/12/webmention/error">',
			'This post contains a link tag with a rel value of "not-webmention", just to make sure you aren\'t using naïve string matching to find the endpoint. There is also a <a href="/test/12/webmention" rel="webmention">correct endpoint</a> defined, so if your comment appears below, it means you successfully ignored the false endpoint.',
		),
		endpoint: "https://webmention.rocks/test/12/webmention",
	},
	{
		test: 13,
		description: "An endpoint inside an HTML comment is ignored",
		url: "https://webmention.rocks/test/13",
		headers: [],
		body: page(
			13,
			"",
			'This post contains an HTML comment <!-- <a href="/test/13/webmention/error" rel="webmention"></a> --> that contains a rel=webmention element, which should not receive a Webmention since it\'s inside an HTML comment. There is also a <a href="/test/13/webmention" rel="webmention">correct endpoint</a> defined, so if your comment appears below, it means you successfully ignored the false endpoint.',
		),
		endpoint: "https://webmention.rocks/test/13/webmention",
	},
	{
		test: 14,
		description: "An endpoint in escaped markup is ignored",
		url: "https://webmention.rocks/test/14",
		headers: [],
		body: page(
			14,
			"",
			'This post contains sample code with escaped HTML which should not be discovered by the Webmention client. <code>&lt;a href="/test/14/webmention/error" rel="webmention"&gt;&lt;/a&gt;</code> There is also a <a href="/test/14/webmention" rel="webmention">correct endpoint</a> defined, so if your comment appears below, it means you successfully ignored the false endpoint.',
		),
		endpoint: "https://webmention.rocks/test/14/webmention",
	},
	{
		test: 15,
		description: "An empty href names the page itself",
		url: "https://webmention.rocks/test/15",
		headers: [],
		body: page(
			15,
			'<link rel="webmention" href="">',
			"This post has a &lt;link&gt; tag where the href value is an empty string, meaning the page is its own Webmention endpoint. This tests the relative URL resolver of the sender to ensure an empty string is resolved to the page's URL.",
		),
		endpoint: "https://webmention.rocks/test/15",
	},
	{
		test: 16,
		description: "<a> before <link>: the first in document order wins",
		url: "https://webmention.rocks/test/16",
		headers: [],
		body: page(
			16,
			"",
			'This post advertises its Webmention endpoint in an HTML <a href="/test/16/webmention" rel="webmention">&lt;a&gt; tag</a>, followed by a later definition in a &lt;link&gt; tag. Your Webmention client must only send a Webmention to the one in the &lt;a&gt; tag since it appears first in the document. <link rel="webmention" href="/test/16/webmention/error">',
		),
		endpoint: "https://webmention.rocks/test/16/webmention",
	},
	{
		test: 17,
		description: "<link> before <a>: the first in document order wins",
		url: "https://webmention.rocks/test/17",
		headers: [],
		body: page(
			17,
			"",
			'This post advertises its Webmention endpoint in an HTML &lt;link&gt; tag <link rel="webmention" href="/test/17/webmention"> followed by a later definition in an <a href="/test/17/webmention/error" rel="webmention">&lt;a&gt; tag</a>. Your Webmention client must only send a Webmention to the one in the &lt;link&gt; tag since it appears first in the document.',
		),
		endpoint: "https://webmention.rocks/test/17/webmention",
	},
	{
		test: 18,
		description: "Two Link headers, the first with another rel",
		url: "https://webmention.rocks/test/18",
		headers: [
			["Link", '<https://webmention.rocks/test/18/webmention/error>; rel="other"'],
			["Link", '<https://webmention.rocks/test/18/webmention>; rel="webmention"'],
		],
		body: page(
			18,
			"",
			"This post returns two HTTP Link headers, the first with a different rel value. This ensures your code correctly parses the HTTP response when multiple Link headers are returned.",
		),
		endpoint: "https://webmention.rocks/test/18/webmention",
	},
	{
		test: 19,
		description: "One Link header with two comma-separated values",
		url: "https://webmention.rocks/test/19",
		headers: [
			[
				"Link",
				'<https://webmention.rocks/test/19/webmention/error>; rel="other", <https://webmention.rocks/test/19/webmention>; rel="webmention"',
			],
		],
		body: page(
			19,
			"",
			"This post returns one HTTP Link header with multiple values separated by a comma. This ensures your code correctly parses the HTTP headers.",
		),
		endpoint: "https://webmention.rocks/test/19/webmention",
	},
	{
		test: 20,
		description: "A <link> with no href is skipped",
		url: "https://webmention.rocks/test/20",
		headers: [],
		body: page(
			20,
			"",
			'This post has a &lt;link&gt; tag <link rel="webmention"> which has no href attribute. Your Webmention client should not find this link tag, and should send the webmention to <a href="/test/20/webmention" rel="webmention">this endpoint</a> instead.',
		),
		endpoint: "https://webmention.rocks/test/20/webmention",
	},
	{
		test: 21,
		description: "The endpoint's query string is kept",
		url: "https://webmention.rocks/test/21",
		headers: [],
		body: page(
			21,
			'<link rel="webmention" href="/test/21/webmention?query=yes">',
			"This post's Webmention endpoint has query string parameters. Your Webmention client must preserve the query string parameters, and not send them in the post body.",
		),
		endpoint: "https://webmention.rocks/test/21/webmention?query=yes",
	},
	{
		test: 22,
		description: "An endpoint relative to the page rather than the host",
		url: "https://webmention.rocks/test/22",
		headers: [],
		body: page(
			22,
			'<link rel="webmention" href="22/webmention">',
			"This post's Webmention endpoint is relative to the page rather than relative to the host.",
		),
		endpoint: "https://webmention.rocks/test/22/webmention",
	},
	{
		test: 23,
		description: "A relative endpoint resolves against the URL after redirects",
		url: "https://webmention.rocks/test/23/page/l2l0Cy3TbHEnkfBRSi6M",
		redirectedFrom: "https://webmention.rocks/test/23/page",
		headers: [["Link", "<webmention-endpoint/K3fVsQtckketRtqymAm2>; rel=webmention"]],
		body: '<div class="h-entry"><h2 class="p-name">Discovery Test #23</h2><p><a href="/test/23/page" class="u-url">permalink</a> <a href="/" class="p-author h-card"><img src="/assets/webmention-rocks-icon.png" alt="Webmention Rocks!"></a></p><p><a rel="webmention" href="webmention-endpoint/K3fVsQtckketRtqymAm2">webmention endpoint</a></p></div>',
		endpoint: "https://webmention.rocks/test/23/page/webmention-endpoint/K3fVsQtckketRtqymAm2",
	},
];
