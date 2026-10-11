<script>
  import { scalePoint, scaleLinear, scaleSqrt, extent } from "d3";
  import { buildExaminerGraph } from "./examinerGraph.js";

  export let people = [];

  const MARGIN = { top: 16, right: 16, left: 16 };
  const MIN_NODE_RADIUS = 3;
  const MAX_NODE_RADIUS = 8;
  const LABEL_CHAR_WIDTH = 5.5;
  const MAX_LABEL_SHARE = 0.4; // labels never take more than this share of the height
  const MAX_EDGE_WEIGHT = 16;
  const NODE_COLOR = "#1c3d5a";
  const ARC_COLOR = "#1c3d5a";
  const HIGHLIGHT_COLOR = "#d9822b";
  const AXIS_COLOR = "#999";

  let containerWidth = 0;
  let containerHeight = 0;
  let hoveredId = null;

  $: graph = buildExaminerGraph(people);
  // $: console.log(graph);

  // number of distinct examiners each examiner has sat with
  $: degreeById = (() => {
    const degree = new Map(graph.nodes.map((n) => [n.id, 0]));
    graph.links.forEach((l) => {
      degree.set(l.source, degree.get(l.source) + 1);
      degree.set(l.target, degree.get(l.target) + 1);
    });
    return degree;
  })();

  // most connected examiner first, then most examinations, then alphabetical
  $: nodes = [...graph.nodes]
    .map((n) => ({ ...n, degree: degreeById.get(n.id) }))
    .sort(
      (a, b) =>
        b.degree - a.degree || b.count - a.count || a.id.localeCompare(b.id),
    );

  $: neighborsById = (() => {
    const neighbors = new Map(graph.nodes.map((n) => [n.id, new Set()]));
    graph.links.forEach((l) => {
      neighbors.get(l.source).add(l.target);
      neighbors.get(l.target).add(l.source);
    });
    return neighbors;
  })();

  // heavier links first so thin ones stay visible on top
  $: links = [...graph.links].sort((a, b) => b.weight - a.weight);

  // room under the axis for the rotated names
  $: longestLabel = Math.max(0, ...nodes.map((n) => n.id.length));
  $: labelSpace = Math.min(
    containerHeight * MAX_LABEL_SHARE,
    longestLabel * LABEL_CHAR_WIDTH + MAX_NODE_RADIUS + 12,
  );
  $: axisY = containerHeight - labelSpace;
  $: arcAreaHeight = Math.max(axisY - MARGIN.top - MAX_NODE_RADIUS, 0);
  $: innerWidth = Math.max(containerWidth - MARGIN.left - MARGIN.right, 0);

  $: xScale = scalePoint()
    .domain(nodes.map((n) => n.id))
    .range([MARGIN.left, MARGIN.left + innerWidth])
    .padding(0.5);
  $: radiusScale = scaleSqrt()
    .domain(extent(nodes, (n) => n.degree))
    .range([MIN_NODE_RADIUS, MAX_NODE_RADIUS]);
  $: widthScale = scaleLinear()
    .domain([1, MAX_EDGE_WEIGHT])
    .range([1, 8])
    .clamp(true);
  $: opacityScale = scaleLinear()
    .domain([1, MAX_EDGE_WEIGHT])
    .range([0.25, 0.9])
    .clamp(true);

  // half-ellipse over the axis; squashed vertically only if the widest arc
  // (a half circle spanning the full width) wouldn't fit in the available height
  $: squash =
    innerWidth > 0 ? Math.min(1, arcAreaHeight / (innerWidth / 2)) : 0;
  // computed here (not in the template) so the paths update once the container is measured
  $: arcs = links.map((link) => {
    const x1 = xScale(link.source);
    const x2 = xScale(link.target);
    const rx = Math.abs(x2 - x1) / 2;
    const ry = rx * squash;
    return {
      ...link,
      d: `M${Math.min(x1, x2)},${axisY} A${rx},${ry} 0 0,1 ${Math.max(x1, x2)},${axisY}`,
    };
  });

  function isConnected(link, id) {
    return link.source === id || link.target === id;
  }

  function arcOpacity(link, id) {
    if (id === null) return opacityScale(link.weight);
    return isConnected(link, id) ? 1 : 0.04;
  }

  function nodeOpacity(node, id) {
    if (id === null || node.id === id) return 1;
    return neighborsById.get(id).has(node.id) ? 1 : 0.3;
  }
</script>

<div
  class="arc-diagram"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
>
  <svg width={containerWidth} height={containerHeight}>
    <line
      x1={MARGIN.left}
      y1={axisY}
      x2={MARGIN.left + innerWidth}
      y2={axisY}
      stroke={AXIS_COLOR}
    />

    {#each arcs as link (link.source + "|" + link.target)}
      <path
        d={link.d}
        fill="none"
        stroke={hoveredId !== null && isConnected(link, hoveredId)
          ? HIGHLIGHT_COLOR
          : ARC_COLOR}
        stroke-width={widthScale(link.weight)}
        opacity={arcOpacity(link, hoveredId)}
      >
        <title
          >{link.source} & {link.target}: {link.weight} shared examination{link.weight ===
          1
            ? ""
            : "s"}</title
        >
      </path>
    {/each}

    {#each nodes as node (node.id)}
      <g
        opacity={nodeOpacity(node, hoveredId)}
        on:mouseenter={() => (hoveredId = node.id)}
        on:mouseleave={() => (hoveredId = null)}
        role="presentation"
      >
        <circle
          cx={xScale(node.id)}
          cy={axisY}
          r={radiusScale(node.degree)}
          fill={hoveredId === node.id ? HIGHLIGHT_COLOR : NODE_COLOR}
        >
          <title
            >{node.id}: {node.degree} connection{node.degree === 1 ? "" : "s"}, {node.count}
            M.D. examination{node.count === 1 ? "" : "s"}</title
          >
        </circle>
        <text
          transform="translate({xScale(node.id)},{axisY +
            MAX_NODE_RADIUS +
            6}) rotate(90)"
          dominant-baseline="middle"
          class="node-label"
          class:hovered={hoveredId === node.id}>{node.id}</text
        >
      </g>
    {/each}
  </svg>
</div>

<style>
  .arc-diagram {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .node-label {
    font-size: 10px;
    fill: #333;
    user-select: none;
  }
  .node-label.hovered {
    font-weight: bold;
  }
</style>
