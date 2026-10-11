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

  // stacked-bar colors for the "All" view, in bottom-to-top stacking order
  const EXAMINATION_COLOR = "#808080"; // gray
  const TESTIMONIALS_COLOR = "#000000"; // black
  const OTHER_COLOR = "#d3d3d3"; // light gray
  // hairline separator between stacked segments, matching the page background
  const SEGMENT_GAP_COLOR = "#fff";
  // color of the small clip marker drawn above bars taller than the chosen y-axis scale
  const CLIP_MARKER_COLOR = "#e63946";
  // bounds for the "All"-only y-axis scale slider. Fixed rather than derived
  // from the data max: the data max (606) isn't a multiple of the slider's
  // step, so a browser range input can refuse to reach an unaligned max —
  // a round, step-aligned ceiling above the true max sidesteps that entirely.
  const SCALE_SLIDER_MIN = 150;
  const SCALE_SLIDER_MAX = 610;

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
  // user-adjustable y-axis scale cap, "All" view only; null = follow the
  // computed max until the person drags the slider themselves
  let scaleCap = null;
  let scaleCapTouched = false;

  function isMD(degreeName) {
    if (!degreeName) return false;
    return degreeName.replace(/[.\s]/g, "").toLowerCase() === "md";
  }

  function normalizeDegreeAward(degreeAward) {
    if (!degreeAward) return "Unspecified";
    return DEGREE_AWARD_ALIASES[degreeAward] || degreeAward;
  }

  // split a degree_award into by-examination / on-testimonials / other.
  // matches on substrings ("examination", "testimonial") rather than exact
  // phrases so a missing "by"/"on" (e.g. "after examination") still counts;
  // an award mentioning both examination and testimonials counts as examination.
  function categorizeAward(degreeAward) {
    const award = (degreeAward || "").toLowerCase();
    if (award.includes("examination")) return "byExamination";
    if (award.includes("testimonial")) return "onTestimonials";
    return "other";
  }

  function yearOf(dateStr) {
    if (!dateStr) return null;
    const year = parseInt(dateStr.slice(0, 4), 10);
    return Number.isFinite(year) ? year : null;
  }

  // flatten M.D. degree entries across all people, tagged with their normalized
  // category (for the dropdown) and their award bucket (for the "All" stacked view)
  $: mdDegrees = people.flatMap((p) =>
    (p.study?.degrees || [])
      .filter((d) => isMD(d.name))
      .map((d) => ({
        ...d,
        category: normalizeDegreeAward(d.degree_award),
        awardCategory: categorizeAward(d.degree_award),
      })),
  );

  $: categories = Array.from(new Set(mdDegrees.map((d) => d.category))).sort();

  $: selectedCount =
    selectedCategory === ALL_CATEGORIES
      ? mdDegrees.length
      : mdDegrees.filter((d) => d.category === selectedCategory).length;

  // the by-examination/on-testimonials/other breakdown only applies to "All";
  // a specific degree_award selection is a single, already-homogeneous bucket
  $: showStacked = selectedCategory === ALL_CATEGORIES;

  // aggregate M.D. degrees awarded per year for the selected category before
  // rendering, keeping the award-bucket breakdown alongside the plain total
  $: counts = (() => {
    const byYear = new Map();
    mdDegrees.forEach((d) => {
      if (
        selectedCategory !== ALL_CATEGORIES &&
        d.category !== selectedCategory
      )
        return;
      const year = yearOf(d.date);
      if (year === null || year < START_YEAR || year > END_YEAR) return;
      if (!byYear.has(year)) {
        byYear.set(year, { byExamination: 0, onTestimonials: 0, other: 0 });
      }
      byYear.get(year)[d.awardCategory] += 1;
    });
    return Array.from(byYear, ([year, breakdown]) => ({
      year,
      ...breakdown,
      count:
        breakdown.byExamination + breakdown.onTestimonials + breakdown.other,
    })).sort((a, b) => a.year - b.year);
  })();

  $: maxCount = max(counts, (d) => d.count) || 1;

  // until touched, the cap sits at the slider's fixed ceiling so the chart
  // opens with a little headroom above the tallest bar
  $: if (!scaleCapTouched) {
    scaleCap = SCALE_SLIDER_MAX;
  }
  $: effectiveMax = showStacked ? scaleCap : maxCount;

  $: innerWidth = Math.max(containerWidth - MARGIN.left - MARGIN.right, 0);
  $: innerHeight = Math.max(containerHeight - MARGIN.top - MARGIN.bottom, 0);
  $: xScale = scaleLinear()
    .domain([START_YEAR, END_YEAR])
    .range([0, innerWidth]);
  // clamp(true): a bar whose count exceeds the slider-chosen scale is capped
  // at the plot's top edge (rendered with a clip marker) rather than overflowing
  $: yScale = scaleLinear()
    .domain([0, effectiveMax + 10])
    .range([0, innerHeight])
    .clamp(true);
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

  {#if showStacked}
    <div class="legend">
      <span class="legend-item"
        ><span class="swatch" style="background:{EXAMINATION_COLOR}"></span>By
        examination</span
      >
      <span class="legend-item"
        ><span class="swatch" style="background:{TESTIMONIALS_COLOR}"></span>On
        testimonials</span
      >
      <span class="legend-item"
        ><span class="swatch" style="background:{OTHER_COLOR}"
        ></span>Other</span
      >
    </div>

    <div class="scale-control">
      <label for="y-scale-slider">Y-axis scale:</label>
      <input
        id="y-scale-slider"
        type="range"
        min={SCALE_SLIDER_MIN}
        max={SCALE_SLIDER_MAX}
        step="10"
        bind:value={scaleCap}
        on:input={() => (scaleCapTouched = true)}
      />
      <span class="scale-value">{Math.round(effectiveMax)}</span>
    </div>
  {/if}

  <div
    class="timeline"
    bind:clientWidth={containerWidth}
    bind:clientHeight={containerHeight}
  >
    <svg width={containerWidth} height={containerHeight}>
      <g transform="translate({MARGIN.left},{MARGIN.top})">
        {#each counts as d (d.year)}
          {#if showStacked}
            <!-- stacked bar, bottom-to-top: by examination, on testimonials, other -->
            {@const totalHeight = Math.max(yScale(d.count), MIN_BAR_HEIGHT)}
            {@const examinationHeight =
              d.count > 0 ? (d.byExamination / d.count) * totalHeight : 0}
            {@const testimonialsHeight =
              d.count > 0 ? (d.onTestimonials / d.count) * totalHeight : 0}
            {@const otherHeight =
              totalHeight - examinationHeight - testimonialsHeight}
            {@const isClipped = d.count > effectiveMax}
            <rect
              x={xScale(d.year)}
              y={innerHeight - examinationHeight}
              width={barWidth}
              height={examinationHeight}
              fill={EXAMINATION_COLOR}
              stroke={SEGMENT_GAP_COLOR}
            >
              <title>{d.year}: {d.byExamination} by examination</title>
            </rect>
            <rect
              x={xScale(d.year)}
              y={innerHeight - examinationHeight - testimonialsHeight}
              width={barWidth}
              height={testimonialsHeight}
              fill={TESTIMONIALS_COLOR}
              stroke={SEGMENT_GAP_COLOR}
            >
              <title>{d.year}: {d.onTestimonials} on testimonials</title>
            </rect>
            <rect
              x={xScale(d.year)}
              y={innerHeight - totalHeight}
              width={barWidth}
              height={otherHeight}
              fill={OTHER_COLOR}
              stroke={SEGMENT_GAP_COLOR}
            >
              <title>{d.year}: {d.other} other</title>
            </rect>
            {#if isClipped}
              <!-- clip marker: this bar's true total exceeds the slider's chosen scale -->
              <polygon
                points="{xScale(d.year) + barWidth / 2 - 4},{innerHeight -
                  totalHeight -
                  2} {xScale(d.year) + barWidth / 2 + 4},{innerHeight -
                  totalHeight -
                  2} {xScale(d.year) + barWidth / 2},{innerHeight -
                  totalHeight -
                  8}"
                fill={CLIP_MARKER_COLOR}
              >
                <title
                  >{d.year}: {d.count} total (scale capped at {Math.round(
                    effectiveMax,
                  )})</title
                >
              </polygon>
            {/if}
          {:else}
            <rect
              x={xScale(d.year)}
              y={innerHeight - Math.max(yScale(d.count), MIN_BAR_HEIGHT)}
              width={barWidth}
              height={Math.max(yScale(d.count), MIN_BAR_HEIGHT)}
              fill={BAR_COLOR}
            >
              <title
                >{d.year}: {d.count} M.D. degree{d.count === 1
                  ? ""
                  : "s"}</title
              >
            </rect>
          {/if}
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
  .legend {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 11px;
    color: #444;
    padding-bottom: 6px;
  }
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .scale-control {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding-bottom: 6px;
  }
  .scale-control input[type="range"] {
    width: 160px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }
  .scale-control input[type="range"]::-webkit-slider-runnable-track {
    height: 2px;
    background: #999;
    border-radius: 1px;
  }
  .scale-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -5px;
    border-radius: 50%;
    background: #000;
    cursor: pointer;
  }
  .scale-control input[type="range"]::-moz-range-track {
    height: 2px;
    background: #999;
    border-radius: 1px;
  }
  .scale-control input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 50%;
    background: #000;
    cursor: pointer;
  }
  .scale-value {
    color: #666;
    min-width: 2.5em;
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
