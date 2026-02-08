const STORAGE_KEY = "task_manager_tasks_v1";

const form = document.getElementById("task-form");
const taskList = document.getElementById("task-list");
const reportEl = document.getElementById("report");
const generateReportBtn = document.getElementById("generate-report");
const exportReportBtn = document.getElementById("export-report");
const clearAllBtn = document.getElementById("clear-all");

let tasks = loadTasks();

renderTasks();
renderWeeklyReport();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = document.getElementById("title").value.trim();
  const date = document.getElementById("date").value;
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;
  const hours = Number(document.getElementById("hours").value);
  const estimationDate = document.getElementById("estimation-date").value;
  const estimationHours = Number(document.getElementById("estimation-hours").value);
  const notes = document.getElementById("notes").value.trim();
  const billable = document.getElementById("billable").value === "yes";

  if (
    !title ||
    !date ||
    !startDate ||
    !endDate ||
    !estimationDate ||
    Number.isNaN(hours) ||
    Number.isNaN(estimationHours) ||
    hours < 0 ||
    estimationHours < 0
  ) {
    return;
  }

  if (toDate(startDate) > toDate(endDate)) {
    window.alert("Start date cannot be after end date.");
    return;
  }

  tasks.unshift({
    id: crypto.randomUUID(),
    title,
    date,
    startDate,
    endDate,
    hours,
    estimationDate,
    estimationHours,
    notes,
    billable,
    completed: false,
    createdAt: new Date().toISOString()
  });

  saveTasks();
  form.reset();
  renderTasks();
  renderWeeklyReport();
});

generateReportBtn.addEventListener("click", () => {
  renderWeeklyReport();
});

exportReportBtn.addEventListener("click", () => {
  exportWeeklyReport();
});

clearAllBtn.addEventListener("click", () => {
  if (!tasks.length) return;
  const confirmed = window.confirm("Delete all tasks?");
  if (!confirmed) return;
  tasks = [];
  saveTasks();
  renderTasks();
  renderWeeklyReport();
});

function renderTasks() {
  taskList.innerHTML = "";

  if (!tasks.length) {
    taskList.innerHTML = '<li class="empty">No tasks yet. Add your first task above.</li>';
    return;
  }

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item";

    li.innerHTML = `
      <div class="row">
        <strong>${escapeHtml(task.title)}</strong>
        <div class="actions">
          <button data-action="toggle" data-id="${task.id}">${task.completed ? "Mark Open" : "Mark Done"}</button>
          <button class="danger" data-action="delete" data-id="${task.id}">Delete</button>
        </div>
      </div>
      <div class="meta">
        <span class="badge">Date: ${formatDate(task.date)}</span>
        <span class="badge">Start: ${formatDate(task.startDate || task.date)}</span>
        <span class="badge">End: ${formatDate(task.endDate || task.date)}</span>
        <span class="badge">Actual: ${task.hours.toFixed(2)} hrs</span>
        <span class="badge">Est Date: ${formatDate(task.estimationDate || task.date)}</span>
        <span class="badge">Est: ${(task.estimationHours ?? task.hours).toFixed(2)} hrs</span>
        <span class="badge ${task.billable ? "billable" : "nonbillable"}">${task.billable ? "Billable" : "Non-Billable"}</span>
        <span class="badge">${task.completed ? "Completed" : "Open"}</span>
      </div>
      ${task.notes ? `<div class="muted">${escapeHtml(task.notes)}</div>` : ""}
    `;

    taskList.appendChild(li);
  });
}

taskList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.getAttribute("data-action");
  const id = target.getAttribute("data-id");
  if (!action || !id) return;

  if (action === "delete") {
    tasks = tasks.filter((task) => task.id !== id);
  }

  if (action === "toggle") {
    tasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
  }

  saveTasks();
  renderTasks();
  renderWeeklyReport();
});

function renderWeeklyReport() {
  const { start, end } = currentWeekRange();
  const weekTasks = getCurrentWeekTasks();

  if (!weekTasks.length) {
    reportEl.innerHTML = `
      <div class="empty">
        No tasks for this week (${formatDate(start)} - ${formatDate(end)}).
      </div>
    `;
    return;
  }

  const totals = buildWeeklyTotals(weekTasks);

  reportEl.innerHTML = `
    <div class="muted">Week: ${formatDate(start)} - ${formatDate(end)}</div>
    <div class="report-grid">
      <div class="card"><strong>${totals.totalTasks}</strong><div class="muted">Total Tasks</div></div>
      <div class="card"><strong>${totals.completed}</strong><div class="muted">Completed</div></div>
      <div class="card"><strong>${totals.totalHours.toFixed(2)}</strong><div class="muted">Actual Hours</div></div>
      <div class="card"><strong>${totals.totalEstimationHours.toFixed(2)}</strong><div class="muted">Estimation Hours</div></div>
      <div class="card"><strong>${totals.billableHours.toFixed(2)}</strong><div class="muted">Billable Hours</div></div>
      <div class="card"><strong>${totals.nonBillableHours.toFixed(2)}</strong><div class="muted">Non-Billable Hours</div></div>
    </div>
  `;
}

function exportWeeklyReport() {
  const { start, end } = currentWeekRange();
  const weekTasks = getCurrentWeekTasks();

  if (!weekTasks.length) {
    window.alert("No tasks available for this week to export.");
    return;
  }

  const totals = buildWeeklyTotals(weekTasks);

  const rows = [
    ["Weekly Report"],
    ["Week Start", formatDate(start), "Week End", formatDate(end)],
    [],
    ["Summary"],
    ["Total Tasks", totals.totalTasks],
    ["Completed", totals.completed],
    ["Actual Hours", totals.totalHours.toFixed(2)],
    ["Estimation Hours", totals.totalEstimationHours.toFixed(2)],
    ["Billable Hours", totals.billableHours.toFixed(2)],
    ["Non-Billable Hours", totals.nonBillableHours.toFixed(2)],
    [],
    [
      "Task",
      "Date",
      "Start Date",
      "End Date",
      "Actual Hours",
      "Estimation Date",
      "Estimation Hours",
      "Billable",
      "Status",
      "Notes"
    ]
  ];

  weekTasks.forEach((task) => {
    rows.push([
      task.title,
      formatDate(task.date),
      formatDate(task.startDate || task.date),
      formatDate(task.endDate || task.date),
      task.hours.toFixed(2),
      formatDate(task.estimationDate || task.date),
      (task.estimationHours ?? task.hours).toFixed(2),
      task.billable ? "Yes" : "No",
      task.completed ? "Completed" : "Open",
      task.notes || ""
    ]);
  });

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `weekly-report-${start.toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getCurrentWeekTasks() {
  const { start, end } = currentWeekRange();
  return tasks.filter((task) => {
    const taskDate = toDate(task.date);
    return taskDate >= start && taskDate <= end;
  });
}

function buildWeeklyTotals(weekTasks) {
  return weekTasks.reduce(
    (acc, task) => {
      const estimationHours = task.estimationHours ?? task.hours;

      acc.totalTasks += 1;
      if (task.completed) acc.completed += 1;
      if (task.billable) acc.billableHours += task.hours;
      else acc.nonBillableHours += task.hours;
      acc.totalHours += task.hours;
      acc.totalEstimationHours += estimationHours;
      return acc;
    },
    {
      totalTasks: 0,
      completed: 0,
      totalHours: 0,
      totalEstimationHours: 0,
      billableHours: 0,
      nonBillableHours: 0
    }
  );
}

function currentWeekRange() {
  const now = new Date();
  const day = now.getDay();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - day);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((task) => ({
      ...task,
      startDate: task.startDate || task.date,
      endDate: task.endDate || task.date,
      estimationDate: task.estimationDate || task.date,
      estimationHours: task.estimationHours ?? task.hours
    }));
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function toDate(dateInput) {
  return new Date(`${dateInput}T00:00:00`);
}

function formatDate(dateInput) {
  const date = typeof dateInput === "string" ? toDate(dateInput) : dateInput;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (!stringValue.includes(",") && !stringValue.includes("\"") && !stringValue.includes("\n")) {
    return stringValue;
  }
  return `"${stringValue.replaceAll("\"", "\"\"")}"`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
