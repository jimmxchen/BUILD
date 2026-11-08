# Standalone AI 3D comparison

**House brief used in all three tools:** `3 bed, 2 bath, open kitchen, home office, about 1,800 sq ft`

This is the default placeholder in `frontend/src/components/PromptBox.tsx` and the first prompt in `backend/eval/prompts.txt` as of November 8, 2026.

## Files

- `index.html` + `scene.js` + `layout.json`: a one-shot ChatGPT-designed interactive cutaway house. It uses only browser Canvas and has no BUILD runtime dependency.
- `chatgpt-house-3d.png`: image captured from that scene at the default camera angle.
- `compare.html`: local three-column viewer for BUILD, ChatGPT, and Claude screenshots.
- `CLAUDE_PROMPT.md`: paste-ready independent task for Claude.

## View the ChatGPT scene

From this folder, run `python3 -m http.server 8765`, then open `http://localhost:8765`. Drag to orbit, scroll to zoom, and use **Save PNG** to export the current view. The scene is a visual concept. It has not passed BUILD's geometry checker or any building-code review.

## Compare

1. Enter the house brief above into BUILD and save a screenshot of its 3D view. Record whether the result is live or cached.
2. Open this scene and image at a similar viewport size.
3. Paste `CLAUDE_PROMPT.md` into a new Claude conversation and save Claude's scene and rendered image.
4. Open `http://localhost:8765/compare.html` and choose the BUILD and Claude screenshots. The images stay in your browser; reselect them after a refresh.
5. Compare room count, area, door and hall circulation, visual clarity, editability, and how many manual repairs were needed. Keep each system's output and generation time with the screenshots.

The ChatGPT scene uses a 60 × 30 ft footprint (1,800 sq ft), three bedrooms, two baths, one office, and a 4 ft hall. The open kitchen, dining, and living zone occupies the west side. The entrance is on the south side of the living room. These were chosen independently from the brief, without using BUILD's cached layout.
