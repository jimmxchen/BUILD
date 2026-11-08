// "Export" button for the site-model app: a small menu with CAD (.dxf) and PDF plan-sheet
// downloads of the current layout. Plain DOM, like addSiteButton / addPhotorealButton, because the
// app around it is imperative (src/build/siteModelApp.js).
import type { Layout } from "../types";
import { layoutToDxf } from "./dxf";
import { jpegSize, layoutToPdf, type JpegImage } from "./pdf";
import { totalSqft } from "./geometry";

export function download(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const fileBase = (layout: Layout) => {
  const bed = layout.rooms.filter((r) => r.type === "bedroom" || r.type === "primary_bedroom").length;
  return `walkthru-${bed}bed-${Math.round(totalSqft(layout))}sqft`;
};

/** Any image URL -> JPEG bytes the PDF can embed (re-encoded through a canvas if needed). */
async function toJpeg(src: string): Promise<JpegImage | null> {
  try {
    if (src.startsWith("data:image/jpeg;base64,")) {
      const bytes = Uint8Array.from(atob(src.slice(23)), (c) => c.charCodeAt(0));
      const size = jpegSize(bytes);
      if (size) return { bytes, ...size };
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    const scale = Math.min(1, 1200 / img.naturalWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.88));
    if (!blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const size = jpegSize(bytes);
    return size ? { bytes, ...size } : null;
  } catch {
    return null; // tainted canvas or broken image: export the sheet without the photo
  }
}

export function exportDxf(layout: Layout) {
  download(layoutToDxf(layout), `${fileBase(layout)}.dxf`, "application/dxf");
}

export async function exportPdf(layout: Layout, photoUrl?: string | null) {
  const photo = photoUrl ? await toJpeg(photoUrl) : null;
  const bytes = layoutToPdf(layout, { title: "Floor plan", subtitle: "Generated with Walkthru", photo });
  download(bytes as BlobPart, `${fileBase(layout)}.pdf`, "application/pdf");
}

/**
 * Remembers the hero photoreal exterior shot (frame 0 of the On site view) for the layout that was
 * on screen when it appeared, by watching the DOM, so the PDF can include it without coupling to
 * site.js internals. Returns a getter that yields the photo only while that layout is current.
 */
function watchExteriorPhoto(getLayout: () => Layout | null) {
  let shot: { layout: Layout | null; url: string } | null = null;
  const grab = (img: HTMLImageElement) => { if (img.src) shot = { layout: getLayout(), url: img.src }; };
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) {
      if (!(n instanceof HTMLElement)) continue;
      if (n instanceof HTMLImageElement && n.closest('.site-ov .shot[data-i="0"]')) grab(n);
      else n.querySelectorAll?.<HTMLImageElement>('.site-ov .shot[data-i="0"] img').forEach(grab);
    }
  }).observe(document.body, { childList: true, subtree: true });
  return () => (shot && shot.layout === getLayout() ? shot.url : null);
}

const CSS = `
.xp-menu{position:fixed;z-index:60;min-width:230px;padding:6px;border-radius:12px;background:#fff;color:#1b1b1d;
  box-shadow:0 10px 30px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06);font:13.5px/1.3 inherit;font-family:inherit}
.xp-menu button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:8px 10px;border:0;
  border-radius:8px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.xp-menu button:hover:not(:disabled),.xp-menu button:focus-visible{background:#f1f0ec;outline:none}
.xp-menu button:disabled{opacity:.5;cursor:default}
.xp-menu small{color:#6b6b72;font-size:12px}
`;

/**
 * Adds an "Export" button at the end of the Walk through button's row, copying its classes and
 * mirroring its disabled state. Clicking opens a menu: CAD drawing (.dxf) or PDF plan sheet.
 * `busy()` true (a chat edit is still animating in) disables both items, so nobody exports a
 * half-applied layout.
 */
export function addExportButton(
  walkBtn: HTMLElement | null,
  getLayout: () => Layout | null,
  { label = "Export", busy = () => false }: { label?: string; busy?: () => boolean } = {},
) {
  if (!walkBtn || !walkBtn.parentElement) return null;
  if (!document.getElementById("xp-css")) {
    const st = document.createElement("style"); st.id = "xp-css"; st.textContent = CSS; document.head.append(st);
  }
  const photo = watchExteriorPhoto(getLayout);

  const b = document.createElement("button");
  b.type = "button";
  b.className = walkBtn.className;
  if (walkBtn.hasAttribute("role")) b.setAttribute("role", walkBtn.getAttribute("role")!);
  b.textContent = label;
  b.title = "Download the floor plan as a CAD drawing (DXF) or a printable PDF";
  b.setAttribute("aria-haspopup", "menu");
  b.setAttribute("aria-expanded", "false");
  if (!/flex|grid/.test(getComputedStyle(walkBtn.parentElement).display)) b.style.marginLeft = "8px";
  const sync = () => { (b as HTMLButtonElement).disabled = (walkBtn as HTMLButtonElement).disabled; };
  new MutationObserver(sync).observe(walkBtn, { attributes: true, attributeFilter: ["disabled"] });
  sync();

  let menu: HTMLDivElement | null = null;
  const close = () => {
    menu?.remove(); menu = null; b.setAttribute("aria-expanded", "false");
    removeEventListener("pointerdown", onAway, true); removeEventListener("keydown", onKey, true);
  };
  const onAway = (e: Event) => { if (menu && !menu.contains(e.target as Node) && e.target !== b) close(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); b.focus(); } };

  const item = (title: string, hint: string, run: (layout: Layout) => void | Promise<void>) => {
    const it = document.createElement("button");
    it.type = "button"; it.setAttribute("role", "menuitem");
    it.innerHTML = `<span></span><small></small>`;
    it.querySelector("span")!.textContent = title;
    it.querySelector("small")!.textContent = hint;
    it.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (busy()) return;
      const layout = getLayout();
      close();
      if (layout) await run(layout);
    });
    return it;
  };

  const open = () => {
    menu = document.createElement("div");
    menu.className = "xp-menu"; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Export floor plan");
    const hasPhoto = !!photo();
    menu.append(
      item("CAD drawing (.dxf)", "Walls, doors, windows and rooms on layers, in feet", exportDxf),
      item("PDF plan sheet", hasPhoto ? "To-scale plan, room sizes, exterior photo" : "To-scale plan, room sizes and total sq ft", (l) => exportPdf(l, photo())),
    );
    if (busy()) {
      for (const it of menu.querySelectorAll("button")) {
        it.disabled = true;
        it.querySelector("small")!.textContent = "Wait for the current edit to finish";
      }
    }
    document.body.append(menu);
    const r = b.getBoundingClientRect(), m = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - m.width, innerWidth - m.width - 8));
    const top = r.top - m.height - 8 >= 8 ? r.top - m.height - 8 : r.bottom + 8;
    menu.style.left = `${left}px`; menu.style.top = `${top}px`;
    b.setAttribute("aria-expanded", "true");
    addEventListener("pointerdown", onAway, true); addEventListener("keydown", onKey, true);
    (menu.querySelector("button") as HTMLButtonElement).focus();
  };

  b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (menu) close(); else open(); });
  // Last in the row (after Photoreal and On site, which insert themselves right after walkBtn).
  walkBtn.parentElement.append(b);
  return b;
}
