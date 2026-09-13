<script>
  import { onMount } from "svelte";
  import {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCenter,
    forceCollide,
    scaleLinear,
    zoom as d3zoom,
    zoomIdentity,
    select,
  } from "d3";

  export let people = [];

  const MAX_COMBINATIONS = 50;
  const NODE_RADIUS = 6;
  const NODE_COLOR = "#1c3d5a";
  const LINK_COLOR = "#999";

  let containerWidth = 0;
  let containerHeight = 0;
  let simNodes = [];
  let simLinks = [];
  let simulation = null;
  let svgEl;
  let zoomTransform = zoomIdentity;
  let examinerFilter = "";

  // normalize e.g. "M.D.", "MD", "m d" -> "md" for comparison
  function isMD(degreeName) {
    if (!degreeName) return false;
    return degreeName.replace(/[.\s]/g, "").toLowerCase() === "md";
  }

  // group M.D. degree records by the exact combination of co-examiners (order-independent)
  $: examinerCombinationGroups = (() => {
    const byCombination = new Map();
    people.forEach((p) => {
      (p.study?.degrees || []).forEach((d) => {
        if (!isMD(d.name)) return;
        const names = (d.examiners || [])
          .filter((ex) => ex.forename && ex.surname)
          .map((ex) => `${ex.forename} ${ex.surname}`)
          .sort();
        if (names.length === 0) return;
        const key = names.join(" & ");
        if (!byCombination.has(key)) {
          byCombination.set(key, { examiners: names, records: [] });
        }
        byCombination.get(key).records.push({ person: p, degree: d });
      });
    });
    return Array.from(byCombination.values())
      .sort((a, b) => b.records.length - a.records.length)
      .slice(0, MAX_COMBINATIONS);
  })();

  // only keep groups containing an examiner whose name matches the typed filter
  $: filteredCombinationGroups = examinerFilter.trim()
    ? examinerCombinationGroups.filter((group) =>
        group.examiners.some((name) =>
          name.toLowerCase().includes(examinerFilter.trim().toLowerCase()),
        ),
      )
    : examinerCombinationGroups;

  // one node per examiner, one edge per co-examiner pair (weighted by shared examinations)
  $: graph = (() => {
    const nodeByName = new Map();
    const linkByPair = new Map();

    filteredCombinationGroups.forEach((group) => {
      group.examiners.forEach((name) => {
        if (!nodeByName.has(name)) nodeByName.set(name, { id: name, count: 0 });
        nodeByName.get(name).count += group.records.length;
      });

      for (let i = 0; i < group.examiners.length; i++) {
        for (let j = i + 1; j < group.examiners.length; j++) {
          const [a, b] = [group.examiners[i], group.examiners[j]].sort();
          const key = `${a}|${b}`;
          if (!linkByPair.has(key)) {
            linkByPair.set(key, { source: a, target: b, weight: 0 });
          }
          linkByPair.get(key).weight += group.records.length;
        }
      }
    });

    return {
      nodes: Array.from(nodeByName.values()),
      links: Array.from(linkByPair.values()),
    };
  })();

  const MAX_EDGE_WEIGHT = 16;
  $: linkWidthScale = scaleLinear()
    .domain([1, MAX_EDGE_WEIGHT])
    .range([1, 8])
    .clamp(true);
  // higher weight -> darker (more opaque) edge
  $: linkOpacityScale = scaleLinear()
    .domain([1, MAX_EDGE_WEIGHT])
    .range([0.25, 1])
    .clamp(true);

  function runSimulation() {
    // d3-force mutates node/link objects in place, so clone to avoid mutating `graph`
    simNodes = graph.nodes.map((n) => ({ ...n }));
    simLinks = graph.links.map((l) => ({ ...l }));

    if (simulation) simulation.stop();
    simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink(simLinks)
          .id((d) => d.id)
          .distance(50),
      )
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(containerWidth / 2, containerHeight / 2))
      .force("collide", forceCollide(NODE_RADIUS + 2))
      .on("tick", () => {
        simNodes = simNodes;
        simLinks = simLinks;
      });
  }

  $: if (containerWidth && containerHeight) {
    if (graph.nodes.length) {
      runSimulation();
    } else {
      if (simulation) simulation.stop();
      simNodes = [];
      simLinks = [];
    }
  }

  onMount(() => {
    // d3-zoom needs a real DOM node to attach wheel/drag listeners to; the
    // resulting transform is stored and applied declaratively in the template
    const zoomBehavior = d3zoom()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        zoomTransform = event.transform;
      });
    select(svgEl).call(zoomBehavior);

    return () => simulation?.stop();
  });
</script>

<div
  class="network"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
>
  <input
    type="text"
    class="examiner-filter"
    placeholder="Filter by examiner name…"
    bind:value={examinerFilter}
  />
  <svg bind:this={svgEl} width={containerWidth} height={containerHeight}>
    <g
      transform="translate({zoomTransform.x},{zoomTransform.y}) scale({zoomTransform.k})"
    >
      {#each simLinks as link (link.source.id + "|" + link.target.id)}
        <line
          x1={link.source.x}
          y1={link.source.y}
          x2={link.target.x}
          y2={link.target.y}
          stroke={LINK_COLOR}
          stroke-width={linkWidthScale(link.weight)}
          opacity={linkOpacityScale(link.weight)}
        >
          <title
            >{link.source.id} & {link.target.id}: {link.weight} shared examination{link.weight ===
            1
              ? ""
              : "s"}</title
          >
        </line>
      {/each}
      {#each simNodes as node (node.id)}
        <circle cx={node.x} cy={node.y} r={NODE_RADIUS} fill={NODE_COLOR}>
          <title
            >{node.id}: {node.count} shared M.D. examination{node.count === 1
              ? ""
              : "s"}</title
          >
        </circle>
        <text
          x={node.x + NODE_RADIUS + 3}
          y={node.y}
          dominant-baseline="middle"
          class="node-label">{node.id}</text
        >
      {/each}
    </g>
  </svg>
</div>

<style>
  .network {
    position: relative;
    width: 100%;
    height: 100vh;
  }
  .examiner-filter {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 1;
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .network svg {
    cursor: grab;
    touch-action: none;
  }
  .network svg:active {
    cursor: grabbing;
  }
  .node-label {
    font-size: 10px;
    fill: #333;
    pointer-events: none;
    user-select: none;
  }
</style>
