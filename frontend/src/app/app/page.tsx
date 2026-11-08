import type { Metadata } from "next";
import SiteModel from "@/components/SiteModel";

export const metadata: Metadata = {
  title: "BUILD — Design a home",
  description: "Describe a home, get a rule-checked floor plan, and walk through it in 3D.",
};

export default function AppPage() {
  return <SiteModel />;
}
