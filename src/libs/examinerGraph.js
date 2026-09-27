const MAX_COMBINATIONS = 50;

// normalize e.g. "M.D.", "MD", "m d" -> "md" for comparison
function isMD(degreeName) {
  if (!degreeName) return false;
  return degreeName.replace(/[.\s]/g, "").toLowerCase() === "md";
}

// group M.D. degree records by the exact combination of co-examiners (order-independent)
function examinerCombinationGroups(people) {
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
  return Array.from(byCombination.values())
    .sort((a, b) => b.records.length - a.records.length)
    .slice(0, MAX_COMBINATIONS);
}

// one node per examiner, one link per co-examiner pair (weighted by shared examinations).
// `filterText` keeps only groups containing an examiner whose name matches it.
export function buildExaminerGraph(people, filterText = "") {
  const filter = filterText.trim().toLowerCase();
  const groups = examinerCombinationGroups(people).filter(
    (group) =>
      !filter ||
      group.examiners.some((name) => name.toLowerCase().includes(filter)),
  );
  // console.log(groups);
  

  const nodeByName = new Map();
  const linkByPair = new Map();

  groups.forEach((group) => {
    group.examiners.forEach((name) => {
      if (!nodeByName.has(name)) nodeByName.set(name, { id: name, count: 0 });
      nodeByName.get(name).count += group.records.length;
    });

    for (let i = 0; i < group.examiners.length; i++) {
      for (let j = i + 1; j < group.examiners.length; j++) {
        const [a, b] = [group.examiners[i], group.examiners[j]].sort();
        const key = `${a}|${b}`;
        if (!linkByPair.has(key)) {
          linkByPair.set(key, { source: a, target: b, weight: 0 });
        }
        linkByPair.get(key).weight += group.records.length;
      }
    }
  });

  return {
    nodes: Array.from(nodeByName.values()),
    links: Array.from(linkByPair.values()),
  };
}
