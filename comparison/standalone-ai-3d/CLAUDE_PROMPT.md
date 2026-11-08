# Identical prompt for ChatGPT and Claude

Copy the **exact same text below** into a new ChatGPT conversation and a new Claude conversation. Attach no BUILD layout JSON, screenshots, or source files to either. Use the same model settings, tools, and time allowance where the services let you control them. Save both responses and record any follow-up prompts.

The ChatGPT scene already in this folder was made during a repository-aware coding task: ChatGPT saw the user's request for both an image and a runnable scene and inspected BUILD's example prompt, contracts, and demo material. It is an exploratory example, **not** the result of entering only the short house brief. Rerun ChatGPT with the text below for a controlled comparison with Claude.

```text
I want to compare what you can make from one natural-language house brief against a separate home-design app. Work from this brief alone:

"3 bed, 2 bath, open kitchen, home office, about 1,800 sq ft"

Create both of these deliverables:
1. A runnable, interactive 3D scene of your proposed single-story house, with rooms, walls, visible door openings, an entrance, and simple furnishings for scale. Let me orbit and zoom the view. Give me complete files and exact instructions to run them locally. Prefer a standalone HTML file or a small folder with no paid services or API keys.
2. A PNG image showing the actual scene you created, from a view where the full layout and room arrangement are legible. If you can run/render the scene in your environment, create and attach the image. If you cannot, say so plainly and tell me exactly how to export the PNG from the scene; do not substitute an unrelated concept image.

Also include your room dimensions and positions in feet, total footprint area, and a short explanation of circulation (front door to each room). Do your own spatial layout from the brief. Do not use an existing BUILD layout or assume you have access to its geometry solver or rule checker. Label any assumptions and any rules you have not verified.
```

For a fair visual comparison, run both scenes at a similar viewport size and use a top-down cutaway or elevated view where the whole house is visible. BUILD's example prompt is copied verbatim; the extra instructions above define the comparison artifacts, not additional house requirements.
