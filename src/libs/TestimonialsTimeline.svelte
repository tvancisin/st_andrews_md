<script>
  import { scaleLinear, max } from "d3";

  export let people = [];

  const START_YEAR = 1650;
  const END_YEAR = 1900;
  const MIN_BAR_HEIGHT = 2;
  const BAR_COLOR = "#1c3d5a";
  const AXIS_COLOR = "#999";
  const MARGIN = { top: 20, right: 12, bottom: 28, left: 36 };
  const ALL_CATEGORIES = "All";

  // collapse degree_award phrasings that only differ in word order/pluralization
  const DEGREE_AWARD_ALIASES = {
    "after examination": "by examination",
    "on testimonials and by examination": "by examination and on testimonials",
    "on testimonials and gratis": "gratis and on testimonials",
    "gratis on testimonials": "gratis and on testimonials",
    "on recommendations": "on recommendation",
  };

  let containerWidth = 0;
  let containerHeight = 0;
  let selectedCategory = ALL_CATEGORIES;

  function isMD(degreeName) {
    if (!degreeName) return false;
    return degreeName.replace(/[.\s]/g, "").toLowerCase() === "md";
  }

  function normalizeDegreeAward(degreeAward) {
    if (!degreeAward) return "Unspecified";
    return DEGREE_AWARD_ALIASES[degreeAward] || degreeAward;
  }

  function yearOf(dateStr) {
    if (!dateStr) return null;
    const year = parseInt(dateStr.slice(0, 4), 10);
    return Number.isFinite(year) ? year : null;
  }

  // flatten M.D. degree entries across all people, tagged with their normalized category
  $: mdDegrees = people.flatMap((p) =>
    (p.study?.degrees || [])
      .filter((d) => isMD(d.name))
      .map((d) => ({ ...d, category: normalizeDegreeAward(d.degree_award) })),
  );

  $: categories = Array.from(new Set(mdDegrees.map((d) => d.category))).sort();

  $: selectedCount =
    selectedCategory === ALL_CATEGORIES
      ? mdDegrees.length
      : mdDegrees.filter((d) => d.category === selectedCategory).length;

  // aggregate M.D. degrees awarded per year for the selected category before rendering
  $: counts = (() => {
    const byYear = new Map();
    mdDegrees.forEach((d) => {
      if (selectedCategory !== ALL_CATEGORIES && d.category !== selectedCategory)
        return;
      const year = yearOf(d.date);
      if (year === null || year < START_YEAR || year > END_YEAR) return;
      byYear.set(year, (byYear.get(year) || 0) + 1);
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
  $: yScale = scaleLinear()
    .domain([0, maxCount + 10])
    .range([0, innerHeight]);
  $: barWidth =
    innerWidth > 0 ? Math.max(innerWidth / (END_YEAR - START_YEAR), 1) : 0;
  $: xTicks = xScale.ticks(10);
  $: yTicks = yScale.ticks(5).filter(Number.isInteger);
</script>

<div class="timeline-wrapper">
  <div class="timeline-controls">
    <label for="degree-award-select">Degree award:</label>
    <select id="degree-award-select" bind:value={selectedCategory}>
      <option value={ALL_CATEGORIES}>{ALL_CATEGORIES}</option>
      {#each categories as category (category)}
        <option value={category}>{category}</option>
      {/each}
    </select>
    <span class="record-count"
      >{selectedCount} record{selectedCount === 1 ? "" : "s"}</span
    >
  </div>

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
          y={innerHeight - Math.max(yScale(d.count), MIN_BAR_HEIGHT)}
          width={barWidth}
          height={Math.max(yScale(d.count), MIN_BAR_HEIGHT)}
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
</div>

<style>
  .timeline-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
  .timeline-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding-bottom: 6px;
  }
  .record-count {
    color: #666;
  }
  .timeline {
    flex: 1;
    min-height: 0;
    width: 100%;
  }
  .axis-label {
    font-size: 10px;
    fill: #999;
  }
</style>
