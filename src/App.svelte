<script>
  import { onMount, mount } from "svelte";
  import { groups } from "d3";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import { loadPeople, loadTestimonials, loadStAndrews } from "./datastore.js";
  import PopupTimeline from "./libs/PopupTimeline.svelte";
  import TestimonialsTimeline from "./libs/TestimonialsTimeline.svelte";
  import Network from "./libs/Network.svelte";

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

  onMount(() => {
    const map = L.map(mapEl).setView([53.54, -2.8], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);

    loadPeople()
      .then((people) => {
        // group other_universities entries by official_name
        console.log(people);

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
        console.log(stAndrews);
        stAndrewsData = stAndrews;

        const degreeEntries = stAndrews.flatMap((p) =>
          ((p.study && p.study.degrees) || [])
            .filter((d) => isMD(d.name))
            .map((d) => ({ ...d, person: p })),
        );
        const byDegreeAward = groups(degreeEntries, (d) =>
          normalizeDegreeAward(d.degree_award),
        );
        console.log(byDegreeAward);
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

<h4>M.D. Degrees Awarded to St Andrews alumni by other universities:</h4>
<div
  id="map"
  bind:this={mapEl}
  bind:clientWidth={width}
  bind:clientHeight={height}
></div>
<h4>M.D. Degrees Awarded in St Andrews per year:</h4>
<div id="testimonials">
  {#if stAndrewsData}
    <TestimonialsTimeline people={stAndrewsData} {width} {height} />
  {/if}
</div>

<!-- <div id="network">
  {#if testimonialsData}
    <Network people={testimonialsData} />
  {/if}
</div> -->

<style>
  #map {
    position: relative;
    width: 100%;
    height: 70vh;
  }
  #testimonials {
    position: relative;
    width: 100%;
    height: 80vh;
  }
  #network {
    position: relative;
    width: 100%;
    height: 300px;
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
