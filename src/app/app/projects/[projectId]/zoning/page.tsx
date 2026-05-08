import { redirect } from 'next/navigation';

type ProjectZoningPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectZoningPage({ params }: ProjectZoningPageProps) {
  const { projectId } = await params;

  redirect(`/app/zoning?projectId=${encodeURIComponent(projectId)}`);
}
