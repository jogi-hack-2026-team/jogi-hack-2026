"use client";
import { useRouter } from "next/navigation";
import { Screens } from "../../shared/Screens";
export default function Page() {
  const router = useRouter();
  return <Screens screen="search" go={(path) => router.push(path)} />;
}
