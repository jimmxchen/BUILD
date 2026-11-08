import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";
import "./welcome.css";

export const metadata: Metadata = {
  title: "BUILD — Design your home. Step inside before it’s built.",
  description: "Turn a simple description into an editable, rule-checked floor plan and an explorable 3D home. Walk the space, refine the layout, and see your ideas take shape.",
};

export default function Welcome() { return <Landing />; }
