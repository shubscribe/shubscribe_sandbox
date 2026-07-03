import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const settings = await getSettings();
  if (settings.onboarded) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <OnboardingWizard defaultName={session.user.name ?? ""} />
    </main>
  );
}
