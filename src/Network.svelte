<script>
  export let people = [];

  let containerWidth = 0;
  let containerHeight = 0;

  // normalize e.g. "M.D.", "MD", "m d" -> "md" for comparison
  function isMD(degreeName) {
    if (!degreeName) return false;
    return degreeName.replace(/[.\s]/g, "").toLowerCase() === "md";
  }

  // group M.D. degree records by examiner, keeping only examiners with both a forename and surname
  $: examinerGroups = (() => {
    const byExaminer = new Map();
    people.forEach((p) => {
      (p.study?.degrees || []).forEach((d) => {
        if (!isMD(d.name)) return;
        (d.examiners || []).forEach((ex) => {
          if (!ex.forename || !ex.surname) return;
          const name = `${ex.forename} ${ex.surname}`;
          if (!byExaminer.has(name)) {
            byExaminer.set(name, { name, records: [] });
          }
          byExaminer.get(name).records.push({ person: p, degree: d });
        });
      });
    });
    return Array.from(byExaminer.values()).sort(
      (a, b) => b.records.length - a.records.length,
    );
  })();

  // group M.D. degree records by the exact combination of co-examiners (order-independent)
  $: examinerCombinationGroups = (() => {
    const byCombination = new Map();
    people.forEach((p) => {
      (p.study?.degrees || []).forEach((d) => {
        if (!isMD(d.name)) return;
        const names = (d.examiners || [])
          .filter((ex) => ex.forename && ex.surname)
          .map((ex) => `${ex.forename} ${ex.surname}`)
          .sort();
        if (names.length === 0) return;
        const key = names.join(" & ");
        if (!byCombination.has(key)) {
          byCombination.set(key, { examiners: names, records: [] });
        }
        byCombination.get(key).records.push({ person: p, degree: d });
      });
    });
    return Array.from(byCombination.values()).sort(
      (a, b) => b.records.length - a.records.length,
    );
  })();

  $: console.log(examinerGroups);
  $: console.log(examinerCombinationGroups);
</script>

<div
  class="network"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
>
  <svg width={containerWidth} height={containerHeight}></svg>
</div>

<style>
  .network {
    width: 100%;
    height: 100%;
  }
</style>
