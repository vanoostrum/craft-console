import type { Metadata } from "next";
import { NO_REPO } from "@/lib/session-metadata";
import {
  ProjectPage,
  projectMetadata,
  type SearchParams,
} from "../project-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return projectMetadata(NO_REPO);
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <ProjectPage repo={NO_REPO} searchParams={searchParams} />;
}
