// PropScholar Fix — Content Script for Discord v3.0
(function () {
  "use strict";

  if (window.__PROP_SCHOLAR_FIX_LOADED__) return;
  window.__PROP_SCHOLAR_FIX_LOADED__ = true;

  const EDITOR_SELECTOR = [
    'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
    'div[role="textbox"][contenteditable="true"]',
    '[data-slate-editor="true"][role="textbox"]',
  ].join(", ");
  const TOOLBAR_LABEL_MATCHERS = ["emoji", "gif", "sticker", "gift", "apps"];
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  const PINNED_STORAGE_KEY = "ps-fix-pinned";

  let editorIdCounter = 0;
  let debounceTimer;
  let floatingLayoutTimer;

  // ── Cache helpers ──
  function hashText(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return "ps-cache-" + h;
  }

  function getCached(text) {
    try {
      const key = hashText(text);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.ts > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return { ...entry, cached: true };
    } catch { return null; }
  }

  function setCache(text, data) {
    try {
      const key = hashText(text);
      localStorage.setItem(key, JSON.stringify({ ...data, ts: Date.now() }));
    } catch {}
  }

  // ── Pinned responses ──
  function getPinned() {
    try {
      return JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) || "[]");
    } catch { return []; }
  }

  function savePinned(list) {
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
    } catch {}
  }

  function togglePin(text) {
    const pinned = getPinned();
    const idx = pinned.indexOf(text);
    if (idx >= 0) {
      pinned.splice(idx, 1);
    } else {
      pinned.unshift(text);
    }
    savePinned(pinned);
    return idx < 0; // true if newly pinned
  }

  function isPinned(text) {
    return getPinned().includes(text);
  }

  // ── Context capture ──
  function captureContext() {
    try {
      const msgs = document.querySelectorAll('[class*="messageContent"]');
      const recent = Array.from(msgs).slice(-3).map(el => (el.textContent || "").trim()).filter(Boolean);
      return recent.length > 0 ? recent : undefined;
    } catch { return undefined; }
  }

  // ── Utility ──
  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function getEditorId(editor) {
    if (!editor.dataset.psFixEditorId) {
      editorIdCounter += 1;
      editor.dataset.psFixEditorId = `ps-editor-${editorIdCounter}`;
    }
    return editor.dataset.psFixEditorId;
  }

  function getEditorText(editor) {
    const slateStrings = editor.querySelectorAll('[data-slate-string="true"]');
    if (slateStrings.length > 0) {
      return Array.from(slateStrings)
        .map((node) => node.textContent || "")
        .join("\n")
        .replace(/\u200b/g, "")
        .trim();
    }
    return (editor.innerText || editor.textContent || "")
      .replace(/\u200b/g, "")
      .trim();
  }

  async function requestReplyOptions(text, context) {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "ps-fix-generate", text, context }, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || "Extension message failed"));
            return;
          }
          if (!response) {
            reject(new Error("No response from extension background"));
            return;
          }
          if (!response.ok) {
            reject(new Error(response.error || "Reply generation failed"));
            return;
          }
          resolve(response.data);
        });
      });
    }

    const API_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/functions/v1/discord-fix";
    const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E";

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ text, context }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Error ${response.status}`);
    }

    return await response.json();
  }

  function removeExistingPopup() {
    const existing = document.querySelector(".ps-fix-popup");
    if (existing) existing.remove();
  }

  function closeFloatingUI() {
    removeExistingPopup();
  }

  async function copyText(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_error) {}

    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      textarea.style.top = "0";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch (_error) {
      return false;
    }
  }

  function positionPopup(popup) {
    const anchorEditorId = popup.dataset.anchorEditorId;
    const anchorButton = document.querySelector(`.ps-fix-btn[data-editor-id="${anchorEditorId}"]`);
    if (!anchorButton) return;

    const btnRect = anchorButton.getBoundingClientRect();
    const popupWidth = 380;
    popup.style.position = "fixed";
    popup.style.left = `${Math.min(window.innerWidth - popupWidth - 8, Math.max(8, btnRect.left - 180))}px`;
    popup.style.bottom = `${window.innerHeight - btnRect.top + 8}px`;
    popup.style.zIndex = "999999";
  }

  function scheduleFloatingLayout() {
    window.clearTimeout(floatingLayoutTimer);
    floatingLayoutTimer = window.setTimeout(() => {
      const popup = document.querySelector(".ps-fix-popup");
      if (popup) positionPopup(popup);
    }, 20);
  }

  function flashFixButton(button, tone) {
    if (!button) return;
    if (tone === "success") {
      button.classList.add("ps-success");
      window.setTimeout(() => button.classList.remove("ps-success"), 1200);
    } else if (tone === "error") {
      button.classList.add("ps-error");
      window.setTimeout(() => button.classList.remove("ps-error"), 1600);
    }
  }

  function showCopiedToast(popup, optionEl) {
    optionEl.classList.add("ps-fix-option-copied");
    window.setTimeout(() => {
      removeExistingPopup();
    }, 300);
  }

  // Log which tone was selected
  function logToneSelected(label) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: "ps-fix-log-tone", tone: label });
      }
    } catch {}
  }

  const TONE_COLORS = ["#5865f2", "#3ba55d", "#faa61a", "#eb459e", "#ed4245"];

  function createPopup(options, labels, editor, anchorButton, isCached) {
    removeExistingPopup();

    const popup = document.createElement("div");
    popup.className = "ps-fix-popup";
    popup.dataset.anchorEditorId = getEditorId(editor);

    const header = document.createElement("div");
    header.className = "ps-fix-popup-header";
    const cachedBadge = isCached ? '<span class="ps-cached-badge">cached</span>' : '';
    header.innerHTML = `<span class="ps-fix-popup-icon">&#9670;</span><div><div class="ps-fix-popup-title">Pick a reply ${cachedBadge}</div><div class="ps-fix-popup-subtitle">Click to copy</div></div>`;
    popup.appendChild(header);

    options.forEach((rawText, idx) => {
      const text = typeof rawText === "object" && rawText !== null ? (rawText.message || rawText.text || rawText.variation || JSON.stringify(rawText)) : String(rawText);
      const row = document.createElement("div");
      row.className = "ps-fix-option";

      const textWrap = document.createElement("div");
      textWrap.className = "ps-fix-option-main";

      const labelSpan = document.createElement("span");
      labelSpan.className = "ps-fix-option-label";
      labelSpan.textContent = labels[idx] || "";
      labelSpan.style.color = TONE_COLORS[idx % TONE_COLORS.length];

      const textSpan = document.createElement("span");
      textSpan.className = "ps-fix-option-text";
      textSpan.textContent = text;
      textSpan.title = text;

      textWrap.appendChild(labelSpan);
      textWrap.appendChild(textSpan);
      row.appendChild(textWrap);

      // Pin button
      const pinBtn = document.createElement("button");
      pinBtn.className = "ps-pin-btn" + (isPinned(text) ? " ps-pinned" : "");
      pinBtn.innerHTML = "&#9733;";
      pinBtn.title = isPinned(text) ? "Unpin" : "Pin for reuse";
      pinBtn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
      pinBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nowPinned = togglePin(text);
        pinBtn.classList.toggle("ps-pinned", nowPinned);
        pinBtn.title = nowPinned ? "Unpin" : "Pin for reuse";
      });
      row.appendChild(pinBtn);

      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      row.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const copied = await copyText(text);
        if (copied) {
          logToneSelected(labels[idx] || "unknown");
          showCopiedToast(popup, row);
          flashFixButton(anchorButton, "success");
        } else {
          flashFixButton(anchorButton, "error");
        }
      });

      popup.appendChild(row);
    });

    // Show pinned section if any
    const pinned = getPinned();
    if (pinned.length > 0) {
      const divider = document.createElement("div");
      divider.className = "ps-fix-divider";
      divider.innerHTML = '<span>Pinned</span>';
      popup.appendChild(divider);

      pinned.slice(0, 5).forEach((text) => {
        const row = document.createElement("div");
        row.className = "ps-fix-option ps-fix-pinned-item";

        const textWrap = document.createElement("div");
        textWrap.className = "ps-fix-option-main";

        const textSpan = document.createElement("span");
        textSpan.className = "ps-fix-option-text";
        textSpan.textContent = text;
        textSpan.title = text;
        textWrap.appendChild(textSpan);
        row.appendChild(textWrap);

        const unpinBtn = document.createElement("button");
        unpinBtn.className = "ps-pin-btn ps-pinned";
        unpinBtn.innerHTML = "&#9733;";
        unpinBtn.title = "Unpin";
        unpinBtn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
        unpinBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          togglePin(text);
          row.remove();
        });
        row.appendChild(unpinBtn);

        row.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
        row.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const copied = await copyText(text);
          if (copied) {
            showCopiedToast(popup, row);
            flashFixButton(anchorButton, "success");
          }
        });

        popup.appendChild(row);
      });
    }

    popup.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    document.body.appendChild(popup);
    positionPopup(popup);

    const closeHandler = (event) => {
      if (!popup.contains(event.target) && event.target !== anchorButton) {
        removeExistingPopup();
        document.removeEventListener("mousedown", closeHandler, true);
      }
    };

    window.setTimeout(() => document.addEventListener("mousedown", closeHandler, true), 50);
    return popup;
  }

  function injectStyles() {
    if (document.getElementById("ps-fix-styles")) return;

    const style = document.createElement("style");
    style.id = "ps-fix-styles";
    style.textContent = `
      .ps-fix-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        z-index: 3;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        position: relative;
        color: #b5bac1;
        transition: color 0.15s, transform 0.1s;
      }
      .ps-fix-btn:hover {
        color: #fff;
        transform: scale(1.1);
      }
      .ps-fix-icon {
        font-size: 20px;
        line-height: 1;
      }
      .ps-fix-tooltip {
        display: none;
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: #111214;
        color: #dbdee1;
        font-size: 12px;
        padding: 6px 10px;
        border-radius: 6px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      }
      .ps-fix-btn:hover .ps-fix-tooltip {
        display: block;
      }
      .ps-fix-btn.ps-loading .ps-fix-icon {
        animation: ps-spin 0.8s linear infinite;
      }
      .ps-fix-btn.ps-success .ps-fix-icon {
        color: #57f287;
      }
      .ps-fix-btn.ps-error .ps-fix-icon {
        color: #ed4245;
      }
      @keyframes ps-spin {
        to { transform: rotate(360deg); }
      }

      .ps-fix-popup {
        background: #1e1f22;
        border: 1px solid #2b2d31;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        width: 380px;
        max-height: 440px;
        overflow-y: auto;
        padding: 4px;
        border-radius: 10px;
      }

      .ps-fix-popup-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px 6px;
        color: #b5bac1;
      }
      .ps-fix-popup-icon {
        font-size: 14px;
        color: #5865f2;
      }
      .ps-fix-popup-title {
        color: #f2f3f5;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ps-fix-popup-subtitle {
        color: #949ba4;
        font-size: 11px;
        margin-top: 1px;
      }

      .ps-cached-badge {
        font-size: 9px;
        background: #2b2d31;
        color: #949ba4;
        padding: 1px 6px;
        border-radius: 4px;
        text-transform: lowercase;
        font-weight: 500;
        letter-spacing: 0;
      }

      .ps-fix-option {
        display: flex;
        align-items: flex-start;
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.12s;
        color: #dbdee1;
        font-size: 13px;
        line-height: 1.5;
        user-select: none;
        gap: 6px;
      }
      .ps-fix-option:hover {
        background: #2b2d31;
      }
      .ps-fix-option:active {
        background: #383a40;
      }
      .ps-fix-option-copied {
        background: rgba(87, 242, 135, 0.15) !important;
        transition: background 0.1s;
      }

      .ps-fix-option-main {
        flex: 1;
        min-width: 0;
      }
      .ps-fix-option-label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin-bottom: 3px;
      }
      .ps-fix-option-text {
        display: block;
        word-break: break-word;
        white-space: pre-wrap;
      }

      .ps-pin-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #4e5058;
        font-size: 14px;
        padding: 2px 4px;
        border-radius: 4px;
        flex-shrink: 0;
        margin-top: 2px;
        transition: color 0.15s;
      }
      .ps-pin-btn:hover {
        color: #faa61a;
      }
      .ps-pin-btn.ps-pinned {
        color: #faa61a;
      }

      .ps-fix-divider {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 4px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #949ba4;
      }
      .ps-fix-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #2b2d31;
      }

      .ps-fix-pinned-item {
        opacity: 0.85;
      }

      .ps-fix-error-msg {
        padding: 10px 12px;
        color: #ed4245;
        font-size: 12px;
      }
    `;

    document.head.appendChild(style);
  }

  function createFixButton(editor) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ps-fix-btn";
    button.dataset.editorId = getEditorId(editor);
    button.setAttribute("aria-label", "PropScholar Fix");
    button.innerHTML = '<span class="ps-fix-icon">&#10022;</span><span class="ps-fix-tooltip">PropScholar Fix (Ctrl+Shift+F)</span>';

    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await triggerFix(editor, button);
    });

    return button;
  }

  async function triggerFix(editor, button) {
    if (document.querySelector(".ps-fix-popup")) {
      closeFloatingUI();
      return;
    }

    const text = getEditorText(editor);
    if (!text) return;

    // Check cache first
    const cached = getCached(text);
    if (cached) {
      const labels = cached.labels || ["Short", "Detailed", "Empathetic"];
      createPopup(cached.options, labels, editor, button, true);
      return;
    }

    button.classList.add("ps-loading");

    try {
      const context = captureContext();
      const data = await requestReplyOptions(text, context);

      if (data.options && Array.isArray(data.options)) {
        const labels = data.labels || ["Short", "Detailed", "Empathetic"];
        setCache(text, { options: data.options, labels });
        createPopup(data.options, labels, editor, button, false);
      } else if (data.fixed) {
        const copied = await copyText(data.fixed);
        flashFixButton(button, copied ? "success" : "error");
      }
    } catch (error) {
      console.error("[PropScholar Fix]", error);
      flashFixButton(button, "error");
    } finally {
      button.classList.remove("ps-loading");
    }
  }

  function isDiscordMessageEditor(editor) {
    const ariaLabel = (editor.getAttribute("aria-label") || "").toLowerCase();
    const hasMessageLabel = ariaLabel.includes("message") || ariaLabel.includes("reply");
    const composerRoot = editor.closest("form") || editor.closest('[class*="channelTextArea"]') || editor.closest('[class*="textArea"]');
    return Boolean(composerRoot) && (hasMessageLabel || editor.getAttribute("role") === "textbox");
  }

  function findToolbarAnchor(editor) {
    const scopes = [
      editor.closest("form"),
      editor.closest('[class*="channelTextArea"]'),
      editor.closest('[class*="textArea"]'),
      editor.parentElement,
      editor.parentElement?.parentElement,
      editor.parentElement?.parentElement?.parentElement,
    ].filter(Boolean);

    for (const scope of scopes) {
      const buttons = scope.querySelectorAll('button[aria-label], [role="button"][aria-label]');
      for (const btn of buttons) {
        const label = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (TOOLBAR_LABEL_MATCHERS.some((matcher) => label.includes(matcher)) && isVisible(btn)) return btn;
      }
    }
    return null;
  }

  function injectIntoToolbar(editor) {
    const editorId = getEditorId(editor);
    if (document.querySelector(`.ps-fix-btn[data-editor-id="${editorId}"]`)) return;

    const anchor = findToolbarAnchor(editor);
    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement("beforebegin", createFixButton(editor));
      return;
    }

    const fallback = editor.closest('[class*="scrollableContainer"]') || editor.parentElement;
    if (!fallback || fallback.querySelector(`.ps-fix-btn[data-editor-id="${editorId}"]`)) return;
    if (window.getComputedStyle(fallback).position === "static") fallback.style.position = "relative";

    const btn = createFixButton(editor);
    btn.style.position = "absolute";
    btn.style.right = "88px";
    btn.style.bottom = "10px";
    fallback.appendChild(btn);
  }

  function injectButtons() {
    Array.from(document.querySelectorAll(EDITOR_SELECTOR))
      .filter(isVisible)
      .filter(isDiscordMessageEditor)
      .forEach(injectIntoToolbar);

    scheduleFloatingLayout();
  }

  // ── Keyboard shortcut ──
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "F") {
      e.preventDefault();
      const editors = Array.from(document.querySelectorAll(EDITOR_SELECTOR)).filter(isVisible).filter(isDiscordMessageEditor);
      if (editors.length === 0) return;
      const editor = editors[editors.length - 1]; // focused/last editor
      const editorId = getEditorId(editor);
      const button = document.querySelector(`.ps-fix-btn[data-editor-id="${editorId}"]`);
      if (button) {
        triggerFix(editor, button);
      }
    }
  }, true);

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectButtons, 150);
  });

  function init() {
    injectStyles();
    console.log("[PropScholar Fix] v3.0 — production");
    injectButtons();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "class"] });
    document.addEventListener("focusin", injectButtons, true);
    window.addEventListener("resize", scheduleFloatingLayout, { passive: true });
    window.addEventListener("scroll", scheduleFloatingLayout, true);
    setInterval(injectButtons, 2000);
  }

  if (document.readyState === "complete") setTimeout(init, 1200);
  else window.addEventListener("load", () => setTimeout(init, 1200));
})();
