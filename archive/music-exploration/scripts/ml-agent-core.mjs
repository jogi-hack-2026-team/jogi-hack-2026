const SCOPE_RANK = new Map([["Must", 0], ["Should", 1], ["Could", 2]]);

export function isMlIssue(issue) {
  const labels = (issue.labels ?? []).map((label) =>
    typeof label === "string" ? label.toLowerCase() : label.name?.toLowerCase(),
  );
  return !issue.pull_request && (labels.includes("ml") || /\[ML\]/i.test(issue.title ?? ""));
}

export function bodyDependencies(body = "") {
  const result = new Set();
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/(?:前提|依存(?:先|Issue)?)[：:]\s*([^。\n]+)/);
    if (match) {
      for (const token of match[1].matchAll(/#(\d+)/g)) result.add(Number(token[1]));
    }
    const inline = line.match(/#(\d+)\s*に依存/g);
    for (const phrase of inline ?? []) result.add(Number(phrase.match(/\d+/)[0]));
    const acceptance = line.match(/受入は#(\d+)/);
    if (acceptance) result.add(Number(acceptance[1]));
  }
  return [...result];
}

export function needsHumanDecision(issue) {
  const labels = (issue.labels ?? []).map((label) =>
    typeof label === "string" ? label.toLowerCase() : label.name?.toLowerCase(),
  );
  if (labels.includes("blocked") || labels.includes("needs-discussion")) return true;
  return /着手前に.{0,20}(?:決定|判断)|人間.{0,20}事前に.{0,20}(?:設定|決定)|人間の.{0,20}判断前/.test(
    issue.body ?? "",
  );
}

export function normalizeProjectItem(item) {
  const content = item.content ?? {};
  const fields = Array.isArray(item.fields) ? Object.fromEntries(
    item.fields.map((field) => [field.name?.toLowerCase(), field.value?.name ?? field.value]),
  ) : item.fields ?? {};
  const fieldValues = item.fieldValues ?? item.field_values ?? {};
  const value = (name) => {
    const raw = item[name] ?? item[name.toLowerCase()] ?? fields[name.toLowerCase()] ??
      fieldValues[name] ?? fieldValues[name.toLowerCase()];
    return raw?.name ?? raw?.value?.name ?? raw?.value ?? raw;
  };
  return {
    number: Number(content.number ?? item.number),
    status: value("Status"),
    scope: value("Scope"),
  };
}

function isCompleted(issue) {
  return issue?.state?.toLowerCase() === "closed" && issue.state_reason === "completed";
}

function hasExistingPr(issue, prs) {
  return prs.some((pr) => {
    const branch = pr.headRefName ?? pr.head?.ref ?? "";
    const text = String(pr.title ?? "") + "\n" + String(pr.body ?? "");
    return branch.includes("/" + issue.number + "-ml") ||
      new RegExp("\\b(?:Closes|Fixes|Resolves)\\s+#" + issue.number + "\\b", "i").test(text);
  });
}

export function selectQueue({ issues, projectItems, nativeDependencies = {}, subIssues = {}, prs = [], actor, activeNumbers = [], recoverablePrNumbers = [] }) {
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const project = new Map(projectItems.map(normalizeProjectItem).map((item) => [item.number, item]));
  const ml = issues.filter((issue) => issue.state?.toLowerCase() === "open" && isMlIssue(issue));
  const dependencies = new Map();
  for (const issue of ml) {
    const all = new Set(bodyDependencies(issue.body));
    for (const dep of nativeDependencies[issue.number] ?? []) all.add(Number(dep.number ?? dep));
    for (const child of subIssues[issue.number] ?? []) all.add(Number(child.number ?? child));
    all.delete(issue.number);
    dependencies.set(issue.number, [...all].sort((a, b) => a - b));
  }

  const downstream = (number, seen = new Set()) => {
    for (const [other, deps] of dependencies) {
      if (deps.includes(number) && !seen.has(other)) {
        seen.add(other);
        downstream(other, seen);
      }
    }
    return seen.size;
  };

  const entries = ml.map((issue) => {
    const reasons = [];
    const item = project.get(issue.number);
    if (!/##\s*(?:完了条件|Acceptance Criteria)/i.test(issue.body ?? "")) {
      reasons.push("Acceptance criteria missing");
    }
    if (!item) reasons.push("Project item missing");
    else {
      if (item.status !== "Ready" &&
          !(item.status === "In progress" && activeNumbers.includes(issue.number))) {
        reasons.push("Status: " + (item.status ?? "unset"));
      }
      if (!SCOPE_RANK.has(item.scope)) reasons.push("Scope unset");
    }
    if (!issue.assignees?.some((assignee) =>
      (typeof assignee === "string" ? assignee : assignee.login)?.toLowerCase() === actor?.toLowerCase()
    )) reasons.push("Assigned to another person or unassigned");
    if (needsHumanDecision(issue)) reasons.push("Human decision required");
    if (hasExistingPr(issue, prs) && !recoverablePrNumbers.includes(issue.number)) {
      reasons.push("Pull request already exists");
    }
    for (const number of dependencies.get(issue.number)) {
      if (!isCompleted(byNumber.get(number))) reasons.push("Blocked by #" + number);
    }
    return {
      issue,
      scope: item?.scope ?? null,
      status: item?.status ?? null,
      dependencies: dependencies.get(issue.number),
      downstream: downstream(issue.number),
      reasons,
      ready: reasons.length === 0,
    };
  });
  entries.sort((a, b) =>
    (a.ready ? 0 : 1) - (b.ready ? 0 : 1) ||
    (SCOPE_RANK.get(a.scope) ?? 3) - (SCOPE_RANK.get(b.scope) ?? 3) ||
    b.downstream - a.downstream ||
    a.issue.number - b.issue.number
  );
  return { selected: entries.find((entry) => entry.ready) ?? null, entries };
}
