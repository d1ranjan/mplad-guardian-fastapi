# Quark rebuild validation notes

## Reference alignment observed

The corrected local landing page now follows the supplied Quark composition: a black government utility strip, tall white programme header, sticky deep-blue navigation with **Home / About MPLAD / Monitoring / AI Risk Detection / Analytics / Reports / Contact**, a large dark-blue hero, notice strip, service grid, two-column introduction, blue statistics band, project table, AI review section, analytics, personas, reports, contact/login area, and three-column footer. The full staged Quark-style opening sequence is present. The authenticated workspace now uses dedicated Quark dashboard compositions for the live project register, import/validation centre, alert queue, alert cases, allocation dashboard, allocation cases, model operations, and analyst account management—while retaining their existing FastAPI operations.

## Local preview caveat

The managed preview domain is not in the deliberately restricted Render CORS allow-list. Its public landing page therefore showed `Failed to fetch` in the health status after the retry sequence, while the API remains healthy and permits the GitHub Pages origin. This is a preview-origin limitation rather than a blank-page or production GitHub Pages failure; production must be verified at `https://d1ranjan.github.io/mplad-guardian-fastapi/` after publication.

The published GitHub Pages revision `f2802da` loaded the full staged opening animation and the post-animation Quark portal structure successfully. An unsigned visitor then received the expected refresh-token rejection after the health check; the frontend now keeps the successful service state and displays a clear sign-in prompt rather than presenting that expected unauthenticated response as a service failure.

The final production revision `a8ee45f` was published successfully by the GitHub Pages workflow. Its public page completed the staged opening sequence, rendered the Quark-style utility bar, programme header, navigation, hero, notice strip, service sections, secure access card, and footer without a blank page, and displayed: `mplad-guardian-fastapi is available. Sign in to access the secure workspace.` The same page composition had already been checked at the mobile breakpoint; protected views retain their role-gated FastAPI operations and require an authorised analyst account for live action validation.
