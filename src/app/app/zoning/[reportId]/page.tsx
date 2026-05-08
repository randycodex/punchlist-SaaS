import ZoningDashboard from '@/components/zoning/ZoningDashboard';

type ZoningReportPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ZoningReportPage({ params }: ZoningReportPageProps) {
  const { reportId } = await params;

  return <ZoningDashboard reportId={reportId} />;
}
