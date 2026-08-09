# form /verify-email — the page an email-verification link opens, split across
# its two methods on purpose: GET only *reads* the token (a mailbox is scanned by
# link-checkers and previewers that would otherwise burn a single-use link), and
# POST is the button that actually spends it. Every way a token can fail — expired,
# spent, malformed, wrong address — collapses to the same "this link no longer
# works" page, on either method, so the two are indistinguishable to a holder.
#
# seeded happy path: an unspent token renders "Confirm your email address" on GET
# and, when its button is pressed, "Email address confirmed" on POST. Reaching one
# needs a freshly-minted token, so both tests below assert the no-token outcome.

# GET with no token: the request is well-formed but carries nothing to verify, so
# it renders the invalid-link page — and, crucially, writes nothing, so the URL
# stays safe to fetch any number of times.
test "GET /verify-email shows the invalid-link page when no token is present" {
	when {
		browser.open "http://localhost:3002/verify-email"
	}
	then {
		expect browser.heading "This link no longer works"
	}
}

# POST with no token: a bodyless submission fails the form schema and renders the
# same invalid-link page, at a 400.
test "POST /verify-email rejects a submission carrying no token" {
	when {
		let result = http.post "http://localhost:3002/verify-email"
	}
	then {
		expect result.status 400
		expect result.ok false
	}
}
