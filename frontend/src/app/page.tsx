import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";
import "./landing.css";

export const metadata: Metadata = {
  title: "BUILD — Design your home. Step inside before it’s built.",
  description: "Turn a simple description into a rule-checked floor plan and an explorable 3D home.",
};

export default function Home() {
  return <Landing />;
}
