import ZoningHome from '@/components/zoning/ZoningHome';

type ZoningHomePageProps = {
  searchParams: Promise<{
    projectId?: string;
    address?: string;
  }>;
};

export default async function ZoningHomePage({ searchParams }: ZoningHomePageProps) {
  const { projectId, address } = await searchParams;

  return <ZoningHome projectSeed={projectId} addressSeed={address} />;
}
