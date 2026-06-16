import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/templates")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
