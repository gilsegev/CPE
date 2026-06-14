"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PaymentVerificationPoller = () => {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 15; // 30 seconds total (15 * 2s)
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (timedOut) return;

    const interval = setInterval(() => {
      setAttempts((prev) => {
        const next = prev + 1;
        if (next >= maxAttempts) {
          setTimedOut(true);
          clearInterval(interval);
          return prev;
        }
        router.refresh();
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [router, timedOut]);

  const handleManualRefresh = () => {
    router.refresh();
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 my-6 bg-slate-900 border border-slate-800 rounded-xl text-center shadow-lg max-w-2xl mx-auto">
      {!timedOut ? (
        <>
          <Loader2 className="h-8 w-8 text-sky-400 animate-spin mb-4" />
          <h3 className="text-lg font-semibold text-white">Verifying payment with Square...</h3>
          <p className="text-sm text-slate-400 mt-2">
            Please wait while we unlock your course content. This page will automatically update once verified (Attempt {attempts + 1}/{maxAttempts}).
          </p>
        </>
      ) : (
        <>
          <RefreshCw className="h-8 w-8 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-white">Verification taking longer than expected</h3>
          <p className="text-sm text-slate-400 mt-2 mb-4">
            If you have successfully completed the transaction, the enrollment is registering in the database. Please try refreshing manually.
          </p>
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            className="border-slate-700 text-white hover:bg-slate-800 hover:text-white"
          >
            Refresh Page
          </Button>
        </>
      )}
    </div>
  );
};
