# Work Log

## 2026-04-20

- Base commit: `3adb8d0` (`claude_limit_exceeded`)
- Previous in-progress work was continued from the user's interrupted Claude session.
- Follow-up implementation and UI polish in this entry were completed by `ChatGPT` (OpenAI Codex).

### Summary

- Removed reliance on the old `rails`, `selection`, and KPI-side DOM structure in the active 3-column layout.
- Kept the right-side layer/task layout and moved segment detail rendering into the layer panel.
- Added a new crop status panel that shows:
  - `꽃 2,102개`
  - `안익음 30,113개`
  - `덜익음 12,013개`
  - `익음 5,020개`
- Added a styled 30-day demo trend chart for the crop status panel.
- Fixed crop summary card overflow so cards do not break out of the sidebar layout.
- Changed crop summary cards to a single-line content layout.
- Reduced vertical density in the right-side task cards to make the "오늘 할 일" list more compact.
- Forced task titles such as `생육 정체 구간 즉시 점검` to render on a single line with ellipsis instead of wrapping.

### Verification

- Checked patch formatting with `git diff --check`.
- Verified the app server boots and that `/`, `/api/devices`, `manifest`, `layers`, and `tasks` endpoints respond.
