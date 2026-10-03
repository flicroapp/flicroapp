import { createFileRoute } from "@tanstack/react-router";
import { handleNearby } from "@/lib/multiplayer/signaling.server";

const handle = ({ request }: { request: Request }) => handleNearby(request);

export const Route = createFileRoute("/api/nearby")({
  server: { handlers: { GET: handle } },
});
