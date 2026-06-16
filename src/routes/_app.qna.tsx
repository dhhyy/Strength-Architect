import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/qna")({
  beforeLoad: () => {
    throw redirect({ to: "/board" });
  },
});
