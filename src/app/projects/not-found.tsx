import type { Metadata } from "next";
import { NotFoundBody } from "./not-found-body";

export const metadata: Metadata = { title: "Not found · Craft Console" };

export default function ProjectNotFound() {
  return <NotFoundBody />;
}
