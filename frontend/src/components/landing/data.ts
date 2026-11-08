// Content shared by the landing page. The layout is real solver output (shared sample).
import sample from "@/lib/sample-layout.json";
import type { Layout } from "@/lib/types";

export const LAYOUT = sample as Layout;
export const PROMPT = "3 bed, 2 bath, open kitchen, home office, about 1,800 sq ft";

// The app lives at /app in this Next app. Override for a separately deployed app.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "/app";
export const GITHUB_URL = "https://github.com/jimmxchen/BUILD";

// Room fills from the Site model app (src/build/siteModelApp.js FLOOR), as CSS colours.
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

export const totalArea = (l: Layout) => l.rooms.reduce((s, r) => s + r.w * r.h, 0);

const HOUZZ = "https://st.hzcdn.com/static/econ/2026_U.S._Houzz_and_Home_Study_RenovationTrends.pdf";

/** Scale of the problem. Each figure checked against its original source on 2026-11-08. */
export const SCALE = [
  {
    value: 939700, prefix: "", suffix: "", label: "new single-family homes started in the U.S. in 2025.",
    source: "U.S. Census Bureau, New Residential Construction", href: "https://www.census.gov/construction/nrc/index.html",
  },
  {
    value: 518, prefix: "$", suffix: "B", label: "projected U.S. homeowner spending on improvements and repairs in 2026.",
    source: "Harvard JCHS, Leading Indicator of Remodeling Activity (rev. Apr 2026)", href: "https://www.jchs.harvard.edu/press-releases/remodeling-growth-set-downshift-late-2026",
  },
  {
    value: 91, prefix: "", suffix: "%", label: "of homeowners who renovated in 2025 hired at least one professional.",
    source: "2026 U.S. Houzz & Home Study, p. 22", href: HOUZZ,
  },
  {
    value: 37, prefix: "", suffix: "%", label: "of them spent more than they planned. 31% of those cited a changed scope or design.",
    source: "2026 U.S. Houzz & Home Study, p. 11", href: HOUZZ,
  },
];
