// Content and geometry shared by the landing page. Every layout here is real solver output.
import sample from "@/lib/sample-layout.json";
import edited from "./edit-kitchen-larger.json";
import type { Layout, Room } from "@/lib/types";

/** The bundled sample: backend solver output for the default brief, all checks passing. */
export const LAYOUT = sample as Layout;
/**
 * Same room program re-solved with the kitchen's target area raised from 210 to 284 sq ft,
 * keeping the previous layout (`solver.solve(program, keep=layout)`), then re-checked.
 * This is the geometric step BUILD runs after the planner turns "Make the kitchen larger"
 * into a program change. Generated offline from backend/walkthru (no LLM call).
 */
export const EDITED_LAYOUT = edited as Layout;

export const PROMPT = "Design a 1,800 sq ft home with three bedrooms, two bathrooms, an open kitchen, and a home office.";
export const EDIT_PROMPT = "Make the kitchen larger.";

// The real app lives at "/" in this Next app. Override for a separately deployed app.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "/";
export const GITHUB_URL = "https://github.com/jimmxchen/BUILD";

// Room fills from the Site model app (src/build/siteModelApp.js FLOOR), as CSS colors.
export const ROOM_FILL: Record<string, string> = {
  living: "#e7d8bd", kitchen: "#e2dfd7", dining: "#e6d4b6", bedroom: "#ecdfc8", primary_bedroom: "#e9d7ba",
  bathroom: "#d9e2e5", office: "#e0d1b6", laundry: "#dde1da", hall: "#f0e9db", entry: "#f0e9db", closet: "#e6e1d6",
};

export const RULE_LABELS: Record<string, string> = {
  contract_integrity: "Layout data is complete and consistent",
  no_overlap_in_footprint: "No rooms overlap; all fit the footprint",
  door_geometry: "Every door sits on a wall the two rooms share",
  all_rooms_reachable: "Every room reachable from the front door",
  bedroom_exterior_wall: "Bedrooms have a window wall and a door",
  public_bathroom: "A bathroom guests can reach without a bedroom",
  kitchen_adjacent: "Kitchen opens onto dining or living",
  min_hall_and_door_width: "Halls at least 3 ft, doors at least 2′8″",
  sizes_within_10pct: "Every room within 10% of its target area",
};

export const ftIn = (ft: number) => {
  const f = Math.floor(ft + 1e-6), i = Math.round((ft - f) * 12);
  return i ? `${f}′${i}″` : `${f}′`;
};
export const area = (r: Room) => Math.round(r.w * r.h);
export const totalArea = (l: Layout) => l.rooms.reduce((s, r) => s + r.w * r.h, 0);

/** Rooms connected to `id` through a door or opening. */
export function neighbours(l: Layout, id: string): Room[] {
  const ids = new Set<string>();
  for (const d of l.doors) if (d.between.includes(id)) d.between.forEach((b) => b !== id && b !== "exterior" && ids.add(b));
  return l.rooms.filter((r) => ids.has(r.id));
}

export const STATS = {
  feature: {
    value: 37, suffix: "%",
    label: "of U.S. homeowners who renovated in 2025 spent more than they planned.",
    split: [
      { label: "Over budget", value: 37 }, { label: "On budget", value: 35 },
      { label: "Under budget", value: 3 }, { label: "No budget set", value: 25 },
    ],
    source: "2026 U.S. Houzz & Home Renovation Trends Study, p. 11. Online survey of 10,176 renovating homeowners on Houzz, fielded Jan–Mar 2026.",
    href: "https://st.hzcdn.com/static/econ/2026_U.S._Houzz_and_Home_Study_RenovationTrends.pdf",
  },
  supporting: [
    {
      value: 31, prefix: "", suffix: "%",
      label: "of those over budget cited a changed project scope or design.",
      source: "Houzz & Home 2026, p. 11",
      href: "https://st.hzcdn.com/static/econ/2026_U.S._Houzz_and_Home_Study_RenovationTrends.pdf",
    },
    {
      value: 20000, prefix: "$", suffix: "",
      label: "median renovation spend among U.S. homeowners in 2025, before any new home is designed.",
      source: "Houzz & Home 2026, p. 5",
      href: "https://st.hzcdn.com/static/econ/2026_U.S._Houzz_and_Home_Study_RenovationTrends.pdf",
    },
    {
      value: 10.5, prefix: "", suffix: " mo",
      label: "average from start of construction to completion for a contractor-built (custom) single-family home in 2025.",
      source: "U.S. Census Bureau, Survey of Construction",
      href: "https://www.census.gov/construction/nrc/data/time.html",
    },
  ],
};
