# Quark reference adaptation notes

The user supplied `Quark.zip` as the visual and interaction reference for the MPLAD Guardian frontend redesign. The reference uses a government portal composition: dark utility strip, tall white programme header, sticky deep-blue navigation, textured blue hero, gold accent, white bordered cards, table-driven work areas, a blue metric band, and restrained lift/fade motion.

The Guardian redesign preserves the existing FastAPI workflows while adapting these patterns. It uses a short session-only intro curtain rather than Quark’s multi-second splash; a long blocking splash would interfere with the secure analyst workflow. The reference’s provided layered hero asset is stored outside the project source and is served through the approved static asset URL used in the hero.

| Reference pattern | Guardian adaptation |
|---|---|
| Government top bar and programme header | Secure monitoring strip, MPLAD Guardian programme mark, signed-in user chip, API documentation, and sign-out action. |
| Sticky blue navigation with mobile menu | Role-aware links for overview, projects, imports, alerts, allocation context, models, and analyst management. |
| Hero section and service-status card | Audit-intelligence proposition, call-to-actions, and live FastAPI connection status. |
| Bordered table/cards and blue metric band | Project register, alert queue, model operations, imports, allocation context, and case review screens without changing FastAPI calls. |
| Animated hero and splash | Short opacity/transform intro, card lift buttons, workspace enter animation, and reduced-motion support. |

The Quark reference is an input-design source, not a replacement data model. MPLAD Guardian retains its own provenance, reviewer-action, role-based access, and non-fraud interpretation requirements.

## Deployment verification note

Before the redesign was published, the GitHub Pages production site correctly reached the allowed Render origin and displayed its signed-out secure-workspace status. The redesigned portal was verified against the local preview at desktop and mobile widths. Its source changes remain to be published through the existing GitHub Pages workflow.
