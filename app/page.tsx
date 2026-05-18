"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthed } from "@/lib/soomAuth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isAuthed() ? "/dashboard" : "/login");
  }, [router]);
  return null;
}
