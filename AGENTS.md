<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:mixpanel-agent-rules -->
# Analytics Tracking — Mixpanel

This project uses GA4 and Mixpanel for product analytics. GA4 event helpers live in `lib/gtag.ts`; Mixpanel mirrors those same events through `lib/mixpanel.ts`. Do not import `mixpanel-browser` directly in feature files. Add or adjust events through the shared helpers so GA4 and Mixpanel stay aligned.

## Tech Stack

| Detail | Value |
|---|---|
| Platform | Next.js web app |
| Mixpanel SDK | `mixpanel-browser` |
| SDK version | `^2.78.0` |
| Tracking method | Client-side SDK, mirrored from GA4 helper calls |
| CDP | None found in the codebase |
| Consent required | Not confirmed. If this product serves EU/EEA/UK/CH or California users, add a consent gate before production tracking. |
| Mixpanel project token location | `.env.local` and Vercel env: `NEXT_PUBLIC_MIXPANEL_TOKEN` |

## Mixpanel Initialization

Mixpanel initializes lazily in `lib/mixpanel.ts` the first time a tracked event or identity call runs. It uses `NEXT_PUBLIC_MIXPANEL_TOKEN`, registers stable super properties (`app`, `environment`), and omits properties whose value is `undefined`.

Do not initialize Mixpanel in multiple places. Keep `track_pageview` disabled unless page-view analysis is explicitly added.

## Identity

Identity is managed in `context/AuthContext.tsx`.

| Action | When | Location |
|---|---|---|
| `mixpanel.identify(user.id)` | On session restore and `SIGNED_IN` | `identifyMixpanelUser()` |
| `mixpanel.people.set()` | After identify, with non-PII profile properties | `identifyMixpanelUser()` |
| `mixpanel.reset()` | On `SIGNED_OUT` and explicit `signOut()` | `AuthProvider` |

Use Supabase `user.id` as the stable Mixpanel user ID. Do not send email, phone, full name, or other PII as event properties.

## Current Tracking Plan

Value Moment: `question_generate_success`, fired after questions are successfully generated.

| Event | Trigger | Key Properties |
|---|---|---|
| `landing_visit` | Landing page loads | none |
| `returning_visit` | Browser has visited before in a previous session | none |
| `landing_cta_click` | User clicks the landing CTA | none |
| `landing_section_view` | Landing section is viewed | `section` |
| `question_input_focus` | Question/source input receives focus | context properties |
| `example_topic_select` | User selects an example topic | `topic_index`, topic metadata |
| `question_generate_request` | User requests question generation | source/input metadata |
| `question_generate_success` | Question generation succeeds | source metadata, `question_count`, `reflection_count` |
| `question_generate_failure` | Question generation fails | source/error metadata |
| `question_regenerate_request` | User requests regeneration | none |
| `question_regenerate_success` | Regeneration succeeds | `question_count`, `reflection_count` |
| `question_regenerate_failure` | Regeneration fails | none |
| `token_exhausted` | API token exhaustion is detected | `flow`, `signed_in` |
| `result_summary_toggle` | User expands/collapses summary | `expanded` |
| `result_reflection_toggle` | User expands/collapses another person's reflection | `expanded`, question metadata |
| `question_save_intent` | User tries to save a generated question | `signed_in`, `question_index` |
| `question_save` | Question save succeeds | `question_index` |
| `question_unsave` | Question unsave succeeds | `question_index` |
| `feedback_open` | Feedback modal opens | context properties |
| `feedback_rating_select` | User selects a star rating | `rating` |
| `feedback_submit_success` | Feedback submission succeeds | feedback metadata |
| `feedback_submit_failure` | Feedback submission fails | error/context metadata |
| `login_prompt_view` | Login prompt is shown | `context` |
| `login_start` | OAuth login starts | `method` |
| `login` | Login succeeds, GA4-compatible event | `method` |
| `login_success` | Login succeeds | `method` |
| `bgm_toggle` | User toggles BGM | BGM state properties |
| `profile_tab_select` | User switches profile tab | `tab` |
| `profile_history_toggle` | User expands/collapses saved history item | `expanded` |
| `profile_history_view` | User reaches profile history | none |

## Adding Events

Use `snake_case` event and property names. Track after the user action succeeds, not before. Prefer specific event names over generic button-click events. Update this file whenever a new Mixpanel event is added.
<!-- END:mixpanel-agent-rules -->
