import { redirect } from "next/navigation";

// The landing page moved to "/"; keep old links working.
export default function Welcome() {
  redirect("/");
}
