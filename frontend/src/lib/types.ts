// Mirrors backend/walkthru/schema.py and docs/CONTRACTS.md. All units feet;
// origin = footprint top-left; x east, y south. In 3D: plan x -> three x, plan y -> three z.

export type RoomType =
  | "living" | "kitchen" | "dining" | "bedroom" | "primary_bedroom" | "bathroom"
  | "office" | "laundry" | "entry" | "hall" | "closet" | "workroom" | "basketball_court";

export interface Point { x: number; y: number }
export interface Footprint { width_ft: number; depth_ft: number; outline?: Point[] | null; holes?: Point[][] }

export type Archetype = "residential" | "warehouse_conversion" | "loft" | "mixed_use" | "office" | "custom";
export interface Architecture {
  architecture_version?: number; archetype?: Archetype; style?: "neutral" | "industrial" | "brutalist";
  design_notes?: string[];
}
export interface CanonicalWall {
  id: string; x1: number; y1: number; x2: number; y2: number;
  orientation: "horizontal" | "vertical"; exterior: boolean; rooms: string[]; thickness_ft: number;
  openings: { type: string; offset_ft: number; width_ft: number; sill_ft: number; head_ft: number }[];
}
export interface RoomSpec {
  zone?: "public" | "private" | "work" | "recreation" | "service" | "circulation";
  min_width_ft?: number | null; min_depth_ft?: number | null; max_aspect_ratio?: number | null;
  court_format?: "auto" | "full" | "half" | "compact" | null; ceiling_height_ft?: number | null;
  id: string; type: RoomType; name: string; target_sqft: number; adjacent_to: string[];
}
export interface Room extends RoomSpec { x: number; y: number; w: number; h: number }

export interface Door { between: [string, string] | string[]; x: number; y: number; width_ft: number; orientation?: "horizontal" | "vertical" | null; kind?: "door" | "front" | "opening" }
export interface Window { room: string; wall: "north" | "south" | "east" | "west"; offset_ft: number; width_ft: number; sill_ft?: number; head_ft?: number }
export interface Check { rule: string; pass: boolean; message: string }

export interface Layout extends Architecture {
  walls?: CanonicalWall[]; open_connections?: string[][]; ceiling_ft?: number;
  footprint: Footprint; entrance: Point; rooms: Room[]; doors: Door[];
  windows: Window[]; checks: Check[]; requested_sqft?: number | null;
}

export interface RoomProgram extends Architecture { open_plan?: boolean; requested_sqft: number; aspect_ratio: number; rooms: RoomSpec[]; notes: string }
export interface FixRound { round: number; failed: Check[]; note: string }

export interface GenerateResponse {
  layout: Layout; program: RoomProgram; rounds: FixRound[];
  attempts: number; elapsed_s: number; cached: boolean;
}

// POST /api/chat
export type ChatAction = "ask" | "answer" | "edit" | "generate";
export interface ChatMessage { role: "user" | "assistant"; content: string }
export interface ChatRequest { messages: ChatMessage[]; program: RoomProgram | null; layout: Layout | null }
export interface ChatResponse {
  action: ChatAction;
  reply: string;
  options: string[];                 // 0-4 tappable answers / suggested next messages
  brief: string | null;              // "generate": pass to /api/generate as {prompt: brief}
  result: GenerateResponse | null;   // "edit": the edited plan
}

export const EYE_HEIGHT_FT = 5.5;
export const WALL_HEIGHT_FT = 9;
export const EXTERIOR = "exterior";
