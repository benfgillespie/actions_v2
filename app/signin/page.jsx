import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import SignInCard from "@/components/auth/SignInCard";
import { authOptions } from "@/lib/authOptions";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/games");
  }

  return (
    <div className="page-container">
      <SignInCard />
    </div>
  );
}
