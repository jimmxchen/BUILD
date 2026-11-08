# Walkthru

**Describe a home. Get a floor plan you can inspect, edit, and walk through.**

Walkthru turns a plain-language housing brief into a rule-checked layout and an interactive 3D walkthrough. It is built for people who have ideas for a home but need a quick way to see whether those ideas fit together before taking them to a designer or architect.

## The problem

Planning a home from a written brief is hard. Rooms can overlap, doors can miss their walls, bedrooms can lack windows, and a plan that looks plausible may still be difficult to navigate. A static drawing also makes it hard to understand how rooms connect.

## What Walkthru does

1. **Describe the home** in everyday language, such as “3 bed, 2 bath, open kitchen, home office, about 1,800 sq ft.”
2. **Generate a room program.** Claude proposes rooms, target sizes, and relationships.
3. **Place the rooms.** A geometry solver lays out the rooms and openings.
4. **Check the plan.** Walkthru checks geometry, circulation, room sizes, bedroom windows, and whether the plan matches the request. Failed checks can be sent back through a repair loop.
5. **Explore and edit.** Review the 2D plan, move through the home in 3D, and request changes in plain language.

The backend and frontend share one layout format. See [the layout contract](docs/CONTRACTS.md) for its fields and conventions.

## Evaluation

In one recorded run of 30 prompts, direct Claude geometry failed at least one layout check on **22 of 30 plans (73.3%)**. The Walkthru planner, solver, and repair loop produced **0 failing plans out of 30** under the same checker. The run used Claude Opus 5.5 at low effort; details and per-prompt results are in [`docs/eval/`](docs/eval/README.md).

This measures compliance with the project’s implemented rules on that prompt set. It is not a measure of architectural quality, construction readiness, or building-code compliance. The pipeline’s checker also guides its repair loop, so the 0% result shows that the pipeline can enforce its own checks; it does not independently prove that every rule is complete or correct.

## Run Walkthru locally

### Requirements

- Python 3.11 or newer
- Node.js 20 or newer and npm
- An Anthropic API key for live generation; the offline mode works without one

### 1. Start the backend

In a terminal from the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

For live generation, set your Anthropic key in this terminal and start the API:

```bash
export ANTHROPIC_API_KEY="your-key"
uvicorn walkthru.api:app --reload --port 8000
```

To run without an API key, use the canned sample plan instead:

```bash
WALKTHRU_OFFLINE=1 uvicorn walkthru.api:app --reload --port 8000
```

### 2. Start the frontend

In a second terminal from the repository root:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend uses the backend at `http://localhost:8000` by default. To use another API address, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` and restart the frontend.

Photoreal rendering and the on-site map view are optional and need additional service credentials. The core planner, 2D plan, and walkthrough do not require those integrations.

## Run the checks

From `backend/`, with the virtual environment active:

```bash
pytest -q
```

To rerun the 30-prompt model evaluation, set `ANTHROPIC_API_KEY` and run:

```bash
python -m eval.run_eval --mode both --n 30
```

The evaluation makes live model calls and may produce different results on another run.

## Project structure

- `backend/walkthru/` — planner, geometry solver, rule checker, API, and generation pipeline
- `backend/eval/` — evaluation prompts and runner
- `frontend/` — Next.js application, plan view, and 3D walkthrough
- `shared/sample_layout.json` — example layout using the shared data format
- `docs/` — product requirements, layout contract, demo notes, and evaluation results

## Current limitations

Walkthru is a design exploration tool, not a substitute for an architect, engineer, survey, permitting review, or code check. Its rules cover selected geometric and prompt requirements; they do not represent all accessibility, structural, environmental, or local building requirements.

## License

No license has been added yet. Contact the project maintainers before reusing this code outside the project.
