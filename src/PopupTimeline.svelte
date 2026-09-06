<script>
  import { scaleLinear, scaleSqrt, max } from "d3";

  export let entries = [];

  const START_YEAR = 1580;
  const END_YEAR = 1920;
  const BAR_AREA_HEIGHT = 28;
  const BAR_COLOR = "#1c3d5a";
  const AXIS_COLOR = "#999";
  const MARGIN = { top: 10, right: 4, bottom: 20, left: 18 };

  let width = 0;

  // aggregate entries by their "from" year before rendering
  $: counts = (() => {
    const byYear = new Map();
    entries.forEach((e) => {
      const year = parseInt(e.from, 10);
      if (!Number.isFinite(year)) return;
      byYear.set(year, (byYear.get(year) || 0) + 1);
    });
    return Array.from(byYear, ([year, count]) => ({ year, count }));
  })();

  $: maxCount = max(counts, (d) => d.count) || 1;
  $: innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  $: height = MARGIN.top + BAR_AREA_HEIGHT + MARGIN.bottom;
  $: xScale = scaleLinear()
    .domain([START_YEAR, END_YEAR])
    .range([0, innerWidth]);
  $: yScale = scaleSqrt().domain([0, maxCount]).range([0, BAR_AREA_HEIGHT]);
  $: barWidth =
    innerWidth > 0 ? Math.max(innerWidth / (END_YEAR - START_YEAR), 1) : 0;
  $: xTicks = xScale.ticks(5);
  $: yTicks = yScale.ticks(2);
</script>

<div class="popup-timeline" bind:clientWidth={width}>
  <svg {width} {height}>
    <g transform="translate({MARGIN.left},{MARGIN.top})">
      {#each counts as d (d.year)}
        <rect
          x={xScale(d.year)}
          y={BAR_AREA_HEIGHT - yScale(d.count)}
          width={barWidth}
          height={yScale(d.count)}
          fill={BAR_COLOR}
        >
          <title>{d.year}: {d.count} degree{d.count === 1 ? "" : "s"}</title>
        </rect>
      {/each}

      <!-- x-axis -->
      <line
        x1={0}
        y1={BAR_AREA_HEIGHT}
        x2={innerWidth}
        y2={BAR_AREA_HEIGHT}
        stroke={AXIS_COLOR}
      />
      {#each xTicks as t (t)}
        <line
          x1={xScale(t)}
          y1={BAR_AREA_HEIGHT}
          x2={xScale(t)}
          y2={BAR_AREA_HEIGHT + 3}
          stroke={AXIS_COLOR}
        />
        <text
          x={xScale(t)}
          y={BAR_AREA_HEIGHT + 12}
          text-anchor="middle"
          class="axis-label"
        >
          {t}
        </text>
      {/each}

      <!-- y-axis -->
      <line x1={0} y1={0} x2={0} y2={BAR_AREA_HEIGHT} stroke={AXIS_COLOR} />
      {#each yTicks as t (t)}
        <line
          x1={-3}
          y1={BAR_AREA_HEIGHT - yScale(t)}
          x2={0}
          y2={BAR_AREA_HEIGHT - yScale(t)}
          stroke={AXIS_COLOR}
        />
        <text
          x={-6}
          y={BAR_AREA_HEIGHT - yScale(t)}
          text-anchor="end"
          dominant-baseline="middle"
          class="axis-label"
        >
          {t}
        </text>
      {/each}
    </g>
  </svg>
</div>

<style>
  .popup-timeline {
    width: 100%;
    margin-top: 4px;
  }
  .axis-label {
    font-size: 8px;
    fill: #999;
  }
</style>
