<script>
  import { onMount } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import { loadPeople } from "./datastore.js";

  const MARKER_COLOR = "black";
  const MIN_RADIUS = 3;
  const MAX_RADIUS = 30;

  let mapEl;
  let status = "Loading…";

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
    return `<div class="popup-name">${name}</div>
    <div class="popup-event">${entries.length} student${entries.length === 1 ? "" : "s"}</div>
    <ul class="popup-list"><li>${names}</li></ul>`;
  }

  onMount(() => {
    const map = L.map(mapEl).setView([56.34, -2.8], 6);
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
          marker.bindPopup(popupFor(key, group.entries));
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

    return () => {
      map.remove();
    };
  });
</script>

<div id="toolbar">
  <h1>Universities Awarding M.D. Degrees</h1>
  <div id="status">{status}</div>
</div>

<div
  id="map"
  bind:this={mapEl}
  bind:clientWidth={width}
  bind:clientHeight={height}
></div>

<style>
  #map {
    position: absolute;
    top: 48px;
    bottom: 0;
    left: 0;
    right: 0;
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
