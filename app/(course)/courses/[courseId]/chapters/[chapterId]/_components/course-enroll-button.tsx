"use client";

import axios from "axios";
import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { useObservability } from "@/components/providers/observability-provider";

interface CourseEnrollButtonProps {
  price: number;
  courseId: string;
  isLoggedIn: boolean;
  chapterId: string;
  label?: string;
}

export const CourseEnrollButton = ({
  price,
  courseId,
  isLoggedIn,
  chapterId,
  label,
}: CourseEnrollButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { logEvent } = useObservability();
  const buttonLabel = label || `Enroll in Course - ${formatPrice(price)}`;
  const signInHref = `/sign-in?redirectTo=${encodeURIComponent(`/courses/${courseId}/chapters/${chapterId}`)}`;

  const onClick = async () => {
    try {
      setIsLoading(true);
      void logEvent("checkout_start", { courseId, price });

      const response = await axios.post(`/api/courses/${courseId}/checkout`);
      const checkoutUrl = response.data?.url;

      if (typeof checkoutUrl !== "string" || !checkoutUrl) {
        throw new Error("Checkout URL is missing from the response.");
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      console.error("[COURSE_ENROLL_ERROR]", error);
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-y-2 w-full md:w-auto">
      {isLoggedIn ? (
        <Button
          onClick={onClick}
          disabled={isLoading}
          size="lg"
          className="w-full md:w-auto font-bold px-8 py-4 bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center gap-x-2 shadow-md hover:shadow-lg transition-all"
        >
          {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          {buttonLabel}
        </Button>
      ) : (
        <Button
          asChild
          size="lg"
          className="w-full md:w-auto font-bold px-8 py-4 bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center gap-x-2 shadow-md hover:shadow-lg transition-all"
        >
          <Link href={signInHref}>{buttonLabel}</Link>
        </Button>
      )}
      {isLoading && (
        <span className="text-xs text-slate-400 animate-pulse text-center font-medium">
          Securing your enrollment details... Please do not refresh.
        </span>
      )}
    </div>
  )
}
