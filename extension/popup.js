/**
 * Popup Script — Form Copilot
 */

const DEFAULT_CRM = {
  name: "Jane Doe",
  first_name: "Jane",
  last_name: "Doe",
  email: "jane.doe@acme.com",
  phone: "+1-555-867-5309",
  company: "Acme Corp",
  job_title: "VP of Sales",
  address: "742 Evergreen Terrace",
  city: "Springfield",
  state: "IL",
  zip: "62704",
  country: "United States",
  website: "https://acme.com",
  notes: "Key decision maker. Prefers email.",
};

const CRM_KEYS = [
  "name", "first_name", "last_name", "email", "phone",
  "company", "job_title", "address", "city", "state",
  "zip", "country", "website"
];

const statusEl = document.getElementById("status");
const autofillBtn = document.getElementById("autofill-btn");
const scanBtn = document.getElementById("scan-btn");
const clearBtn = document.getElementById("clear-btn");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const toggleLink = document.getElementById("toggle-fields");
const crmFieldsEl = document.getElementById("crm-fields");
const scanResultsEl = document.getElementById("scan-results");
const profileSelect = document.getElementById("profile-select");
const addProfileBtn = document.getElementById("add-profile-btn");

let profiles = [DEFAULT_CRM];
let activeProfileIndex = 0;

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type;
}

// ─── CRM Data Persistence ───────────────────────────────────

function loadCrmData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["crm_profiles", "active_profile_index"], (result) => {
      profiles = result.crm_profiles || [DEFAULT_CRM];
      activeProfileIndex = result.active_profile_index || 0;
      updateProfileUI();
      resolve(profiles[activeProfileIndex]);
    });
  });
}

function saveCrmData() {
  const currentData = readFieldsFromUI();
  profiles[activeProfileIndex] = currentData;
  return new Promise((resolve) => {
    chrome.storage.local.set({ 
      crm_profiles: profiles, 
      active_profile_index: activeProfileIndex 
    }, resolve);
  });
}

function updateProfileUI() {
  profileSelect.innerHTML = "";
  profiles.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = p.name || `Profile ${i + 1}`;
    if (i === activeProfileIndex) opt.selected = true;
    profileSelect.appendChild(opt);
  });
}

function readFieldsFromUI() {
  const data = {};
  CRM_KEYS.forEach((key) => {
    const el = document.getElementById(`crm-${key}`);
    if (el) data[key] = el.value;
  });
  data.notes = DEFAULT_CRM.notes;
  return data;
}

function populateUI(data) {
  CRM_KEYS.forEach((key) => {
    const el = document.getElementById(`crm-${key}`);
    if (el) el.value = data[key] || "";
  });
}

// ─── Init ───────────────────────────────────────────────────

loadCrmData().then(populateUI);

profileSelect.addEventListener("change", async (e) => {
  // Save current profile before switching
  await saveCrmData();
  activeProfileIndex = parseInt(e.target.value);
  populateUI(profiles[activeProfileIndex]);
  await chrome.storage.local.set({ active_profile_index: activeProfileIndex });
});

addProfileBtn.addEventListener("click", async () => {
  const newProfile = { ...DEFAULT_CRM, name: `New Profile ${profiles.length + 1}` };
  profiles.push(newProfile);
  activeProfileIndex = profiles.length - 1;
  updateProfileUI();
  populateUI(newProfile);
  await saveCrmData();
});

toggleLink.addEventListener("click", () => {
  const hidden = crmFieldsEl.classList.toggle("hidden");
  toggleLink.innerHTML = hidden 
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Manage CRM Data`
    : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> Hide CRM Data`;
});

CRM_KEYS.forEach((key) => {
  const el = document.getElementById(`crm-${key}`);
  if (el) {
    el.addEventListener("input", async () => {
      await saveCrmData();
      // Update select option text if name changes
      if (key === "name") {
        profileSelect.options[activeProfileIndex].textContent = el.value || `Profile ${activeProfileIndex + 1}`;
      }
    });
  }
});

// ─── Helpers ────────────────────────────────────────────────

async function injectAndSend(action) {
  const currentData = readFieldsFromUI();
  profiles[activeProfileIndex] = currentData;
  await saveCrmData();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");

  // First, ensure scripts are injected in all frames
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ["mapping.js", "content.js"],
  });

  // Then, send a message to every frame in the tab
  const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
  const results = await Promise.all(
    frames.map(frame => 
      chrome.tabs.sendMessage(tab.id, { action, crmData: currentData }, { frameId: frame.frameId })
        .catch(() => null) // Ignore frames that don't respond
    )
  );

  // Aggregate results (e.g., for scan results)
  if (action === "scan") {
    const aggregate = { total: 0, high: 0, medium: 0, none: 0, results: [] };
    results.forEach(res => {
      if (res) {
        aggregate.total += res.total || 0;
        aggregate.high += res.high || 0;
        aggregate.medium += res.medium || 0;
        aggregate.none += res.none || 0;
        aggregate.results = aggregate.results.concat(res.results || []);
      }
    });
    return aggregate;
  }

  if (action === "autofill") {
    const aggregate = { total: 0, filled: 0 };
    results.forEach(res => {
      if (res) {
        aggregate.total += res.total || 0;
        aggregate.filled += res.filled || 0;
      }
    });
    return aggregate;
  }

  return results[0];
}

// ─── Scan ───────────────────────────────────────────────────

scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  setStatus("Scanning…");
  scanResultsEl.classList.add("hidden");

  try {
    const result = await injectAndSend("scan");

    if (result) {
      setStatus(`Scanned ${result.total} fields`, "success");
      scanResultsEl.innerHTML = `
        <span class="dot dot-green"></span>${result.high} matched (high)&nbsp;&nbsp;
        <span class="dot dot-yellow"></span>${result.medium} medium&nbsp;&nbsp;
        <span class="dot dot-red"></span>${result.none} unmatched
      `;
      scanResultsEl.classList.remove("hidden");
    }
  } catch (err) {
    console.error("[Form Copilot]", err);
    setStatus("Scan failed — check console", "error");
  } finally {
    scanBtn.disabled = false;
  }
});

// ─── Autofill ───────────────────────────────────────────────

autofillBtn.addEventListener("click", async () => {
  autofillBtn.disabled = true;
  setStatus("Filling…");

  try {
    const result = await injectAndSend("autofill");

    if (result && result.filled > 0) {
      setStatus(`✓ Filled ${result.filled} of ${result.total} fields`, "success");
    } else if (result) {
      setStatus("No matching fields found", "error");
    }
    scanResultsEl.classList.add("hidden");
  } catch (err) {
    console.error("[Form Copilot]", err);
    setStatus("Failed — check console", "error");
  } finally {
    autofillBtn.disabled = false;
  }
});

// ─── Export/Import ─────────────────────────────────────────

exportBtn.addEventListener("click", () => {
  chrome.storage.local.get(null, (allData) => {
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form-copilot-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Backup exported!", "success");
  });
});

importBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        chrome.storage.local.set(data, () => {
          setStatus("Data restored!", "success");
          loadCrmData().then(populateUI);
        });
      } catch (err) {
        setStatus("Invalid backup file", "error");
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

// ─── Clear ──────────────────────────────────────────────────

clearBtn.addEventListener("click", () => {
  if (confirm("Reset all data, profiles, and learned mappings?")) {
    chrome.storage.local.clear(() => {
      profiles = [DEFAULT_CRM];
      activeProfileIndex = 0;
      updateProfileUI();
      populateUI(DEFAULT_CRM);
      scanResultsEl.classList.add("hidden");
      setStatus("All data reset", "success");
    });
  }
});
