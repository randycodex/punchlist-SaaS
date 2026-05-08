import AuthShell from '@/components/saas/AuthShell';
import ClerkAuthPanel from '@/components/saas/ClerkAuthPanel';

export default function LoginPage() {
  return (
    <AuthShell mode="login">
      <ClerkAuthPanel mode="login" />
    </AuthShell>
  );
}
