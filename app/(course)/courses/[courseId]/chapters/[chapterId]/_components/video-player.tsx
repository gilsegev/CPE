"use client";

import axios from "axios";
import MuxPlayer from "@mux/mux-player-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { useConfettiStore } from "@/hooks/use-confetti-store";
import { useObservability } from "@/components/providers/observability-provider";

interface VideoPlayerProps {
  playbackId: string;
  courseId: string;
  chapterId: string;
  nextChapterId?: string;
  isLocked: boolean;
  completeOnEnd: boolean;
  title: string;
}

export const VideoPlayer = ({
  playbackId,
  courseId,
  chapterId,
  nextChapterId,
  isLocked,
  completeOnEnd,
  title,
}: VideoPlayerProps) => {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const confetti = useConfettiStore();
  const maxTimeWatched = useRef(0);
  const previousTime = useRef(0);

  const { logEvent } = useObservability();
  const isPlayingRef = useRef(false);
  const watchStartTimeRef = useRef(0);
  const totalWatchTimeRef = useRef(0);

  useEffect(() => {
    // Reset watch tracking state on chapter change
    isPlayingRef.current = false;
    watchStartTimeRef.current = 0;
    totalWatchTimeRef.current = 0;

    return () => {
      // Log any remaining watch duration on unmount or chapter change
      if (isPlayingRef.current && watchStartTimeRef.current > 0) {
        const segment = Date.now() - watchStartTimeRef.current;
        const finalTotal = totalWatchTimeRef.current + segment;
        logEvent("video_watch", { chapterId, title, segmentMs: segment, totalMs: finalTotal });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, title]);

  const onPlay = () => {
    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      watchStartTimeRef.current = Date.now();
    }
  };

  const onPause = () => {
    if (isPlayingRef.current && watchStartTimeRef.current > 0) {
      const segment = Date.now() - watchStartTimeRef.current;
      totalWatchTimeRef.current += segment;
      isPlayingRef.current = false;
      watchStartTimeRef.current = 0;
      logEvent("video_watch", { chapterId, title, segmentMs: segment, totalMs: totalWatchTimeRef.current });
    }
  };

  const onEnd = async () => {
    try {
      if (completeOnEnd) {
        await axios.put(`/api/courses/${courseId}/chapters/${chapterId}/progress`, {
          isCompleted: true,
        });

        if (!nextChapterId) {
          confetti.onOpen();
        }

        toast.success("Progress updated");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  const onTimeUpdate = (e: any) => {
    const player = e.target;
    if (!player) return;

    // Intercept seeking forward (allowing a 2-second buffer for natural playback updates/jumps)
    if (player.currentTime > maxTimeWatched.current + 2.0) {
      player.currentTime = previousTime.current;
      toast.error("Forward seeking is disabled. Please watch the module in full.");
    } else {
      previousTime.current = player.currentTime;
      maxTimeWatched.current = Math.max(maxTimeWatched.current, player.currentTime);
    }
  };

  const onSeeking = (e: any) => {
    const player = e.target;
    if (!player) return;

    if (player.currentTime <= maxTimeWatched.current) {
      previousTime.current = player.currentTime;
    }
  };

  return (
    <div className="relative aspect-video">
      {!isReady && !isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      )}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 flex-col gap-y-2 text-secondary">
          <Lock className="h-8 w-8" />
          <p className="text-sm">
            This chapter is locked
          </p>
        </div>
      )}
      {!isLocked && (
        <MuxPlayer
          title={title}
          className={cn(
            !isReady && "hidden"
          )}
          onCanPlay={() => setIsReady(true)}
          onEnded={onEnd}
          onTimeUpdate={onTimeUpdate}
          onSeeking={onSeeking}
          onPlay={onPlay}
          onPause={onPause}
          autoPlay
          playbackId={playbackId}
        />
      )}
    </div>
  )
}