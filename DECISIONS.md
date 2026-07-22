# Portal Decisions Log

Chronological record of notable decisions in the client-portal repo. Newest first.

---

## 2026-07-22 — Approval preview link uses the staging `working_url`

**What:** In `ApprovalSection` (the "Your site is ready to review" card, shown only at the `Client Review` stage), the "View site preview" link now resolves from `project.working_url` first, falling back to the client's live `domain`:

```
previewUrl = project.working_url || client.domain
```

If neither is set, the approval card shows a placeholder ("Your preview link is being prepared…") and **hides the approve controls** instead of offering an approve button with no viewable site.

**Why:** At Client Review the built site lives on the team's staging URL (`working_url`, e.g. a Wix Studio URL) — the client's live `domain` usually doesn't have the new site yet and is often null. Under the previous code (`previewUrl = client.domain`), clients whose `domain` was null saw **no preview link at all** yet could still approve — i.e. approving a site they couldn't see. At the time of this change, 2 of 3 live Client-Review clients (Nordiska Build, Abbeysure) had `working_url` set and `domain` null, so they were getting no preview link.

**Consequence to know:** A client can no longer approve until a preview URL exists. Delivery must populate `projects.working_url` (already maintained on the dashboard Delivery page) before the client can preview/approve.

**Provenance:** Shipped from previously-uncommitted local WIP that had no prior documentation; this entry and the commit are its first record. `working_url` is already returned to the portal by the dashboard API (`api/projects.js`, the `client_id` GET).
