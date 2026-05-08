import AuthShell from '@/components/saas/AuthShell';
import ClerkAuthPanel from '@/components/saas/ClerkAuthPanel';

export default function SignupPage() {
  return (
    <AuthShell mode="signup">
      <ClerkAuthPanel mode="signup" />
    </AuthShell>
  );
}
