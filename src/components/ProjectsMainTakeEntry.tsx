import { ProjectsMainTake } from "@/components/ProjectsMainTake";
import { ProjectsMainTakeLightArchive } from "@/components/ProjectsMainTakeLightArchive";

function getProjectsMainTakeVariant(): string {
  return (process.env.PROJECTS_MAIN_TAKE_VARIANT ?? "").trim().toLowerCase();
}

export async function ProjectsMainTakeEntry() {
  const variant = getProjectsMainTakeVariant();

  if (variant === "light-archive" || variant === "direwolf-light-archive") {
    return <ProjectsMainTakeLightArchive />;
  }

  return <ProjectsMainTake />;
}
