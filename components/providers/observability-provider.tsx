"use client";

import { createContext, useContext, useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import axios from "axios";

interface ObservabilityContextProps {
  logEvent: (eventType: string, metadata?: any) => void;
}

const ObservabilityContext = createContext<ObservabilityContextProps | null>(null);

export const useObservability = () => {
  const context = useContext(ObservabilityContext);
  if (!context) {
    throw new Error("useObservability must be used within an ObservabilityProvider");
  }
  return context;
};

// UTM Tracker wrapped in Suspense to prevent root layout hydration deopt or errors
const UTMTracker = () => {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams) {
      const utm_source = searchParams.get("utm_source");
      const utm_medium = searchParams.get("utm_medium");
      const utm_campaign = searchParams.get("utm_campaign");
      
      if (utm_source) {
        sessionStorage.setItem("utm_source", utm_source);
        document.cookie = `utm_source=${utm_source}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (utm_medium) {
        sessionStorage.setItem("utm_medium", utm_medium);
        document.cookie = `utm_medium=${utm_medium}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (utm_campaign) {
        sessionStorage.setItem("utm_campaign", utm_campaign);
        document.cookie = `utm_campaign=${utm_campaign}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
    }
  }, [searchParams]);

  return null;
};

export const ObservabilityProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  
  const sessionRef = useRef<string>("");
  const currentPathRef = useRef<string>("");
  const entryTimeRef = useRef<number>(0);
  const maxScrollRef = useRef<number>(0);

  // Utility to send event log
  const logEvent = (eventType: string, metadata: any = {}, durationMs?: number) => {
    try {
      const sessId = sessionRef.current || sessionStorage.getItem("cpe_session_id") || "anonymous";
      const utmSource = sessionStorage.getItem("utm_source") || undefined;
      const utmMedium = sessionStorage.getItem("utm_medium") || undefined;
      const utmCampaign = sessionStorage.getItem("utm_campaign") || undefined;
      const referrer = sessionStorage.getItem("cpe_referrer") || undefined;

      const payload = {
        sessionId: sessId,
        eventType,
        pathname: pathname || window.location.pathname,
        referrer,
        durationMs,
        utmSource,
        utmMedium,
        utmCampaign,
        metadata,
      };

      // Use sendBeacon for exiting events, axios for active ones
      if (eventType === "page_exit" && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/observability/log", JSON.stringify(payload));
      } else {
        axios.post("/api/observability/log", payload).catch((err) => {
          // Silent catch in production
          console.error("Failed to log event:", err);
        });
      }
    } catch (err) {
      console.error("Failed to track observability event:", err);
    }
  };

  // Initialize Session and Referrer
  useEffect(() => {
    // 1. Get or generate Session ID
    let sessId = sessionStorage.getItem("cpe_session_id");
    if (!sessId) {
      sessId = typeof crypto.randomUUID === "function" 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      sessionStorage.setItem("cpe_session_id", sessId);
    }
    sessionRef.current = sessId;
    document.cookie = `cpe_session_id=${sessId}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days

    if (typeof document !== "undefined" && document.referrer) {
      sessionStorage.setItem("cpe_referrer", document.referrer);
      document.cookie = `cpe_referrer=${encodeURIComponent(document.referrer)}; path=/; max-age=${60 * 60 * 24 * 30}`;
    }

    // 2. Log initial session start
    logEvent("session_start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track Page transitions and Duration
  useEffect(() => {
    if (!pathname) return;

    const entryTime = Date.now();
    const prevPath = currentPathRef.current;
    
    // Log exit of previous page
    if (prevPath && entryTimeRef.current > 0) {
      const duration = Date.now() - entryTimeRef.current;
      
      // If we are on the landing page, attach scroll depth to the exit metadata
      const meta: any = {};
      if (prevPath === "/") {
        meta.maxScrollPercent = maxScrollRef.current;
      }

      // Track duration spent on previous screen
      logEvent("page_exit", meta, duration);
    }

    // Update refs for new page view
    currentPathRef.current = pathname;
    entryTimeRef.current = entryTime;
    maxScrollRef.current = 0; // Reset scroll depth

    // Log new page view
    logEvent("page_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Track scroll depth on landing page (/)
  useEffect(() => {
    if (pathname !== "/") return;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      if (docHeight <= 0) return;
      
      const scrollPercent = Math.min(100, Math.round((scrollTop / docHeight) * 100));
      if (scrollPercent > maxScrollRef.current) {
        maxScrollRef.current = scrollPercent;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  // Send last page_exit on browser unload
  useEffect(() => {
    const handleUnload = () => {
      if (currentPathRef.current && entryTimeRef.current > 0) {
        const duration = Date.now() - entryTimeRef.current;
        const meta: any = {};
        if (currentPathRef.current === "/") {
          meta.maxScrollPercent = maxScrollRef.current;
        }
        logEvent("page_exit", meta, duration);
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ObservabilityContext.Provider value={{ logEvent }}>
      <Suspense fallback={null}>
        <UTMTracker />
      </Suspense>
      {children}
    </ObservabilityContext.Provider>
  );
};
