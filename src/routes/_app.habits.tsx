import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/habits")({
  beforeLoad: () => {
    throw redirect({ to: "/lifestyle" });
  },
});
