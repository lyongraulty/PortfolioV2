import { getProjectBySlug, projectEntries, type ProjectEntry } from "@/lib/projects";

export type WorkItem = ProjectEntry;

export const workItems: WorkItem[] = projectEntries;

export function getWorkBySlug(slug: string) {
  return getProjectBySlug(slug);
}
