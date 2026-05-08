import ZoningDashboard from '@/components/zoning/ZoningDashboard';

type ZoningPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectZoningPage({ params }: ZoningPageProps) {
  const { projectId } = await params;

  return <ZoningDashboard projectId={projectId} />;
}
