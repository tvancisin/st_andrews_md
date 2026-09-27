<script>
  import { onMount, mount, tick } from "svelte";
  import { groups } from "d3";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import { loadPeople, loadTestimonials, loadStAndrews } from "./datastore.js";
  import PopupTimeline from "./libs/PopupTimeline.svelte";
  import TestimonialsTimeline from "./libs/TestimonialsTimeline.svelte";
  import Network from "./libs/Network.svelte";
  import ArcDiagram from "./libs/ArcDiagram.svelte";

  //////// NOTES ////////
  // all md (gained in st andrews and elsewhere)
  // just st andrews : 3758
  // just elsewhere : 391 (including Hon. M.D., M.D. et Phil.)
  // idp1379293124
  // idp1393191556
  // idp1374816476
  // idp1374916524
  // idp1407537140
  // idp1412748908
  // idp1395590356
  // idp1388412484
  // idp1417348676
  // idp1388840492
  // W_0127_Watson_John_WatsonusWatsone.xml
  //                  380 (just M.D.)

  // Degree Award Type	Count
  // By examination	2,427
  // On testimonials	1,191
  // Unspecified	75
  // Gratis	23
  // Gratis and on testimonials	12
  // By examination and on testimonials	12
  // By examination and gratis	5
  // Honorary	8
  // On recommendation	2
  // By thesis	1
  // In eundem	1
  // On personal knowledge and testimonial	1

  const MARKER_COLOR = "black";
  const MIN_RADIUS = 3;
  const MAX_RADIUS = 30;

  let mapEl;
  let map;
  let view = "map"; // "map" | "testimonials" | "network" | "arc"
  let status = "Loading…";
  let testimonialsData = null;
  let stAndrewsData = null;

  // reserved for driving a future D3 chart's scales; unused by the Leaflet map itself
  let width = 0;
  let height = 0;

  function personName(p) {
    return [p.forename, p.surname].filter(Boolean).join(" ") || "Unknown";
  }

  // normalize e.g. "M.D.", "MD", "m d" -> "md" for comparison
  function isMD(degreeName) {
    if (!degreeName) return false;
    return degreeName.replace(/[.\s]/g, "").toLowerCase() === "md";
  }

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

  // radius grows with sqrt(count) so marker area scales linearly with attendee count
  function radiusFor(count, maxCount) {
    return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(count / maxCount);
  }

  function popupFor(name, entries) {
    const names = entries
      .map((e) => {
        const degrees = (e.degrees || []).map((d) => d.name).join(", ");
        const range = [e.from, e.to].filter(Boolean).join(" – ");
        return `${personName(e.person)}${degrees ? ` (${degrees})` : ""}${range ? ` — ${range}` : ""}`;
      })
      .join("</li><li>");

    const container = document.createElement("div");
    container.innerHTML = `<div class="popup-name">${name}</div>
    <div class="popup-event">${entries.length} student${entries.length === 1 ? "" : "s"}</div>`;

    const timelineEl = document.createElement("div");
    container.appendChild(timelineEl);
    mount(PopupTimeline, { target: timelineEl, props: { entries } });

    const list = document.createElement("ul");
    list.className = "popup-list";
    list.innerHTML = `<li>${names}</li>`;
    container.appendChild(list);

    return container;
  }

  // Leaflet caches its size; recompute when the map div is shown again
  $: if (map && view === "map") {
    tick().then(() => map.invalidateSize());
  }

  onMount(() => {
    map = L.map(mapEl).setView([53.54, -2.8], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);

    loadPeople()
      .then((people) => {
        // group other_universities entries by official_name

        const groups = new Map();
        people.forEach((p) => {
          (p.other_universities || []).forEach((u) => {
            const loc = u.location;
            if (
              !loc ||
              typeof loc.latitude !== "number" ||
              typeof loc.longitude !== "number"
            )
              return;
            const mdDegrees = (u.degrees || []).filter((d) => isMD(d.name));
            if (mdDegrees.length === 0) return;
            const key = loc.official_name || loc.original_name;
            if (!key) return;
            if (!groups.has(key)) groups.set(key, { loc, entries: [] });
            groups
              .get(key)
              .entries.push({ ...u, degrees: mdDegrees, person: p });
          });
        });

        const maxCount = Math.max(
          ...Array.from(groups.values()).map((g) => g.entries.length),
          1,
        );

        groups.forEach((group, key) => {
          const count = group.entries.length;
          const marker = L.circleMarker(
            [group.loc.latitude, group.loc.longitude],
            {
              radius: radiusFor(count, maxCount),
              color: MARKER_COLOR,
              fillColor: MARKER_COLOR,
              fillOpacity: 0.6,
              weight: 1,
            },
          );
          marker.bindPopup(popupFor(key, group.entries), { maxWidth: 320 });
          markerLayer.addLayer(marker);
        });

        const mdCount = Array.from(groups.values()).reduce(
          (sum, g) => sum + g.entries.length,
          0,
        );
        status = `${groups.size} universities · ${mdCount} M.D. degrees`;
      })
      .catch((err) => {
        status = "Failed to load data — see console.";
        console.error(err);
      });

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

        const degreeEntries = stAndrews.flatMap((p) =>
          ((p.study && p.study.degrees) || [])
            .filter((d) => isMD(d.name))
            .map((d) => ({ ...d, person: p })),
        );
        const byDegreeAward = groups(degreeEntries, (d) =>
          normalizeDegreeAward(d.degree_award),
        );
        const pre_1722 = degreeEntries.filter((d) => {
          if (!d.date) return false;
          const year = parseInt(d.date.slice(0, 4), 10);
          return year < 1722;
        });
        const between_1722_1764 = degreeEntries.filter((d) => {
          if (!d.date) return false;
          const year = parseInt(d.date.slice(0, 4), 10);
          return year >= 1722 && year < 1764;
        });
        const between_1764_1770 = degreeEntries.filter((d) => {
          if (!d.date) return false;
          const year = parseInt(d.date.slice(0, 4), 10);
          return year >= 1764 && year < 1770;
        });
        const between_1770_1811 = degreeEntries.filter((d) => {
          if (!d.date) return false;
          const year = parseInt(d.date.slice(0, 4), 10);
          return year >= 1770 && year < 1811;
        });
        const between_1811_1840 = degreeEntries.filter((d) => {
          if (!d.date) return false;
          const year = parseInt(d.date.slice(0, 4), 10);
          return year >= 1811 && year < 1840;
        });
        const between_1696_1800 = degreeEntries.filter((d) => {
          if (!d.date) return false;
          const year = parseInt(d.date.slice(0, 4), 10);
          return year >= 1696 && year <= 1800;
        });
        const between_1811_1826 = degreeEntries.filter((d) => {
          if (!d.date) return false;
          const year = parseInt(d.date.slice(0, 4), 10);
          return year >= 1811 && year <= 1826;
        });
        const pre_1722_awards = categorizeByAward(pre_1722);
        const between_1722_1764_awards = categorizeByAward(between_1722_1764);
        const between_1764_1770_awards = categorizeByAward(between_1764_1770);
        const between_1770_1811_awards = categorizeByAward(between_1770_1811);
        const between_1811_1840_awards = categorizeByAward(between_1811_1840);
        const between_1696_1800_awards = categorizeByAward(between_1696_1800);
        const between_1811_1826_awards = categorizeByAward(between_1811_1826);

        // console.log(stAndrewsData);
        console.log("pre 1722:", pre_1722, pre_1722_awards);
        console.log(
          "between 1722 and 1764:",
          between_1722_1764,
          between_1722_1764_awards,
        );
        console.log(
          "between 1764 and 1770:",
          between_1764_1770,
          between_1764_1770_awards,
        );
        console.log(
          "between 1770 and 1811:",
          between_1770_1811,
          between_1770_1811_awards,
        );
        console.log(
          "between 1811 and 1840:",
          between_1811_1840,
          between_1811_1840_awards,
        );
        console.log(
          "between 1696 and 1800:",
          between_1696_1800,
          between_1696_1800_awards,
        );
        console.log(
          "between 1811 and 1826:",
          between_1811_1826,
          between_1811_1826_awards,
        );
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      map.remove();
    };
  });
</script>

<!-- <div id="toolbar">
  <h1>Universities Awarding M.D. Degrees</h1>
  <div id="status">{status}</div>
</div> -->

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
      bind:this={mapEl}
      bind:clientWidth={width}
      bind:clientHeight={height}
    ></div>
    <div id="testimonials" class:hidden={view !== "testimonials"}>
      {#if stAndrewsData}
        <TestimonialsTimeline people={stAndrewsData} {width} {height} />
      {/if}
    </div>
    <!-- <div id="network" class:hidden={view !== "network"}>
      {#if testimonialsData}
        <Network people={testimonialsData} />
      {/if}
    </div> -->
    <div id="arc" class:hidden={view !== "arc"}>
      {#if testimonialsData}
        <ArcDiagram people={testimonialsData} />
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
  :global(.popup-name) {
    font-weight: bold;
    margin-bottom: 4px;
  }
  :global(.popup-event) {
    color: #555;
    font-size: 12px;
  }
  :global(.popup-list) {
    max-height: 200px;
    overflow-y: auto;
    margin: 4px 0 0;
    padding-left: 18px;
    font-size: 12px;
  }
</style>
