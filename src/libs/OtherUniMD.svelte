<script>
  import { onMount, mount, tick } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import { loadPeople } from "../datastore.js";
  import PopupTimeline from "./PopupTimeline.svelte";

  // true while the map is the visible view; Leaflet needs a size recompute on show
  export let active = true;

  const MARKER_COLOR = "black";
  const MIN_RADIUS = 3;
  const MAX_RADIUS = 30;

  let mapEl;
  let map;

  function personName(p) {
    return [p.forename, p.surname].filter(Boolean).join(" ") || "Unknown";
  }

  // normalize e.g. "M.D.", "MD", "m d" -> "md" for comparison
  function isMD(degreeName) {
    if (!degreeName) return false;
    return degreeName.replace(/[.\s]/g, "").toLowerCase() === "md";
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
  $: if (map && active) {
    tick().then(() => map.invalidateSize());
  }

  onMount(() => {
    map = L.map(mapEl, { zoomControl: false }).setView([53.54, -2.8], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
        L.control.zoom({ position: "bottomleft" }).addTo(map);

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
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      map.remove();
    };
  });
</script>

<div class="map" bind:this={mapEl}></div>

<style>
  .map {
    width: 100%;
    height: 100%;
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
