import type { Metadata } from "next";
import {
  ProjectPage,
  projectMetadata,
  type SearchParams,
} from "../../project-page";

export const dynamic = "force-dynamic";

type Params = Promise<{ owner: string; repo: string }>;

const repoOf = async (params: Params) => {
  const { owner, repo } = await params;
  return `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}`;
};

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  return projectMetadata(await repoOf(params));
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <ProjectPage repo={await repoOf(params)} searchParams={searchParams} />
  );
}
