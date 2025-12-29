import { useEffect } from "react";

/**
 * In-app widget embed tester.
 * Mimics the real embed snippet behavior (iframe + overlay button + postMessage).
 * Background page stays fully interactive when chat is open.
 */
export function WidgetTestEmbed() {
  useEffect(() => {
    const host = window.location.origin.replace(/\/+$/, "");
    const allowedOrigin = window.location.origin;

    const bubbleSize = window.matchMedia("(min-width: 640px)").matches ? 64 : 56;
    const requestedW = 384;
    const requestedH = 600;

    function calcExpandedW() {
      const maxW = Math.max(280, Math.floor(window.innerWidth * 0.92));
      return Math.min(requestedW, maxW);
    }

    function calcExpandedH() {
      const maxH = Math.max(360, Math.floor(window.innerHeight * 0.86));
      return Math.min(requestedH, maxH);
    }

    const container = document.createElement("div");
    container.setAttribute("data-scholaris-widget-test", "true");
    container.style.position = "fixed";
    container.style.right = "calc(16px + env(safe-area-inset-right))";
    container.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
    container.style.width = `${bubbleSize}px`;
    container.style.height = `${bubbleSize}px`;
    container.style.zIndex = "2147483647";
    container.style.transition =
      "width 240ms ease, height 240ms ease, left 240ms ease, right 240ms ease, bottom 240ms ease";

    const iframe = document.createElement("iframe");
    iframe.src = `${host}/widget`;
    iframe.allow = "clipboard-write";
    iframe.title = "Scholaris chat widget";

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    iframe.style.overflow = "hidden";
    iframe.style.borderRadius = "999px";
    iframe.style.background = "transparent";
    iframe.style.pointerEvents = "none";
    iframe.style.boxShadow = "0 25px 50px -12px rgba(0,0,0,0.35)";
    iframe.style.transition = "border-radius 220ms ease, box-shadow 220ms ease";

    // While minimized, we capture taps with an overlay for maximum reliability.
    const overlay = document.createElement("button");
    overlay.type = "button";
    overlay.setAttribute("aria-label", "Open Scholaris chat");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.border = "none";
    overlay.style.padding = "0";
    overlay.style.margin = "0";
    overlay.style.background = "transparent";
    overlay.style.cursor = "pointer";
    overlay.style.borderRadius = "999px";
    overlay.style.pointerEvents = "auto";
    overlay.style.touchAction = "manipulation";

    container.appendChild(iframe);
    container.appendChild(overlay);
    document.body.appendChild(container);

    // Notification bubble rendered OUTSIDE the iframe (host DOM)
    const nudge = document.createElement("div");
    nudge.setAttribute("data-scholaris-nudge", "true");
    nudge.style.position = "fixed";
    nudge.style.right = "calc(16px + env(safe-area-inset-right))";
    nudge.style.bottom = `calc(${bubbleSize + 28}px + env(safe-area-inset-bottom))`;
    nudge.style.maxWidth = "200px";
    nudge.style.padding = "12px 14px";
    nudge.style.borderRadius = "18px";
    nudge.style.background = "rgba(255,255,255,0.98)";
    nudge.style.boxShadow = "0 12px 35px rgba(0,0,0,0.2)";
    nudge.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    nudge.style.display = "none";
    nudge.style.zIndex = "2147483647";
    nudge.style.backdropFilter = "blur(12px)";
    nudge.style.cursor = "pointer";
    nudge.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    nudge.style.opacity = "0";
    nudge.style.transform = "translateY(10px)";

    const nudgeText = document.createElement("div");
    nudgeText.style.fontSize = "14px";
    nudgeText.style.fontWeight = "600";
    nudgeText.style.color = "#111827";
    nudgeText.textContent = "Hey! 👋 Try me, I can help you";

    const nudgeClose = document.createElement("button");
    nudgeClose.type = "button";
    nudgeClose.textContent = "×";
    nudgeClose.setAttribute("aria-label", "Dismiss message");
    nudgeClose.style.position = "absolute";
    nudgeClose.style.top = "-8px";
    nudgeClose.style.right = "-8px";
    nudgeClose.style.width = "24px";
    nudgeClose.style.height = "24px";
    nudgeClose.style.borderRadius = "999px";
    nudgeClose.style.border = "none";
    nudgeClose.style.background = "#e5e7eb";
    nudgeClose.style.cursor = "pointer";
    nudgeClose.style.fontWeight = "700";
    nudgeClose.style.fontSize = "16px";
    nudgeClose.style.color = "#4b5563";
    nudgeClose.style.display = "flex";
    nudgeClose.style.alignItems = "center";
    nudgeClose.style.justifyContent = "center";

    nudge.appendChild(nudgeText);
    nudge.appendChild(nudgeClose);
    document.body.appendChild(nudge);

    // Timer for notification nudge
    let nudgeTimer: number | undefined;
    const NUDGE_KEY = "scholaris_nudge_dismissed_session";

    function hideNudge() {
      nudge.style.opacity = "0";
      nudge.style.transform = "translateY(10px)";
      setTimeout(() => { nudge.style.display = "none"; }, 300);
      if (nudgeTimer !== undefined) window.clearTimeout(nudgeTimer);
      nudgeTimer = undefined;
    }

    function showNudge() {
      if (sessionStorage.getItem(NUDGE_KEY) === "1") return;
      nudge.style.display = "block";
      requestAnimationFrame(() => {
        nudge.style.opacity = "1";
        nudge.style.transform = "translateY(0)";
      });
    }

    function scheduleNudge() {
      if (sessionStorage.getItem(NUDGE_KEY) === "1") return;
      if (nudgeTimer !== undefined) return;
      nudgeTimer = window.setTimeout(() => {
        if (!isExpanded) showNudge();
      }, 5000); // 5 seconds for testing, change to 20000 for production
    }

    nudge.addEventListener("click", () => {
      hideNudge();
      sessionStorage.setItem(NUDGE_KEY, "1");
      applyExpandedStyles(true);
    });

    nudgeClose.addEventListener("click", (e) => {
      e.stopPropagation();
      hideNudge();
      sessionStorage.setItem(NUDGE_KEY, "1");
    });

    let isExpanded = false;

    function postToWidget(action: "expand" | "minimize") {
      try {
        iframe.contentWindow?.postMessage(
          { type: "scholaris:host", action },
          allowedOrigin
        );
      } catch {
        // ignore
      }
    }

    function applyExpandedStyles(expand: boolean) {
      isExpanded = expand;

      if (isExpanded) {
        hideNudge();
        const w = calcExpandedW();
        const h = calcExpandedH();

        // Fullscreen on small devices
        const isSmall = window.innerWidth < 520;
        if (isSmall) {
          container.style.left = "0";
          container.style.right = "0";
          container.style.bottom = "0";
          container.style.width = "100vw";
          container.style.height = "100dvh";
          iframe.style.borderRadius = "0px";
        } else {
          container.style.left = "auto";
          container.style.right = "calc(16px + env(safe-area-inset-right))";
          container.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
          container.style.width = `${w}px`;
          container.style.height = `${h}px`;
          iframe.style.borderRadius = "16px";
        }

        iframe.style.boxShadow = "0 25px 60px -18px rgba(0,0,0,0.5)";
        iframe.style.pointerEvents = "auto";
        overlay.style.display = "none";
        postToWidget("expand");
      } else {
        container.style.left = "auto";
        container.style.right = "calc(16px + env(safe-area-inset-right))";
        container.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
        container.style.width = `${bubbleSize}px`;
        container.style.height = `${bubbleSize}px`;
        iframe.style.borderRadius = "999px";
        iframe.style.boxShadow = "0 25px 50px -12px rgba(0,0,0,0.35)";
        iframe.style.pointerEvents = "none";
        overlay.style.display = "block";
        postToWidget("minimize");
        scheduleNudge();
      }
    }

    const onOverlayClick = () => applyExpandedStyles(true);
    overlay.addEventListener("click", onOverlayClick);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") applyExpandedStyles(false);
    };
    window.addEventListener("keydown", onKeyDown);

    const onResize = () => {
      if (!isExpanded) return;
      applyExpandedStyles(true);
    };
    window.addEventListener("resize", onResize);

    const onMessage = (e: MessageEvent) => {
      if (!e || !e.data || typeof e.data !== "object") return;
      const data = e.data as { type?: string; action?: string };
      if (data.type !== "scholaris:widget") return;
      if (e.origin && e.origin !== allowedOrigin) return;
      if (data.action === "expanded") applyExpandedStyles(true);
      if (data.action === "minimized") applyExpandedStyles(false);
    };
    window.addEventListener("message", onMessage);

    const onIframeLoad = () => {
      postToWidget(isExpanded ? "expand" : "minimize");
    };
    iframe.addEventListener("load", onIframeLoad);

    applyExpandedStyles(false);
    scheduleNudge();

    return () => {
      iframe.removeEventListener("load", onIframeLoad);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("message", onMessage);
      overlay.removeEventListener("click", onOverlayClick);
      if (nudgeTimer !== undefined) window.clearTimeout(nudgeTimer);
      nudge.remove();
      container.remove();
    };
  }, []);

  return null;
}
