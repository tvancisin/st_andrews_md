<script>
  import { onMount } from "svelte";
  import { loadTestimonials, loadStAndrews } from "./datastore.js";
  import OtherUniMD from "./libs/OtherUniMD.svelte";
  import StAndrewsMD from "./libs/StAndrewsMD.svelte";
  import ExaminerArcs from "./libs/ExaminerArcs.svelte";
  import StAndrewsMDCareers from "./libs/StAndrewsMDCareers.svelte";
  import Network from "./libs/Network.svelte";

  let view = "map"; // "map" | "testimonials" | "network" | "arc"
  let testimonialsData = null;
  let stAndrewsData = null;

  // size of the views container, bound from the map wrapper and fed to D3 charts
  let width = 0;
  let height = 0;

  // collapse degree_award phrasings that only differ in word order/pluralization
  const DEGREE_AWARD_ALIASES = {
    "after examination": "by examination",
    "on testimonials and by examination": "by examination and on testimonials",
    "on testimonials and gratis": "gratis and on testimonials",
    "gratis on testimonials": "gratis and on testimonials",
    "on recommendations": "on recommendation",
  };

  function normalizeDegreeAward(degreeAward) {
    if (!degreeAward) return "Unspecified";
    return DEGREE_AWARD_ALIASES[degreeAward] || degreeAward;
  }

  // split degree entries into by-examination / on-testimonials / other.
  // matches on substrings ("examination", "testimonial") rather than exact
  // phrases so a missing "by"/"on" (e.g. "after examination") still counts;
  // entries mentioning both examination and testimonials count as examination.
  function categorizeByAward(entries) {
    const byExamination = [];
    const onTestimonials = [];
    const other = [];
    entries.forEach((d) => {
      const award = (d.degree_award || "").toLowerCase();
      if (award.includes("examination")) byExamination.push(d);
      else if (award.includes("testimonial")) onTestimonials.push(d);
      else other.push(d);
    });
    return { byExamination, onTestimonials, other };
  }

  onMount(() => {
    loadTestimonials()
      .then((testimonials) => {
        testimonialsData = testimonials;
      })
      .catch((err) => {
        console.error(err);
      });

    loadStAndrews()
      .then((stAndrews) => {
        stAndrewsData = stAndrews;
      })
      .catch((err) => {
        console.error(err);
      });
  });
</script>

<div id="app-layout">
  <nav id="view-buttons">
    <button class:active={view === "map"} on:click={() => (view = "map")}>
      Other Universities MD
    </button>
    <button
      class:active={view === "testimonials"}
      on:click={() => (view = "testimonials")}
    >
      St Andrews MD
    </button>
    <button
      class:active={view === "careers"}
      on:click={() => (view = "careers")}
    >
      St Andrews MD Careers
    </button>
    <!-- <button
      class:active={view === "network"}
      on:click={() => (view = "network")}
    >
      Examiners
    </button> -->
    <button class:active={view === "arc"} on:click={() => (view = "arc")}>
      Examiner Arcs
    </button>
  </nav>

  <div id="views">
    <div
      id="map"
      class:hidden={view !== "map"}
      bind:clientWidth={width}
      bind:clientHeight={height}
    >
      <OtherUniMD active={view === "map"} />
    </div>
    <div id="testimonials" class:hidden={view !== "testimonials"}>
      {#if stAndrewsData}
        <StAndrewsMD people={stAndrewsData} {width} {height} />
      {/if}
    </div>
    <div id="careers" class:hidden={view !== "careers"}>
      {#if stAndrewsData}
        <StAndrewsMDCareers {stAndrewsData} active={view === "careers"} />
      {/if}
    </div>
    <!-- <div id="network" class:hidden={view !== "network"}>
      {#if testimonialsData}
        <Network people={testimonialsData} />
      {/if}
    </div> -->
    <div id="arc" class:hidden={view !== "arc"}>
      {#if testimonialsData}
        <ExaminerArcs people={testimonialsData} />
      {/if}
    </div>
  </div>
</div>

<style>
  #app-layout {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
  }
  #view-buttons {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    flex: none;
  }
  #view-buttons button {
    padding: 6px 14px;
    border: 1px solid #1c3d5a;
    border-radius: 4px;
    background: #fff;
    color: #1c3d5a;
    font: inherit;
    cursor: pointer;
  }
  #view-buttons button.active {
    background: #1c3d5a;
    color: #fff;
  }
  #views {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
  }
  #map,
  #testimonials,
  #careers,
  #network,
  #arc {
    position: absolute;
    inset: 0;
  }
  #testimonials {
    display: flex;
    flex-direction: column;
    padding: 0 12px;
    box-sizing: border-box;
  }
  .hidden {
    display: none !important;
  }
  #toolbar {
    height: 48px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 12px;
    background: #1c3d5a;
    color: #fff;
    box-sizing: border-box;
  }
  #toolbar h1 {
    font-size: 16px;
    margin: 0;
    white-space: nowrap;
  }
  #status {
    margin-left: auto;
    font-size: 12px;
    opacity: 0.85;
    white-space: nowrap;
  }
</style>
