const STORAGE_KEY = "caritas-arbeitszeit-data-v1";
const DAYS_IN_TABLE = 31;
const UNIT_PER_HOUR = 100;

const monthNames = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const titleText = document.getElementById("titleText");
const tableBody = document.getElementById("tableBody");
const statusText = document.getElementById("statusText");
const monthHours = document.getElementById("monthHours");
const monthUnits = document.getElementById("monthUnits");

const calcBtn = document.getElementById("calcBtn");
const saveBtn = document.getElementById("saveBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const exportBtn = document.getElementById("exportBtn");

const allTimes = buildAllTimes();
let pickerHost = null;
let pickerInput = null;

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

init();

function init() {
  buildTableRows();
  ensureTimePickerHost();
  updateHeader();
  highlightTodayRow();
  loadMonthData();
  recalculateMonth();

  calcBtn.addEventListener("click", () => {
    recalculateMonth();
    setStatus("Berechnung aktualisiert.");
  });

  saveBtn.addEventListener("click", () => {
    saveMonthData();
    setStatus("Monat gespeichert.");
  });

  nextMonthBtn.addEventListener("click", () => {
    goToNextMonth();
  });

  exportBtn.addEventListener("click", async () => {
    await copyCsv();
  });

  tableBody.addEventListener("input", () => {
    recalculateMonth();
  });

  tableBody.addEventListener("focusin", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.classList.contains("time-input")) {
      openTimePicker(event.target);
    }
  });

  tableBody.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.classList.contains("time-input")) {
      openTimePicker(event.target);
    }
  });

  tableBody.addEventListener("keydown", (event) => {
    if (!(event.target instanceof HTMLInputElement) || !event.target.classList.contains("time-input")) return;

    if (event.key === "Escape") {
      hideTimePicker();
      event.target.blur();
    }

    if (event.key === "Enter") {
      const normalized = normalizeTime(event.target.value);
      event.target.value = normalized;
      hideTimePicker();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const insidePicker = pickerHost ? pickerHost.contains(target) : false;
    const insideTimeInput = target.closest(".time-input") !== null;
    if (!insidePicker && !insideTimeInput) {
      hideTimePicker();
    }
  });

  window.addEventListener("resize", () => {
    if (pickerInput) {
      positionTimePicker(pickerInput);
    }
  });
}

function buildTableRows() {
  const fragment = document.createDocumentFragment();

  for (let day = 1; day <= DAYS_IN_TABLE; day += 1) {
    const tr = document.createElement("tr");
    tr.dataset.day = String(day);

    tr.innerHTML = `
      <td class="day-cell">${String(day).padStart(2, "0")}.</td>
      <td><input class="time-input" type="text" inputmode="numeric" placeholder="HH:MM" data-field="earlyStart" /></td>
      <td><input class="time-input" type="text" inputmode="numeric" placeholder="HH:MM" data-field="earlyEnd" /></td>
      <td class="unit-cell" data-out="earlyUnits">0</td>
      <td><input class="time-input" type="text" inputmode="numeric" placeholder="HH:MM" data-field="lateStart" /></td>
      <td><input class="time-input" type="text" inputmode="numeric" placeholder="HH:MM" data-field="lateEnd" /></td>
      <td class="unit-cell" data-out="lateUnits">0</td>
      <td class="sum-cell" data-out="daySum">0</td>
    `;

    fragment.appendChild(tr);
  }

  tableBody.innerHTML = "";
  tableBody.appendChild(fragment);
}

function buildAllTimes() {
  const values = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      values.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return values;
}

function nowAsTimeString() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function ensureTimePickerHost() {
  if (pickerHost) return;

  pickerHost = document.createElement("div");
  pickerHost.id = "timePicker";
  pickerHost.className = "time-picker hidden";

  pickerHost.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const option = target.closest(".time-picker-option");
    if (!(option instanceof HTMLButtonElement) || !pickerInput) return;

    const activeInput = pickerInput;
    const value = option.dataset.value || "";
    activeInput.value = value;
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    hideTimePicker();
    activeInput.focus();
  });

  document.body.appendChild(pickerHost);
}

function getTimePickerValues(inputValue) {
  const currentTime = nowAsTimeString();
  const query = String(inputValue || "").trim();
  const filtered = query
    ? allTimes.filter((time) => time.startsWith(query))
    : allTimes;

  return [currentTime, ...filtered.filter((time) => time !== currentTime)];
}

function renderTimePicker(values, selectedValue) {
  if (!pickerHost) return;
  const currentTime = nowAsTimeString();

  const fragment = document.createDocumentFragment();

  for (const value of values) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "time-picker-option";
    btn.dataset.value = value;
    btn.textContent = value;

    if (value === currentTime) {
      btn.classList.add("time-picker-option-current");
    }

    if (value === selectedValue) {
      btn.classList.add("is-selected");
    }

    fragment.appendChild(btn);
  }

  pickerHost.innerHTML = "";
  pickerHost.appendChild(fragment);
}

function positionTimePicker(input) {
  if (!pickerHost) return;

  const rect = input.getBoundingClientRect();
  pickerHost.style.left = `${rect.left + window.scrollX}px`;
  pickerHost.style.top = `${rect.bottom + window.scrollY + 4}px`;
  pickerHost.style.width = `${Math.max(rect.width, 120)}px`;
}

function openTimePicker(input) {
  ensureTimePickerHost();
  pickerInput = input;

  const values = getTimePickerValues(input.value);
  renderTimePicker(values, input.value);
  positionTimePicker(input);
  pickerHost.classList.remove("hidden");
}

function hideTimePicker() {
  if (!pickerHost) return;
  pickerHost.classList.add("hidden");
  pickerInput = null;
}

function monthKey() {
  const mm = String(currentMonth + 1).padStart(2, "0");
  return `${currentYear}-${mm}`;
}

function loadAllMonthsData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllMonthsData(allMonths) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allMonths));
}

function updateHeader() {
  titleText.textContent = `Arbeitszeiten [${monthNames[currentMonth]} ${currentYear}]`;
}

function clearTableInputs() {
  const inputs = tableBody.querySelectorAll(".time-input");
  inputs.forEach((input) => {
    input.value = "";
  });
}

function collectMonthData() {
  const rows = Array.from(tableBody.querySelectorAll("tr"));

  return rows.map((row) => {
    const day = Number(row.dataset.day);
    return {
      day,
      earlyStart: row.querySelector("[data-field='earlyStart']")?.value || "",
      earlyEnd: row.querySelector("[data-field='earlyEnd']")?.value || "",
      lateStart: row.querySelector("[data-field='lateStart']")?.value || "",
      lateEnd: row.querySelector("[data-field='lateEnd']")?.value || ""
    };
  });
}

function applyMonthData(rowsData) {
  clearTableInputs();

  if (!Array.isArray(rowsData)) return;

  for (const entry of rowsData) {
    const day = Number(entry.day);
    if (!Number.isInteger(day) || day < 1 || day > DAYS_IN_TABLE) continue;

    const row = tableBody.querySelector(`tr[data-day='${day}']`);
    if (!row) continue;

    const earlyStart = row.querySelector("[data-field='earlyStart']");
    const earlyEnd = row.querySelector("[data-field='earlyEnd']");
    const lateStart = row.querySelector("[data-field='lateStart']");
    const lateEnd = row.querySelector("[data-field='lateEnd']");

    earlyStart.value = normalizeTime(entry.earlyStart);
    earlyEnd.value = normalizeTime(entry.earlyEnd);
    lateStart.value = normalizeTime(entry.lateStart);
    lateEnd.value = normalizeTime(entry.lateEnd);
  }
}

function saveMonthData() {
  const allMonths = loadAllMonthsData();
  const payload = {
    savedAt: new Date().toISOString(),
    rows: collectMonthData()
  };

  allMonths[monthKey()] = payload;
  saveAllMonthsData(allMonths);
}

function loadMonthData() {
  const allMonths = loadAllMonthsData();
  const monthData = allMonths[monthKey()];

  if (!monthData) {
    clearTableInputs();
    setStatus("Kein gespeicherter Monat gefunden.");
    return;
  }

  try {
    applyMonthData(monthData.rows);
    setStatus("Monat geladen.");
  } catch {
    clearTableInputs();
    setStatus("Fehler beim Laden. Datenformat ungültig.");
  }
}

function goToNextMonth() {
  currentMonth += 1;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear += 1;
  }

  updateHeader();
  highlightTodayRow();
  loadMonthData();
  recalculateMonth();
}

function highlightTodayRow() {
  const rows = Array.from(tableBody.querySelectorAll("tr"));
  rows.forEach((row) => row.classList.remove("today-row"));

  const now = new Date();
  const isCurrentMonthView = currentYear === now.getFullYear() && currentMonth === now.getMonth();
  if (!isCurrentMonthView) return;

  const todayDay = now.getDate();
  const todayRow = tableBody.querySelector(`tr[data-day='${todayDay}']`);
  if (todayRow) {
    todayRow.classList.add("today-row");
  }
}

function normalizeTime(value) {
  const str = String(value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(str)) return "";
  const [h, m] = str.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return str;
}

function toMinutes(timeText) {
  const val = normalizeTime(timeText);
  if (!val) return null;
  const [hh, mm] = val.split(":").map(Number);
  return hh * 60 + mm;
}

function minutesDiff(startText, endText) {
  const start = toMinutes(startText);
  const end = toMinutes(endText);
  if (start === null || end === null) return 0;

  let diff = end - start;
  if (diff < 0) {
    diff += 24 * 60;
  }
  return diff;
}

function minutesToUnits(minutes) {
  return Math.round((minutes / 60) * UNIT_PER_HOUR);
}

function minutesToHourString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function recalculateMonth() {
  const rows = Array.from(tableBody.querySelectorAll("tr"));
  let monthMinutesTotal = 0;
  let monthUnitsTotal = 0;

  for (const row of rows) {
    const earlyStart = row.querySelector("[data-field='earlyStart']")?.value || "";
    const earlyEnd = row.querySelector("[data-field='earlyEnd']")?.value || "";
    const lateStart = row.querySelector("[data-field='lateStart']")?.value || "";
    const lateEnd = row.querySelector("[data-field='lateEnd']")?.value || "";

    const earlyMinutes = minutesDiff(earlyStart, earlyEnd);
    const lateMinutes = minutesDiff(lateStart, lateEnd);

    const earlyUnits = minutesToUnits(earlyMinutes);
    const lateUnits = minutesToUnits(lateMinutes);

    const dayMinutes = earlyMinutes + lateMinutes;
    const dayUnits = earlyUnits + lateUnits;

    row.querySelector("[data-out='earlyUnits']").textContent = String(earlyUnits);
    row.querySelector("[data-out='lateUnits']").textContent = String(lateUnits);
    row.querySelector("[data-out='daySum']").textContent = `${minutesToHourString(dayMinutes)} (${dayUnits})`;

    monthMinutesTotal += dayMinutes;
    monthUnitsTotal += dayUnits;
  }

  monthHours.textContent = minutesToHourString(monthMinutesTotal);
  monthUnits.textContent = String(monthUnitsTotal);
}

function buildCsvText() {
  const lines = [];
  lines.push(`Arbeitszeiten;${monthNames[currentMonth]} ${currentYear}`);
  lines.push("Datum;Früh Start;Früh Ende;Früh Einheiten;Spät Start;Spät Ende;Spät Einheiten;Summe");

  const rows = Array.from(tableBody.querySelectorAll("tr"));
  for (const row of rows) {
    const dayLabel = row.querySelector(".day-cell")?.textContent || "";
    const earlyStart = row.querySelector("[data-field='earlyStart']")?.value || "";
    const earlyEnd = row.querySelector("[data-field='earlyEnd']")?.value || "";
    const earlyUnits = row.querySelector("[data-out='earlyUnits']")?.textContent || "0";
    const lateStart = row.querySelector("[data-field='lateStart']")?.value || "";
    const lateEnd = row.querySelector("[data-field='lateEnd']")?.value || "";
    const lateUnits = row.querySelector("[data-out='lateUnits']")?.textContent || "0";
    const daySum = row.querySelector("[data-out='daySum']")?.textContent || "";

    lines.push([
      dayLabel,
      earlyStart,
      earlyEnd,
      earlyUnits,
      lateStart,
      lateEnd,
      lateUnits,
      daySum
    ].join(";"));
  }

  lines.push(`Monats-Total Stunden;${monthHours.textContent}`);
  lines.push(`Monats-Total Einheiten;${monthUnits.textContent}`);

  return lines.join("\n");
}

async function copyCsv() {
  const csv = buildCsvText();

  try {
    await navigator.clipboard.writeText(csv);
    setStatus("CSV wurde in die Zwischenablage kopiert.");
  } catch {
    // Fallback for restrictive browser contexts
    const area = document.createElement("textarea");
    area.value = csv;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
    setStatus("CSV kopiert (Fallback).");
  }
}

function setStatus(text) {
  statusText.textContent = text;
}
