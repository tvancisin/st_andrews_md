<script>
  import { scaleLinear, max } from "d3";

  export let people = [];

  $: console.log(people);

  const START_YEAR = 1650;
  const END_YEAR = 1900;
  const BAR_COLOR = "#1c3d5a";
  const AXIS_COLOR = "#999";
  const MARGIN = { top: 20, right: 12, bottom: 28, left: 36 };

  let containerWidth = 0;
  let containerHeight = 0;

  function isMD(degreeName) {
    if (!degreeName) return false;
    return degreeName.replace(/[.\s]/g, "").toLowerCase() === "md";
  }

  function yearOf(dateStr) {
    if (!dateStr) return null;
    const year = parseInt(dateStr.slice(0, 4), 10);
    return Number.isFinite(year) ? year : null;
  }

  // aggregate M.D. degrees awarded per year across all records before rendering
  $: counts = (() => {
    const byYear = new Map();
    people.forEach((p) => {
      (p.study?.degrees || []).forEach((d) => {
        if (!isMD(d.name)) return;
        const year = yearOf(d.date);
        if (year === null || year < START_YEAR || year > END_YEAR) return;
        byYear.set(year, (byYear.get(year) || 0) + 1);
      });
    });
    return Array.from(byYear, ([year, count]) => ({ year, count })).sort(
      (a, b) => a.year - b.year,
    );
  })();

  $: maxCount = max(counts, (d) => d.count) || 1;
  $: innerWidth = Math.max(containerWidth - MARGIN.left - MARGIN.right, 0);
  $: innerHeight = Math.max(containerHeight - MARGIN.top - MARGIN.bottom, 0);
  $: xScale = scaleLinear()
    .domain([START_YEAR, END_YEAR])
    .range([0, innerWidth]);
  $: yScale = scaleLinear().domain([0, maxCount]).range([0, innerHeight]);
  $: barWidth =
    innerWidth > 0 ? Math.max(innerWidth / (END_YEAR - START_YEAR), 1) : 0;
  $: xTicks = xScale.ticks(10);
  $: yTicks = yScale.ticks(5);
</script>

<div
  class="timeline"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
>
  <svg width={containerWidth} height={containerHeight}>
    <g transform="translate({MARGIN.left},{MARGIN.top})">
      {#each counts as d (d.year)}
        <rect
          x={xScale(d.year)}
          y={innerHeight - yScale(d.count)}
          width={barWidth}
          height={yScale(d.count)}
          fill={BAR_COLOR}
        >
          <title
            >{d.year}: {d.count} M.D. degree{d.count === 1 ? "" : "s"}</title
          >
        </rect>
      {/each}

      <!-- x-axis -->
      <line
        x1={0}
        y1={innerHeight}
        x2={innerWidth}
        y2={innerHeight}
        stroke={AXIS_COLOR}
      />
      {#each xTicks as t (t)}
        <line
          x1={xScale(t)}
          y1={innerHeight}
          x2={xScale(t)}
          y2={innerHeight + 4}
          stroke={AXIS_COLOR}
        />
        <text
          x={xScale(t)}
          y={innerHeight + 16}
          text-anchor="middle"
          class="axis-label"
        >
          {t}
        </text>
      {/each}

      <!-- y-axis -->
      <line x1={0} y1={0} x2={0} y2={innerHeight} stroke={AXIS_COLOR} />
      {#each yTicks as t (t)}
        <line
          x1={-4}
          y1={innerHeight - yScale(t)}
          x2={0}
          y2={innerHeight - yScale(t)}
          stroke={AXIS_COLOR}
        />
        <text
          x={-8}
          y={innerHeight - yScale(t)}
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
  .timeline {
    width: 100%;
    height: 100%;
  }
  .axis-label {
    font-size: 10px;
    fill: #999;
  }
</style>
