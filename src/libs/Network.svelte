<script>
  import {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceX,
    forceY,
    forceCollide,
    scaleLinear,
  } from "d3";
  import { buildExaminerGraph } from "./examinerGraph.js";

  export let people = [];

  const NODE_RADIUS = 6;
  const NODE_COLOR = "#1c3d5a";
  const LINK_COLOR = "#999";
  const CENTER_STRENGTH = 0.04;

  let containerWidth = 0;
  let containerHeight = 0;
  let simNodes = [];
  let simLinks = [];
  let simulation = null;
  let examinerFilter = "";

  $: graph = buildExaminerGraph(people, examinerFilter);

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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function runSimulation() {
    // d3-force mutates node/link objects in place, so clone to avoid mutating `graph`
    simNodes = graph.nodes.map((n) => ({ ...n }));
    simLinks = graph.links.map((l) => ({ ...l }));

    // size the forces to the available area so the layout fits instead of
    // being pushed against (and clamped at) the container edges
    const spacing = Math.sqrt(
      (containerWidth * containerHeight) / simNodes.length,
    );
    const aspect = containerWidth / containerHeight;

    if (simulation) simulation.stop();
    simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink(simLinks)
          .id((d) => d.id)
          .distance(clamp(spacing * 0.5, 20, 120)),
      )
      .force(
        "charge",
        forceManyBody()
          .strength(-spacing)
          .distanceMax(spacing * 4),
      )
      // pull toward the center, more strongly along the shorter axis
      .force(
        "x",
        forceX(containerWidth / 2).strength(
          CENTER_STRENGTH * Math.min(1, 1 / aspect),
        ),
      )
      .force(
        "y",
        forceY(containerHeight / 2).strength(
          CENTER_STRENGTH * Math.min(1, aspect),
        ),
      )
      .force("collide", forceCollide(NODE_RADIUS + 2))
      .on("tick", () => {
        // hard limit: keep every node (including its radius) inside the container
        simNodes.forEach((n) => {
          const x = clamp(n.x, NODE_RADIUS, containerWidth - NODE_RADIUS);
          const y = clamp(n.y, NODE_RADIUS, containerHeight - NODE_RADIUS);
          if (x !== n.x) n.vx = 0;
          if (y !== n.y) n.vy = 0;
          n.x = x;
          n.y = y;
        });
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
  <svg width={containerWidth} height={containerHeight}>
    <g>
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
    height: 100%;
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
  .node-label {
    font-size: 10px;
    fill: #333;
    pointer-events: none;
    user-select: none;
  }
</style>
