# Standalone AI 3D comparison

**House brief used in all three tools:** `3 bed, 2 bath, open kitchen, home office, about 1,800 sq ft`

This is the default placeholder in `frontend/src/components/PromptBox.tsx` and the first prompt in `backend/eval/prompts.txt` as of November 8, 2026.

## Files

- `index-chatgpt.html`: standalone ChatGPT scene. Open it directly in a browser; drag to orbit and scroll to zoom.
- `house-plan-chatgpt.png`: ChatGPT plan image.
- `claude-house.html`: standalone Claude scene. Open it directly in a browser; drag to orbit and scroll to zoom.
- `claude-house-source.js`: source used to build the bundled Claude scene.
- `claude_house_plan_view.png` and `claude_house_elevated_view.png`: Claude plan and elevated views.
- `compare.html`: local three-column viewer for BUILD, ChatGPT, and Claude screenshots.
- `CLAUDE_PROMPT.md`: one full task prompt to paste verbatim into fresh ChatGPT and Claude conversations.

## Open the scenes

Open `index-chatgpt.html` or `claude-house.html` directly in a browser. Both are bundled HTML files, so no server or build step is needed. Drag to orbit and scroll to zoom. The scenes are visual concepts and have not passed BUILD's geometry checker or building-code review.

## Compare

1. Enter the house brief above into BUILD and save a screenshot of its 3D view. Record whether the result is live or cached.
2. Paste the **same complete text** from `CLAUDE_PROMPT.md` into fresh ChatGPT and Claude conversations. Save each scene and its actual render. Do not attach this folder or BUILD files to either run.
3. Open `http://localhost:8765/compare.html` and choose the BUILD, fresh ChatGPT, and Claude screenshots. The images stay in your browser; reselect them after a refresh.
4. Compare room count, area, door and hall circulation, visual clarity, editability, and how many manual repairs were needed. Keep each system's output, exact prompt history, and generation time with the screenshots.

**Prompt provenance:** The committed ChatGPT scene below was created after the original user request, two clarifying answers (both image and scene; use the current example prompt), and inspection of BUILD's repository. It was not a response to only the one-line house brief and should not be treated as the controlled ChatGPT result.

The ChatGPT scene uses a 60 × 30 ft footprint (1,800 sq ft), three bedrooms, two baths, one office, and a 4 ft hall. The open kitchen, dining, and living zone occupies the west side. The entrance is on the south side of the living room. These were chosen independently from the brief, without using BUILD's cached layout.
