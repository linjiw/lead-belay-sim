# Repository Guidelines

## Project Structure & Module Organization
This repository is a pure static web app with a flat root layout. `index.html` is the page shell, `styles.css` holds responsive UI styles, `app.js` manages DOM state and canvas rendering, `physics.js` contains the simulator core, and `presets.js` defines field metadata and preset scenarios. Automated checks live in `test.js` plus focused files such as `test-trends.js` and `test-multidraw.js`. Design notes are in `DESIGN.md` and `DESIGN_MULTI_DRAW.md`; manual validation steps are in `tests.md`.

## Build, Test, and Development Commands
There is no build step. Use one of these local workflows:

- `python3 -m http.server 8080` serves the app locally at `http://localhost:8080`.
- Open `index.html` directly for quick UI checks.
- `npm test` runs the full Node-based sanity suite via `test.js`.
- `npm run test:trends` checks physical trend expectations.
- `npm run test:constraints` checks geometry/contact constraints.
- `npm run test:output` validates summary metrics.
- `npm run test:multidraw` exercises the multi-draw rope-drag model.

## Coding Style & Naming Conventions
Use the existing ES module style: 2-space indentation, semicolons, and single quotes. Keep simulation logic in `physics.js` and UI-only behavior in `app.js`. Prefer small helper functions and explicit parameter names. Use `camelCase` for variables and functions; keep filenames lowercase and descriptive. New targeted tests should follow the existing `test-<area>.js` pattern.

## Testing Guidelines
Tests use plain Node execution with inline assertions, not a test framework. When adding coverage, create or update a focused `test-*.js` file and import it from `test.js` so `npm test` stays comprehensive. Favor trend and invariant checks over brittle numeric snapshots. For UI or mobile layout changes, also walk through the checklist in `tests.md`.

## Commit & Pull Request Guidelines
Recent history uses short, imperative, sentence-case subjects such as `Add charts and stronger simulator test coverage` and `Restore GitHub Pages workflow`. Follow that pattern and keep commits scoped to one change. PRs should summarize the behavior change, list the commands you ran, call out affected presets/tests, and include screenshots or a short GIF for visible UI/canvas changes.

## Security & Publishing Notes
This project is deployed as a public static site through `.github/workflows/deploy-lead-belay-pages.yml`. Keep asset paths relative, and do not add secrets, private notes, or machine-specific data to the published files.
