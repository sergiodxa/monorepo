# The one genuinely-reused block. Every guard on this server answers an
# anonymous visitor by redirecting to `/authorize`, which renders the sign-in
# page; the `http`/`browser` capabilities follow that redirect chain, so a
# guarded page and the bare `/` both land here. These two controls are always
# present on that page regardless of the `prompt` the request carried, so they
# are the stable markers that a redirect ended on sign-in rather than anywhere
# else. Open the URL in the test's `when`, then call this in its `then`.
command assert_on_sign_in_page() {
	expect browser.button "Login with GitHub"
	expect browser.link "Forgot your password?"
}
