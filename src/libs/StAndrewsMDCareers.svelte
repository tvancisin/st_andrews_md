<script>
    import { onMount, tick } from "svelte";
    import L from "leaflet";
    import "leaflet/dist/leaflet.css";

    export let stAndrewsData;
    // true while this view is visible; Leaflet needs a size recompute on show
    export let active = true;

    $: console.log(stAndrewsData);

    const MARKER_COLOR = "black";
    const MIN_RADIUS = 2;
    const MAX_RADIUS = 15;

    let mapEl;
    let map;
    let markerLayer;
    let height = 0;

    const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

    function countryName(code) {
        if (!code) return "Unknown";
        try {
            return countryNames.of(code);
        } catch {
            return code;
        }
    }

    const NO_FLORUIT = "No career recorded";
    const NO_LOCATION = "Location missing";
    const NO_COUNTRY = "Country missing";

    // original_name values (used when a location has no country) that should
    // be counted under a different row
    const REGION_ALIASES = {
        "General hospital, North America": "North America",
        "Leeward Islands": "West Indies",
    };

    // number of floruit entries per country, most to least. People without a
    // floruit (missing, null or empty) are counted once under NO_FLORUIT.
    function countByCountry(people) {
        const counts = new Map();
        const add = (name) => counts.set(name, (counts.get(name) || 0) + 1);
        const missingCountry = [];
        people.forEach((p) => {
            if (!Array.isArray(p.floruit) || p.floruit.length === 0) {
                add(NO_FLORUIT);
                return;
            }
            p.floruit.forEach((f) => {
                if (!f || !f.location) add(NO_LOCATION);
                else if (!f.location.country) {
                    const name = f.location.original_name;
                    add(REGION_ALIASES[name] || name || NO_COUNTRY);
                    missingCountry.push({
                        person: personName(p),
                        location: f.location,
                    });
                } else add(countryName(f.location.country));
            });
        });
        console.log(
            `${NO_COUNTRY}: ${missingCountry.length} entries`,
            missingCountry,
        );
        return Array.from(counts, ([name, count]) => ({ name, count })).sort(
            (a, b) => b.count - a.count || a.name.localeCompare(b.name),
        );
    }

    $: countryCounts = stAndrewsData ? countByCountry(stAndrewsData) : [];

    function personName(p) {
        return [p.forename, p.surname].filter(Boolean).join(" ") || "Unknown";
    }

    // radius grows with sqrt(count) so marker area scales linearly with count
    function radiusFor(count, maxCount) {
        return (
            MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(count / maxCount)
        );
    }

    // group every floruit location of every person by place
    function groupByLocation(people) {
        const groups = new Map();
        people.forEach((p) => {
            (p.floruit || []).forEach((f) => {
                const loc = f.location;
                if (
                    !loc ||
                    typeof loc.latitude !== "number" ||
                    typeof loc.longitude !== "number"
                )
                    return;
                const key = `${loc.latitude},${loc.longitude}`;
                if (!groups.has(key)) groups.set(key, { loc, entries: [] });
                groups.get(key).entries.push({ ...f, person: p });
            });
        });
        return groups;
    }

    function popupFor(name, entries) {
        const container = document.createElement("div");

        const title = document.createElement("div");
        title.className = "popup-name";
        title.textContent = name;
        container.appendChild(title);

        const count = document.createElement("div");
        count.className = "popup-event";
        count.textContent = `${entries.length} record${entries.length === 1 ? "" : "s"}`;
        container.appendChild(count);

        const list = document.createElement("ul");
        list.className = "popup-list";
        entries.forEach((e) => {
            const range = [e.from, e.to].filter(Boolean).join(" – ");
            const li = document.createElement("li");
            li.textContent = [
                personName(e.person),
                e.occupation ? `(${e.occupation})` : "",
                range ? `— ${range}` : "",
            ]
                .filter(Boolean)
                .join(" ");
            list.appendChild(li);
        });
        container.appendChild(list);

        return container;
    }

    // Leaflet caches its size; recompute when the map div is shown again
    $: if (map && active) {
        tick().then(() => map.invalidateSize());
    }

    $: if (markerLayer && stAndrewsData) {
        markerLayer.clearLayers();
        const groups = groupByLocation(stAndrewsData);
        const maxCount = Math.max(
            ...Array.from(groups.values()).map((g) => g.entries.length),
            1,
        );
        groups.forEach((group) => {
            const name =
                group.loc.official_name || group.loc.original_name || "Unknown";
            const marker = L.circleMarker(
                [group.loc.latitude, group.loc.longitude],
                {
                    radius: radiusFor(group.entries.length, maxCount),
                    color: MARKER_COLOR,
                    fillColor: MARKER_COLOR,
                    fillOpacity: 0.6,
                    weight: 1,
                },
            );
            marker.bindPopup(popupFor(name, group.entries), { maxWidth: 320 });
            markerLayer.addLayer(marker);
        });
    }

    onMount(() => {
        map = L.map(mapEl, { zoomControl: false }).setView([23.54, 20], 3);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        L.control.zoom({ position: "bottomleft" }).addTo(map);
        markerLayer = L.layerGroup().addTo(map);

        return () => {
            map.remove();
        };
    });
</script>

<div class="wrapper" bind:clientHeight={height}>
    <div class="map" bind:this={mapEl}></div>
    <div class="panel" style="width: 250px; height: {height}px;">
        <h2>Careers by country</h2>
        <ol>
            {#each countryCounts as c}
                <li>
                    <span class="name">{c.name}</span><span>{c.count}</span>
                </li>
            {/each}
        </ol>
    </div>
</div>

<style>
    .wrapper {
        position: relative;
        width: 100%;
        height: 100%;
    }
    .map {
        width: 100%;
        height: 100%;
    }
    .panel {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1000; /* above Leaflet panes */
        box-sizing: border-box;
        padding: 8px 12px;
        overflow-y: auto;
        background: rgba(255, 255, 255, 0.92);
        font-size: 13px;
    }
    .panel h2 {
        margin: 0 0 6px;
        font-size: 14px;
    }
    .panel ol {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .panel li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 2px 0;
    }
    .panel .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
