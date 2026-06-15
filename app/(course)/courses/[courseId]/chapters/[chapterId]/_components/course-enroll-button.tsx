"use client";

import axios from "axios";
import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";

interface CourseEnrollButtonProps {
  price: number;
  courseId: string;
  isLoggedIn: boolean;
  chapterId: string;
}

export const CourseEnrollButton = ({
  price,
  courseId,
  isLoggedIn,
  chapterId,
}: CourseEnrollButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    if (!isLoggedIn) {
      window.location.assign(`/sign-in?redirectTo=/courses/${courseId}/chapters/${chapterId}`);
      return;
    }

    try {
      setIsLoading(true);

      const response = await axios.post(`/api/courses/${courseId}/checkout`)

      window.location.assign(response.data.url);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-y-2 w-full md:w-auto">
      <Button
        onClick={onClick}
        disabled={isLoading}
        size="lg"
        className="w-full md:w-auto font-bold px-8 py-4 bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center gap-x-2 shadow-md hover:shadow-lg transition-all"
      >
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        Enroll in Course - {formatPrice(price)}
      </Button>
      {isLoading && (
        <span className="text-xs text-slate-400 animate-pulse text-center font-medium">
          Securing your enrollment details... Please do not refresh.
        </span>
      )}
    </div>
  )
}