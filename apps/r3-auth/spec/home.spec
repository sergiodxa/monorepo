# GET / — the site root. There is no landing page: the root exists only to send
# a visitor into the authorization flow, so a plain visit redirects (303) to
# `/authorize`, which for an anonymous browser parks a self-authorization
# request and renders the sign-in page. A real browser follows that whole chain,
# so opening `/` must end on the sign-in page.

test "GET / sends an anonymous visitor into the sign-in flow" {
	when {
		browser.open "http://localhost:3002/"
	}
	then {
		assert_on_sign_in_page
	}
}
