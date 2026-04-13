/**
 * Content Script — Form Copilot
 *
 * 1. Scans the DOM for form fields.
 * 2. Maps fields to CRM schema via heuristic engine.
 * 3. Shows a visual overlay with color-coded field highlights.
 * 4. Autofills matched fields and dispatches React-compatible events.
 * 5. Watches for user corrections and persists them for future visits.
 */

(function () {
  "use strict";

  // ─── FORM DETECTION ───────────────────────────────────────────

  function findLabel(el) {
    // 1. Explicit <label for="id">
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.textContent.trim()) return label.textContent.trim();
    }

    // 2. Implicit wrapping <label>
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.textContent.trim()) return parentLabel.textContent.trim();

    // 3. Aria-label or aria-labelledby
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl && labelEl.textContent.trim()) return labelEl.textContent.trim();
    }

    // 4. Placeholder as fallback
    if (el.placeholder && el.placeholder.trim()) return el.placeholder.trim();

    // 5. Nearby text (Previous Sibling or Parent Text)
    // Check previous element siblings
    let prev = el.previousElementSibling;
    while (prev) {
      const text = prev.textContent.trim();
      if (text && (prev.tagName === "LABEL" || prev.tagName === "SPAN" || prev.tagName === "DIV" || prev.tagName === "P")) {
        // If it's a long paragraph, it might not be a label, but for simplicity we'll take it if it's short
        if (text.length < 100) return text;
      }
      prev = prev.previousElementSibling;
    }

    // Check parent's text content (excluding the element itself)
    const parent = el.parentElement;
    if (parent) {
      const parentText = Array.from(parent.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .join(" ");
      if (parentText) return parentText;
    }

    return "";
  }

  function isVisible(el) {
    if (el.type === "hidden") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    return true;
  }

  function detectFields() {
    const fields = [];
    const skipTypes = ["submit", "button", "reset", "file", "image", "checkbox", "radio", "password"];
    const sensitiveKeywords = ["cvv", "cvc", "cc-", "card-number", "password", "ssn", "otp", "code"];

    function isSensitive(el) {
      const attributes = [el.name, el.id, el.placeholder, el.getAttribute("aria-label")].filter(Boolean).join(" ").toLowerCase();
      return sensitiveKeywords.some(kw => attributes.includes(kw));
    }

    function traverse(root) {
      const elements = root.querySelectorAll("input, textarea, select");
      elements.forEach((el) => {
        if (!isVisible(el)) return;
        if (el.tagName === "INPUT" && skipTypes.includes(el.type)) return;
        
        // Skip sensitive fields
        if (isSensitive(el)) {
          console.log(`[Form Copilot] Skipping sensitive field: name="${el.name}" id="${el.id}"`);
          return;
        }

        fields.push({
          element: el,
          tag: el.tagName.toLowerCase(),
          type: el.type || "",
          name: el.name || "",
          id: el.id || "",
          placeholder: el.placeholder || "",
          label: findLabel(el),
        });
      });

      // Traverse Shadow DOM
      const allNodes = root.querySelectorAll("*");
      allNodes.forEach(node => {
        if (node.shadowRoot) {
          traverse(node.shadowRoot);
        }
      });
    }

    traverse(document);
    return fields;
  }

  // ─── MAPPING ──────────────────────────────────────────────────

  function fieldIdentifier(field) {
    // A more robust identifier: domain + name/id + type + label (sanitized)
    // We use a combination of stable attributes
    const parts = [
      field.name || "",
      field.id || "",
      field.tag || "",
      field.type || "",
      (field.label || "").substring(0, 30) // truncated label
    ];
    return parts.filter(Boolean).join("|").toLowerCase();
  }

  function matchFieldWithConfidence(field, learned) {
    const fid = fieldIdentifier(field);

    // 1. Prioritize learned mappings
    if (fid && learned[fid]) {
      console.log(`[Form Copilot] Using learned mapping for "${fid}": ${learned[fid]}`);
      return { crmKey: learned[fid], confidence: "high", source: "learned" };
    }

    // 2. Use heuristic engine from mapping.js
    if (window.__FC_Mapping && window.__FC_Mapping.matchField) {
      const match = window.__FC_Mapping.matchField(field);
      if (match) {
        return { 
          crmKey: match.crmKey, 
          confidence: match.confidence, 
          source: "heuristic",
          score: match.score 
        };
      }
    }

    return { crmKey: null, confidence: null, source: null };
  }

  // ─── VISUAL OVERLAY ───────────────────────────────────────────

  const OVERLAY_CLASS = "__fc-overlay";
  const BADGE_CLASS = "__fc-badge";

  function injectOverlayStyles() {
    if (document.getElementById("__fc-styles")) return;
    const style = document.createElement("style");
    style.id = "__fc-styles";
    style.textContent = `
      .${OVERLAY_CLASS} {
        position: absolute;
        pointer-events: none;
        border-radius: 6px;
        z-index: 2147483646;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }
      .__fc-overlay--high {
        border: 2px solid #10b981;
        background: rgba(16, 185, 129, 0.05);
      }
      .__fc-overlay--medium {
        border: 2px solid #f59e0b;
        background: rgba(245, 158, 11, 0.05);
      }
      .__fc-overlay--none {
        border: 2px solid #ef4444;
        background: rgba(239, 68, 68, 0.05);
      }
      .${BADGE_CLASS} {
        position: absolute;
        top: -12px;
        left: 4px;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        color: #fff;
        white-space: nowrap;
        pointer-events: none;
        z-index: 2147483647;
        line-height: 14px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .__fc-badge--high { background: #10b981; }
      .__fc-badge--medium { background: #f59e0b; }
      .__fc-badge--none { background: #ef4444; }
      
      .__fc-summary {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #ffffff;
        color: #1e293b;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        padding: 16px;
        border-radius: 12px;
        z-index: 2147483647;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1);
        border: 1px solid #e2e8f0;
        line-height: 1.6;
        min-width: 220px;
      }
      .__fc-summary strong { 
        display: block;
        font-size: 14px;
        color: #0f172a; 
        margin-bottom: 8px;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 8px;
      }
      .__fc-dot { 
        display: inline-block; 
        width: 8px; 
        height: 8px; 
        border-radius: 50%; 
        margin-right: 8px; 
        vertical-align: middle; 
      }
      .__fc-dot--green { background: #10b981; }
      .__fc-dot--yellow { background: #f59e0b; }
      .__fc-dot--red { background: #ef4444; }
    `;
    document.head.appendChild(style);
  }

  function clearOverlays() {
    document.querySelectorAll(`.${OVERLAY_CLASS}, .__fc-summary`).forEach(el => el.remove());
  }

  function createOverlay(fieldEl, confidence, crmKey) {
    const rect = fieldEl.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const level = confidence || "none";

    const overlay = document.createElement("div");
    overlay.className = `${OVERLAY_CLASS} __fc-overlay--${level}`;
    overlay.style.left = (rect.left + scrollX - 3) + "px";
    overlay.style.top = (rect.top + scrollY - 3) + "px";
    overlay.style.width = (rect.width + 6) + "px";
    overlay.style.height = (rect.height + 6) + "px";
    overlay.style.position = "absolute";

    const badge = document.createElement("div");
    badge.className = `${BADGE_CLASS} __fc-badge--${level}`;
    badge.textContent = crmKey ? `→ ${crmKey}` : "no match";
    overlay.appendChild(badge);

    document.body.appendChild(overlay);
    return overlay;
  }

  function showSummary(counts) {
    const summary = document.createElement("div");
    summary.className = "__fc-summary";
    summary.innerHTML = `
      <strong>Form Copilot — Scan Results</strong><br>
      <span class="__fc-dot __fc-dot--green"></span>${counts.high} high confidence<br>
      <span class="__fc-dot __fc-dot--yellow"></span>${counts.medium} medium confidence<br>
      <span class="__fc-dot __fc-dot--red"></span>${counts.none} unmatched
    `;
    document.body.appendChild(summary);
  }

  // ─── AUTOFILL ─────────────────────────────────────────────────

  function setNativeValue(el, value) {
    if (!el) return;

    if (el.tagName === "SELECT") {
      // Try to find matching option by value or text
      let matched = false;
      const options = Array.from(el.options);
      
      // 1. Try exact value match
      for (const opt of options) {
        if (opt.value === value) {
          el.value = opt.value;
          matched = true;
          break;
        }
      }

      // 2. Try exact text match
      if (!matched) {
        for (const opt of options) {
          if (opt.textContent.trim() === value) {
            el.value = opt.value;
            matched = true;
            break;
          }
        }
      }

      // 3. Try partial text match (case insensitive)
      if (!matched) {
        const lowerVal = value.toLowerCase();
        for (const opt of options) {
          if (opt.textContent.toLowerCase().includes(lowerVal)) {
            el.value = opt.value;
            matched = true;
            break;
          }
        }
      }
    } else {
      // Standard input handling with React compatibility
      const proto = Object.getPrototypeOf(el);
      const descriptor =
        Object.getOwnPropertyDescriptor(proto, "value") ||
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") ||
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");

      if (descriptor && descriptor.set) {
        descriptor.set.call(el, value);
      } else {
        el.value = value;
      }
    }

    // Dispatch events to trigger React/Vue listeners
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // ─── LEARNING SYSTEM ─────────────────────────────────────────

  const domain = window.location.hostname;

  async function loadLearnedMappings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["learned_mappings"], (result) => {
        const all = result.learned_mappings || {};
        resolve(all[domain] || {});
      });
    });
  }

  async function saveLearnedMapping(fieldId, crmKey) {
    return new Promise((resolve) => {
      chrome.storage.local.get(["learned_mappings"], (result) => {
        const all = result.learned_mappings || {};
        if (!all[domain]) all[domain] = {};
        all[domain][fieldId] = crmKey;
        chrome.storage.local.set({ learned_mappings: all }, resolve);
      });
    });
  }

  function fieldIdentifier(field) {
    return [field.name, field.id, field.placeholder, field.label].filter(Boolean).join("|") || null;
  }

  // ─── CORRECTION WATCHER ───────────────────────────────────────

  function watchForCorrections(filledFields, crmData) {
    const crmReverse = {};
    for (const [key, val] of Object.entries(crmData)) {
      if (typeof val === "string") crmReverse[val.toLowerCase()] = key;
    }

    filledFields.forEach(({ field, crmKey }) => {
      const el = field.element;
      const fid = fieldIdentifier(field);
      if (!fid) return;

      const handler = () => {
        const newVal = el.value.trim().toLowerCase();
        if (crmReverse[newVal] && crmReverse[newVal] !== crmKey) {
          const correctedKey = crmReverse[newVal];
          console.log(`[Form Copilot] Learning: "${fid}" → ${correctedKey} (was ${crmKey})`);
          saveLearnedMapping(fid, correctedKey);
        }
        el.removeEventListener("change", handler);
      };
      el.addEventListener("change", handler);
    });
  }

  // ─── SCAN (overlay only) ──────────────────────────────────────

  async function runScan(crmData) {
    clearOverlays();
    injectOverlayStyles();

    const fields = detectFields();
    const learned = await loadLearnedMappings();
    const counts = { high: 0, medium: 0, none: 0 };
    const results = [];

    console.group("[Form Copilot] Scanning DOM for Fields...");
    fields.forEach((field) => {
      const match = matchFieldWithConfidence(field, learned);
      const hasData = match.crmKey && crmData[match.crmKey] !== undefined;
      const level = hasData ? (match.confidence || "none") : "none";

      if (level === "high") counts.high++;
      else if (level === "medium") counts.medium++;
      else counts.none++;

      createOverlay(field.element, level, hasData ? match.crmKey : null);
      results.push({ name: field.name || field.id || field.label, crmKey: match.crmKey, confidence: level });

      console.log(
        `%cField Detected:%c "${field.name || field.id || field.label}"\n` +
        `  - Mapping: ${match.crmKey || "none"} [${level}]\n` +
        `  - Source: ${match.source}\n` +
        `  - Score: ${match.score || "N/A"}`,
        "color: #22c55e; font-weight: bold", "color: inherit"
      );
    });
    console.groupEnd();

    showSummary(counts);
    console.log(`[Form Copilot] Scan complete: ${fields.length} fields (${counts.high} high, ${counts.medium} medium, ${counts.none} unmatched)`);

    return { total: fields.length, ...counts, results };
  }

  // ─── MAIN AUTOFILL FLOW ───────────────────────────────────────

  async function runAutofill(crmData) {
    clearOverlays();

    const fields = detectFields();
    console.group(`[Form Copilot] Starting Autofill for ${fields.length} fields`);
    console.log("CRM DATA:", crmData);

    const learned = await loadLearnedMappings();
    const filledFields = [];
    let filled = 0;

    fields.forEach((field) => {
      const match = matchFieldWithConfidence(field, learned);
      const crmKey = match.crmKey;
      const source = match.source || "none";

      if (crmKey && crmData[crmKey] !== undefined) {
        setNativeValue(field.element, crmData[crmKey]);
        filled++;
        filledFields.push({ field, crmKey });
        console.log(`%c✓ Filled%c "${field.name || field.id || field.label}" → %c${crmKey}%c = "${crmData[crmKey]}" (%s)`, 
          "color: #16a34a; font-weight: bold", "color: inherit", 
          "color: #2563eb; font-weight: bold", "color: inherit",
          source);
      } else if (crmKey) {
        console.warn(`%c✗ Matched%c "${field.name || field.id}" → %c${crmKey}%c but no CRM data found`, 
          "color: #dc2626; font-weight: bold", "color: inherit",
          "color: #2563eb; font-weight: bold", "color: inherit");
      } else {
        console.log(`%c- Skipped%c "${field.name || field.id || field.label}" (no match)`, 
          "color: #94a3b8", "color: inherit");
      }
    });

    watchForCorrections(filledFields, crmData);
    console.groupEnd();

    console.log(`[Form Copilot] Autofill complete: ${filled}/${fields.length} fields filled`);
    return { total: fields.length, filled };
  }

  // ─── MUTATION OBSERVER ────────────────────────────────────────

  let mutationTimeout = null;
  const observer = new MutationObserver((mutations) => {
    // Only re-scan if elements were added/removed
    const hasRelevantChanges = mutations.some(m => 
      m.addedNodes.length > 0 || m.removedNodes.length > 0
    );

    if (hasRelevantChanges) {
      if (mutationTimeout) clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => {
        // If overlays are present, it means we are in "scan mode"
        // and should refresh them for the new DOM state.
        if (document.querySelector(`.${OVERLAY_CLASS}`)) {
          chrome.storage.local.get(["crm_data"], (result) => {
            if (result.crm_data) runScan(result.crm_data);
          });
        }
      }, 500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ─── MESSAGE LISTENER ────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "scan") {
      runScan(message.crmData).then((result) => sendResponse(result));
      return true;
    }
    if (message.action === "autofill") {
      runAutofill(message.crmData).then((result) => sendResponse(result));
      return true;
    }
    if (message.action === "clear_overlays") {
      clearOverlays();
      sendResponse({ ok: true });
      return false;
    }
  });
})();
