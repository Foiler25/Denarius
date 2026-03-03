import { useQuery } from "@tanstack/react-query";
import api from "./client";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard/summary").then((r) => r.data),
    refetchInterval: 60_000,
  });
}
