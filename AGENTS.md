# AGENTS.md

## Project overview

St Andrews Alumni Map — a Svelte + Vite app that visualizes universities
awarding M.D. degrees to St Andrews alumni on a Leaflet map. Data comes from
JSON files in `public/`.

## Setup & environment

- Package manager: **yarn** (do not use npm/pnpm — no other lockfile should
  exist).
- Install: `yarn install`
- Dev server: `yarn dev`
- Build: `yarn build`
- Preview production build: `yarn preview`
- Deploy to GitHub Pages: `yarn deploy` (runs `predeploy` → `build`, then
  `gh-pages -d dist`)

## Project structure

- `src/App.svelte` — main component, renders the Leaflet map and toolbar.
- `src/datastore.js` — data loading layer. Data is fetched with `d3.json`
  (from the `d3` package), not the raw `fetch` API, and exported as plain
  functions for components to import (e.g. `loadPeople()`).
- `public/st_andrews_md.json` — main dataset currently used by the map.
- `public/md_testimonials.json` — additional dataset, not yet wired up to any
  view.
- `vite.config.js` sets `base: '/st_andrews_md/'` for the GitHub Pages
  project site at `tvancisin/st_andrews_md`.

## Code style

- **Svelte reactivity:** use the classic `$:` reactive statement notation,
  not Svelte 5 runes (`$state`, `$derived`, etc.). Keep components in legacy
  (non-runes) mode.
- **D3 + Svelte usage:** DOM elements (svg, g, circle, path, etc.) are
  written declaratively in Svelte markup, not created imperatively with D3
  selections. Do not use `d3.select(...).append(...).attr(...)` chains to
  build the chart's DOM — use D3 only for the non-DOM math: scales, shape
  generators (`d3.line`, `d3.arc`, ...), layouts, and data transforms. Bind
  the computed values into `<svg>`/`<g>`/`<path>` etc. with normal Svelte
  attribute/expression syntax.

  Anti-pattern (avoid):
  ```js
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  ```

  Preferred:
  ```svelte
  <svg {width} {height}>
    <g>
      {#each points as p}
        <circle cx={xScale(p.x)} cy={yScale(p.y)} r={4} />
      {/each}
    </g>
  </svg>
  ```
- **Responsive sizing:** track the chart container's size with
  `bind:clientWidth`/`bind:clientHeight` on a wrapping element, and feed
  those reactive values into D3 scales/layouts to size and lay out the
  chart. Never use `viewBox` for responsiveness — width/height must come
  from the bound container dimensions.
- Data loading belongs in `src/datastore.js`, not inline in components —
  components import loader functions rather than calling `fetch`/`d3.json`
  directly.

## Notes for agents

- No test suite exists yet.
- No TypeScript — plain `.js`/`.svelte` files.
