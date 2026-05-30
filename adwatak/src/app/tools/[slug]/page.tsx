import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getToolBySlug, tools } from "@/lib/tools";
import ToolPlaceholder from "./ToolPlaceholder";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getToolBySlug(params.slug);

  if (!tool) {
    return { title: "أداة غير موجودة" };
  }

  return {
    title: tool.name,
    description: tool.description,
    openGraph: {
      title: `${tool.name} | أدواتك`,
      description: tool.description,
    },
  };
}

export default function ToolPage({ params }: Props) {
  const tool = getToolBySlug(params.slug);

  if (!tool) {
    notFound();
  }

  // Force redirect for the ready tool to its correct static route
  if (tool.slug === "jpg-to-pdf") redirect("/tools/jpg-to-pdf");
  if (tool.slug === "pdf-merge") redirect("/tools/pdf-merge");

  return <ToolPlaceholder tool={tool} />;
}
