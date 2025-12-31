import { useEffect, useRef } from "react";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";

/**
 * In-app widget embed tester.
 * Minimal: single container + single iframe + overlay button.
 * No nudge/notification popup.
 */
export function WidgetTestEmbed() {
  const { config } = useWidgetConfig();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const allowedOriginRef = useRef<string>(window.location.origin);

  // Send config updates to iframe whenever config changes
  useEffect(() => {
    if (!iframeRef.current) return;
    try {
      iframeRef.current.contentWindow?.postMessage(
        { type: "scholaris:config", config },
        allowedOriginRef.current
      );
    } catch {
      // ignore
    }
  }, [config]);

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
    container.style.transition = "none";
    container.style.background = "transparent";
    container.style.border = "none";
    container.style.boxShadow = "none";
    container.style.overflow = "hidden";
    container.style.borderRadius = "50%";

    const iframe = document.createElement("iframe");
    iframe.src = `${host}/widget`;
    iframe.allow = "clipboard-write";
    iframe.title = "Scholaris chat widget";
    iframeRef.current = iframe;

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    iframe.style.overflow = "hidden";
    iframe.style.borderRadius = "999px";
    iframe.style.background = "#0b1020"; // Dark fallback
    iframe.style.pointerEvents = "none";
    iframe.style.boxShadow = "0 25px 50px -12px rgba(0,0,0,0.35)";
    iframe.style.transition = "none";

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
        const w = calcExpandedW();
        const h = calcExpandedH();

        // Fullscreen on small devices
        const isSmall = window.innerWidth < 520;
        if (isSmall) {
          container.style.left = "0";
          container.style.right = "0";
          container.style.bottom = "0";
          container.style.top = "0";
          container.style.width = "100vw";
          container.style.height = "100dvh";
          container.style.borderRadius = "0";
          iframe.style.borderRadius = "0px";
        } else {
          container.style.left = "auto";
          container.style.top = "auto";
          container.style.right = "calc(16px + env(safe-area-inset-right))";
          container.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
          container.style.width = `${w}px`;
          container.style.height = `${h}px`;
          container.style.borderRadius = "16px";
          iframe.style.borderRadius = "16px";
        }

        iframe.style.boxShadow = "0 25px 60px -18px rgba(0,0,0,0.5)";
        iframe.style.pointerEvents = "auto";
        overlay.style.display = "none";
        postToWidget("expand");
      } else {
        container.style.left = "auto";
        container.style.top = "auto";
        container.style.right = "calc(16px + env(safe-area-inset-right))";
        container.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
        container.style.width = `${bubbleSize}px`;
        container.style.height = `${bubbleSize}px`;
        container.style.borderRadius = "50%";
        iframe.style.borderRadius = "999px";
        iframe.style.boxShadow = "0 25px 50px -12px rgba(0,0,0,0.35)";
        iframe.style.pointerEvents = "none";
        overlay.style.display = "block";
        postToWidget("minimize");
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
      // Send config to iframe
      try {
        iframe.contentWindow?.postMessage(
          { type: "scholaris:config", config },
          allowedOrigin
        );
      } catch {
        // ignore
      }
    };
    iframe.addEventListener("load", onIframeLoad);

    applyExpandedStyles(false);

    return () => {
      iframe.removeEventListener("load", onIframeLoad);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("message", onMessage);
      overlay.removeEventListener("click", onOverlayClick);
      container.remove();
    };
  }, [config]);

  return null;
}
