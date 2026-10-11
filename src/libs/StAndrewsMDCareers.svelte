<script>
    import { onMount, tick } from "svelte";
    import L from "leaflet";
    import "leaflet/dist/leaflet.css";

    export let stAndrewsData;
    // true while this view is visible; Leaflet needs a size recompute on show
    export let active = true;

    const MARKER_COLOR = "black";
    const MIN_RADIUS = 2;
    const MAX_RADIUS = 15;

    let mapEl;
    let map;
    let markerLayer;

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
        map = L.map(mapEl).setView([23.54, 20], 3);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        markerLayer = L.layerGroup().addTo(map);

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
</style>
