import { createFileRoute } from "@tanstack/react-router";
import { TodayPage } from "./_app.today";

export const Route = createFileRoute("/_app/home")({
  component: TodayPage,
});