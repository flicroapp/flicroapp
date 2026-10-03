import { createFileRoute } from "@tanstack/react-router";
import { handleOnline } from "@/lib/multiplayer/signaling.server";

const handle = ({ request }: { request: Request }) => handleOnline(request);

export const Route = createFileRoute("/api/online")({
  server: { handlers: { GET: handle, OPTIONS: handle } },
});
