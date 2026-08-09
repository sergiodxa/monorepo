# The authenticated account area, proven end to end against the live server. Where
# account.spec asserts only the anonymous guard (every route redirects a signed-out
# visitor to the sign-in page), these tests sign in through the real credential form
# and assert the content and state changes behind that guard. They sign in as the
# fixed `spec-user@spec.test` account, registered on the first run and signed in on
# every run after. Assertions read the immutable email, never a mutated field, so no
# test depends on another's writes; `eventually` absorbs the post-submit redirect.

# POST /authorize (the credential happy path) — signing in lands on the account area.
test "signing in with valid credentials lands on the authenticated account area" {
	when {
		login "spec-user@spec.test" "correct horse battery"
	}
	then {
		eventually {
			expect browser.url "http://localhost:3002/account/sessions"
			expect browser.text "Your current session"
		}
	}
}

# GET /account/profile — the page shows the signed-in subject their own identity.
test "GET /account/profile shows the signed-in subject their own email" {
	given {
		login "spec-user@spec.test" "correct horse battery"
	}
	when {
		browser.navigate "http://localhost:3002/account/profile"
	}
	then {
		eventually {
			expect browser.heading "Your Profile"
			expect browser.text "spec-user@spec.test"
		}
	}
}

# POST /account/profile/edit — a changed display name is saved and shown afterwards.
# The edit form is pre-filled from the database, so submitting with only the display
# name changed keeps the other required fields; the save redirects back to the
# read-only profile, which then renders the new value.
test "POST /account/profile/edit saves a changed display name and shows it" {
	given {
		login "spec-user@spec.test" "correct horse battery"
	}
	when {
		browser.navigate "http://localhost:3002/account/profile/edit"
		browser.fill textbox "Display Name" with "Spec Edited Name"
		browser.click button "Save Changes"
	}
	then {
		eventually {
			expect browser.url "http://localhost:3002/account/profile"
			expect browser.text "Spec Edited Name"
		}
	}
}

# GET /account/sessions — the signed-in subject's own live session is listed.
test "GET /account/sessions lists the current session" {
	given {
		login "spec-user@spec.test" "correct horse battery"
	}
	when {
		browser.navigate "http://localhost:3002/account/sessions"
	}
	then {
		eventually {
			expect browser.heading "Sessions"
			expect browser.text "Your current session"
		}
	}
}

# GET /account/grants — the authorized-apps list renders, and the sign-in above
# created a grant for the auth server's own client, so it is the populated state
# (not the "No authorized apps found." empty state).
test "GET /account/grants lists the app the sign-in authorized" {
	given {
		login "spec-user@spec.test" "correct horse battery"
	}
	when {
		browser.navigate "http://localhost:3002/account/grants"
	}
	then {
		eventually {
			expect browser.heading "Authorized Apps"
			expect browser.text "Auth by Sergio Xalambrí"
		}
	}
}

# form /oidc/logout (interactive) — the account layout's Logout button ends the
# session, so a protected page then falls back to the sign-in screen. The Logout
# click also answers with a redirect chain that clears the cookie; the read-only URL
# observations let it finish before the protected-page navigation, which would
# otherwise abort it (see the `login` command).
test "logging out returns a protected page to the sign-in screen" {
	given {
		login "spec-user@spec.test" "correct horse battery"
	}
	when {
		browser.navigate "http://localhost:3002/account/sessions"
		browser.click button "Logout"
		browser.url
		browser.url
		browser.navigate "http://localhost:3002/account/profile"
	}
	then {
		assert_on_sign_in_page
	}
}
