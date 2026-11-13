"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

// The exact text of the demo popover, so the component and the tests
// can never drift apart.
export const DEMO_POPOVER_TITLE = "For demo purposes only";
export const DEMO_POPOVER_DETAIL = "Nothing changes in demo mode.";

// "For demo purposes only" popover for Test Admin Mode (demo mode).
//
// Wraps a control — usually one that is disabled in demo mode — and
// shows a small floating note on hover and on keyboard focus. The
// note says why the control does nothing: the visitor is browsing
// sample data, and nothing here changes anything.
//
// Why a wrapper at all: a disabled element fires no pointer events
// and cannot take focus, so it can never show a tooltip by itself.
// The wrapper is what receives hover and focus, and it carries the
// description (aria-describedby) so a screen reader announces it
// when the wrapper is focused. When the child is itself focusable
// (the Test Admin Mode menu entry, which is a working link), pass
// focusable={false} and the child takes the tab stop instead — the
// description is cloned onto it.
//
// Why position: fixed: the owner tables sit in overflow-x: auto
// wrappers, and an absolutely-positioned popover would be clipped
// by them. Fixed positioning is relative to the viewport, never to
// the anchor, so the coordinates are measured from the wrapped
// control when the popover opens, and again on scroll/resize so it
// stays glued to the control. No ancestor of the owner pages or the
// menu has a transform/filter, so fixed positioning is not
// re-anchored anywhere (see globals.css for the styles).
// React 18: useState/useEffect/useRef/useCallback/useId only.
export default function DemoPopover({
  children,
  enabled = true,
  focusable = true,
  block = false,
  detail = DEMO_POPOVER_DETAIL,
}: {
  children: ReactNode;
  // False renders the children unwrapped, with no popover at all.
  // Owner pages pass demo here, so the popover only ever exists in
  // demo mode — a signed-in admin never sees it.
  enabled?: boolean;
  // True (the default) makes the wrapper itself a tab stop. Use it
  // when the wrapped control is disabled and cannot take focus
  // itself. False when the child is already focusable.
  focusable?: boolean;
  // True renders a block <div> wrapper instead of an inline <span>
  // — for the settings form and the invite note, which are block
  // content (a <form> or <p> inside a <span> would be invalid HTML).
  block?: boolean;
  // The line under the heading.
  detail?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverId = useId();
  const wrapRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);

  // Measure the anchor and the (already laid-out, still hidden)
  // popover, then place the popover above the anchor, centred on it
  // and clamped inside the viewport. If there is no room above
  // (first table row, top of the menu), it goes below instead.
  const position = useCallback(() => {
    const anchor = wrapRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const rect = anchor.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const gap = 8;
    const vw = window.innerWidth;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      Math.max(8, vw - width - 8)
    );
    const top =
      rect.top >= height + gap + 8
        ? rect.top - height - gap
        : rect.bottom + gap;
    setPos({ top, left });
  }, []);

  function show() {
    position();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setPos(null);
  }

  // Keep the popover glued to its control while it is open. A scroll
  // re-positions rather than hiding: focusing a control can scroll
  // it into view, and hiding on that scroll would close the popover
  // the moment a keyboard user opened it.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open, position]);

  // Hooks must run before this early return.
  if (!enabled) return <>{children}</>;

  // The wrapped control is the thing a keyboard user tabs to when it
  // can take focus (the menu entry link); give it the description so
  // a screen reader announces why it is there. A disabled control
  // cannot take focus, so the wrapper takes the tab stop instead and
  // carries the description.
  const describedChild = isValidElement(children)
    ? cloneElement(children as ReactElement, {
        "aria-describedby": popoverId,
      })
    : children;

  const wrapProps = {
    ref: (el: HTMLElement | null) => {
      wrapRef.current = el;
    },
    className: `demo-popover-wrap${block ? " demo-popover-wrap-block" : ""}`,
    tabIndex: focusable ? 0 : undefined,
    "aria-describedby": focusable ? popoverId : undefined,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    },
  };

  const popover = (
    <span
      ref={tipRef}
      id={popoverId}
      role="tooltip"
      className={`demo-popover${open && pos ? " demo-popover-visible" : ""}`}
      style={pos ? { top: pos.top, left: pos.left } : undefined}
    >
      <strong>{DEMO_POPOVER_TITLE}</strong>
      <span>{detail}</span>
    </span>
  );

  return block ? (
    <div {...wrapProps}>
      {describedChild}
      {popover}
    </div>
  ) : (
    <span {...wrapProps}>
      {describedChild}
      {popover}
    </span>
  );
}
