const STORAGE_KEY = "task_manager_tasks_v1";
const TIMER_STORAGE_KEY = "task_manager_running_timer_v1";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const form = document.getElementById("task-form");
const clientInput = document.getElementById("client");
const taskList = document.getElementById("task-list");
const tasksHeading = document.getElementById("tasks-heading");
const reportEl = document.getElementById("report");
const monthlyReportEl = document.getElementById("monthly-report");
const monthlyTaskListEl = document.getElementById("monthly-task-list");
const monthTabsEl = document.getElementById("month-tabs");
const generateReportBtn = document.getElementById("generate-report");
const exportReportBtn = document.getElementById("export-report");
const exportMonthlyReportBtn = document.getElementById("export-monthly-report");
const clearAllBtn = document.getElementById("clear-all");

const timerTaskNameInput = document.getElementById("timer-task-name");
const timerClientInput = document.getElementById("timer-client");
const timerBillableInput = document.getElementById("timer-billable");
const timerElapsedEl = document.getElementById("timer-elapsed");
const timerStartedAtEl = document.getElementById("timer-started-at");
const startTimerBtn = document.getElementById("start-timer");
const stopTimerBtn = document.getElementById("stop-timer");
const resetTimerBtn = document.getElementById("reset-timer");

let tasks = loadTasks();
let activeMonth = new Date().getMonth();
let runningTimer = loadRunningTimer();
let timerIntervalId = null;

renderTasks();
renderWeeklyReport();
renderMonthTabs();
renderMonthlyReport();
initializeTimerUi();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = document.getElementById("title").value.trim();
  const client = clientInput.value.trim() || "General";
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

  if (
    !isDateInMonth(date, activeMonth) ||
    !isDateInMonth(startDate, activeMonth) ||
    !isDateInMonth(endDate, activeMonth) ||
    !isDateInMonth(estimationDate, activeMonth)
  ) {
    window.alert(`Please add this task under ${MONTH_NAMES[activeMonth]}. Select matching dates for this month tab.`);
    return;
  }

  tasks.unshift({
    id: crypto.randomUUID(),
    title,
    client,
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
  renderMonthTabs();
  renderMonthlyReport();
});

generateReportBtn.addEventListener("click", () => {
  renderWeeklyReport();
});

exportReportBtn.addEventListener("click", () => {
  exportWeeklyReport();
});

exportMonthlyReportBtn.addEventListener("click", () => {
  exportMonthlyReport();
});

clearAllBtn.addEventListener("click", () => {
  const monthTasks = getTasksForMonth(activeMonth);
  if (!monthTasks.length) return;
  const confirmed = window.confirm(`Delete all tasks for ${MONTH_NAMES[activeMonth]}?`);
  if (!confirmed) return;

  tasks = tasks.filter((task) => toDate(task.date).getMonth() !== activeMonth);
  saveTasks();
  renderTasks();
  renderWeeklyReport();
  renderMonthTabs();
  renderMonthlyReport();
});

monthTabsEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const monthValue = target.getAttribute("data-month");
  if (monthValue === null) return;

  const parsedMonth = Number(monthValue);
  if (Number.isNaN(parsedMonth)) return;

  activeMonth = parsedMonth;
  renderTasks();
  renderMonthTabs();
  renderMonthlyReport();
});

function initializeTimerUi() {
  startTimerBtn.addEventListener("click", startTimer);
  stopTimerBtn.addEventListener("click", stopTimer);
  resetTimerBtn.addEventListener("click", resetTimer);
  syncTimerUi();
}

function startTimer() {
  if (runningTimer) {
    window.alert("A timer is already running.");
    return;
  }

  const taskName = timerTaskNameInput.value.trim();
  const client = timerClientInput.value.trim();
  const billable = timerBillableInput.value === "yes";

  if (!taskName || !client) {
    window.alert("Please provide both task name and client before starting the timer.");
    return;
  }

  runningTimer = {
    taskName,
    client,
    billable,
    startedAtIso: new Date().toISOString()
  };

  saveRunningTimer();
  syncTimerUi();
}

function stopTimer() {
  if (!runningTimer) {
    window.alert("No active timer to stop.");
    return;
  }

  const startedAt = new Date(runningTimer.startedAtIso);
  const stoppedAt = new Date();
  const elapsedMs = stoppedAt.getTime() - startedAt.getTime();

  if (elapsedMs < 1000) {
    window.alert("Timer ran for less than 1 second. Keep it running a little longer.");
    return;
  }

  const hours = Number((elapsedMs / 3600000).toFixed(2));
  const timerDate = toInputDate(stoppedAt);

  tasks.unshift({
    id: crypto.randomUUID(),
    title: runningTimer.taskName,
    client: runningTimer.client,
    date: timerDate,
    startDate: toInputDate(startedAt),
    endDate: toInputDate(stoppedAt),
    hours,
    estimationDate: timerDate,
    estimationHours: hours,
    notes: `Tracked by timer (${formatDateTime(startedAt)} - ${formatDateTime(stoppedAt)})`,
    billable: runningTimer.billable,
    completed: false,
    createdAt: stoppedAt.toISOString()
  });

  activeMonth = stoppedAt.getMonth();
  saveTasks();

  runningTimer = null;
  saveRunningTimer();
  syncTimerUi();

  renderTasks();
  renderWeeklyReport();
  renderMonthTabs();
  renderMonthlyReport();
}

function resetTimer() {
  if (!runningTimer) {
    timerTaskNameInput.value = "";
    timerClientInput.value = "";
    timerBillableInput.value = "yes";
    syncTimerUi();
    return;
  }

  const confirmed = window.confirm("Reset the active timer without saving time?");
  if (!confirmed) return;

  runningTimer = null;
  saveRunningTimer();
  syncTimerUi();
}

function syncTimerUi() {
  if (timerIntervalId) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }

  if (!runningTimer) {
    timerElapsedEl.textContent = "00:00:00";
    timerStartedAtEl.textContent = "Not started";
    startTimerBtn.disabled = false;
    stopTimerBtn.disabled = true;
    return;
  }

  const startedAt = new Date(runningTimer.startedAtIso);
  timerStartedAtEl.textContent = `Started: ${formatDateTime(startedAt)}`;
  startTimerBtn.disabled = true;
  stopTimerBtn.disabled = false;

  timerTaskNameInput.value = runningTimer.taskName;
  timerClientInput.value = runningTimer.client;
  timerBillableInput.value = runningTimer.billable ? "yes" : "no";

  const updateElapsed = () => {
    const elapsedMs = Date.now() - startedAt.getTime();
    timerElapsedEl.textContent = formatDuration(elapsedMs);
  };

  updateElapsed();
  timerIntervalId = window.setInterval(updateElapsed, 1000);
}

function renderTasks() {
  taskList.innerHTML = "";
  const monthTasks = getTasksForMonth(activeMonth);
  tasksHeading.textContent = `Your Tasks (${MONTH_NAMES[activeMonth]})`;
  clearAllBtn.textContent = `Clear ${MONTH_NAMES[activeMonth]}`;

  if (!monthTasks.length) {
    taskList.innerHTML = `<li class="empty">No tasks in ${MONTH_NAMES[activeMonth]}. Add your first task for this month above.</li>`;
    return;
  }

  monthTasks.forEach((task) => {
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
        <span class="badge">Client: ${escapeHtml(task.client || "General")}</span>
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
  renderMonthTabs();
  renderMonthlyReport();
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

  const totals = buildTotals(weekTasks);

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

function renderMonthTabs() {
  monthTabsEl.innerHTML = "";

  MONTH_NAMES.forEach((name, index) => {
    const monthTasks = getTasksForMonth(index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `month-tab ${activeMonth === index ? "active" : ""}`;
    button.setAttribute("data-month", String(index));
    button.textContent = `${name.slice(0, 3)} (${monthTasks.length})`;
    monthTabsEl.appendChild(button);
  });
}

function renderMonthlyReport() {
  const monthTasks = getTasksForMonth(activeMonth);

  if (!monthTasks.length) {
    monthlyReportEl.innerHTML = `<div class="empty">No tasks in ${MONTH_NAMES[activeMonth]}.</div>`;
    monthlyTaskListEl.innerHTML = "";
    return;
  }

  const totals = buildTotals(monthTasks);

  monthlyReportEl.innerHTML = `
    <div class="muted">Month: ${MONTH_NAMES[activeMonth]}</div>
    <div class="report-grid">
      <div class="card"><strong>${totals.totalTasks}</strong><div class="muted">Total Tasks</div></div>
      <div class="card"><strong>${totals.completed}</strong><div class="muted">Completed</div></div>
      <div class="card"><strong>${totals.totalHours.toFixed(2)}</strong><div class="muted">Actual Hours</div></div>
      <div class="card"><strong>${totals.totalEstimationHours.toFixed(2)}</strong><div class="muted">Estimation Hours</div></div>
      <div class="card"><strong>${totals.billableHours.toFixed(2)}</strong><div class="muted">Billable Hours</div></div>
      <div class="card"><strong>${totals.nonBillableHours.toFixed(2)}</strong><div class="muted">Non-Billable Hours</div></div>
    </div>
  `;

  monthlyTaskListEl.innerHTML = "";

  monthTasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item";
    li.innerHTML = `
      <div class="row">
        <strong>${escapeHtml(task.title)}</strong>
        <span class="badge">${formatDate(task.date)}</span>
      </div>
      <div class="meta">
        <span class="badge">Client: ${escapeHtml(task.client || "General")}</span>
        <span class="badge">Actual: ${task.hours.toFixed(2)} hrs</span>
        <span class="badge">Est: ${(task.estimationHours ?? task.hours).toFixed(2)} hrs</span>
        <span class="badge ${task.billable ? "billable" : "nonbillable"}">${task.billable ? "Billable" : "Non-Billable"}</span>
        <span class="badge">${task.completed ? "Completed" : "Open"}</span>
      </div>
    `;
    monthlyTaskListEl.appendChild(li);
  });
}

function exportWeeklyReport() {
  const { start, end } = currentWeekRange();
  const weekTasks = getCurrentWeekTasks();

  if (!weekTasks.length) {
    window.alert("No tasks available for this week to export.");
    return;
  }

  const totals = buildTotals(weekTasks);

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
      "Client",
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
    rows.push(taskToCsvRow(task));
  });

  downloadCsv(rows, `weekly-report-${start.toISOString().slice(0, 10)}.csv`);
}

function exportMonthlyReport() {
  const monthTasks = getTasksForMonth(activeMonth);

  if (!monthTasks.length) {
    window.alert(`No tasks available for ${MONTH_NAMES[activeMonth]} to export.`);
    return;
  }

  const totals = buildTotals(monthTasks);

  const rows = [
    ["Monthly Report"],
    ["Month", MONTH_NAMES[activeMonth]],
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
      "Client",
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

  monthTasks.forEach((task) => {
    rows.push(taskToCsvRow(task));
  });

  downloadCsv(rows, `monthly-report-${MONTH_NAMES[activeMonth].toLowerCase()}.csv`);
}

function getCurrentWeekTasks() {
  const { start, end } = currentWeekRange();

  return tasks.filter((task) => {
    const taskDate = toDate(task.date);
    return taskDate >= start && taskDate <= end;
  });
}

function getTasksForMonth(monthIndex) {
  return tasks.filter((task) => toDate(task.date).getMonth() === monthIndex);
}

function buildTotals(taskGroup) {
  return taskGroup.reduce(
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
      client: task.client || "General",
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

function loadRunningTimer() {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.taskName || !parsed.client || !parsed.startedAtIso) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveRunningTimer() {
  if (!runningTimer) {
    localStorage.removeItem(TIMER_STORAGE_KEY);
    return;
  }

  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(runningTimer));
}

function toDate(dateInput) {
  return new Date(`${dateInput}T00:00:00`);
}

function toInputDate(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function isDateInMonth(dateInput, monthIndex) {
  return toDate(dateInput).getMonth() === monthIndex;
}

function formatDate(dateInput) {
  const date = typeof dateInput === "string" ? toDate(dateInput) : dateInput;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateTime(dateInput) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

function taskToCsvRow(task) {
  return [
    task.title,
    task.client || "General",
    formatDate(task.date),
    formatDate(task.startDate || task.date),
    formatDate(task.endDate || task.date),
    task.hours.toFixed(2),
    formatDate(task.estimationDate || task.date),
    (task.estimationHours ?? task.hours).toFixed(2),
    task.billable ? "Yes" : "No",
    task.completed ? "Completed" : "Open",
    task.notes || ""
  ];
}

function downloadCsv(rows, fileName) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
