"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { 
  Users, 
  Activity, 
  UserPlus, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Search, 
  Filter, 
  Video, 
  BookOpen 
} from "lucide-react";

interface Log {
  id: string;
  user_id?: any;
  session_id: string;
  event_type: string;
  pathname: string;
  referrer?: string;
  duration_ms?: number;
  ip_address?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  metadata?: any;
  timestamp: string;
}

interface ObservabilityClientProps {
  initialLogs: Log[];
}

const formatDuration = (ms?: number) => {
  if (ms === undefined || ms === null) return "-";
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  return `${min}m ${remSec}s`;
};

export const ObservabilityClient = ({ initialLogs }: ObservabilityClientProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"flow" | "audit">("flow");
  const itemsPerPage = 15;

  const sessionTimelineLogs = useMemo(() => {
    if (!selectedSessionId) return [];
    return initialLogs
      .filter((l) => l.session_id === selectedSessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [initialLogs, selectedSessionId]);

  const pageNodes = useMemo(() => {
    const nodes: Array<{
      path: string;
      entryTime: string;
      exitTime?: string;
      durationMs?: number;
      events: Array<{ type: string; label: string; time: string; metadata?: any }>;
    }> = [];

    let currentNode: typeof nodes[0] | null = null;

    sessionTimelineLogs.forEach((log) => {
      if (log.event_type === "page_view" || log.event_type === "session_start") {
        currentNode = {
          path: log.pathname || "/",
          entryTime: log.timestamp,
          events: [],
        };
        nodes.push(currentNode);
      } else if (log.event_type === "page_exit") {
        if (currentNode) {
          currentNode.exitTime = log.timestamp;
          currentNode.durationMs = log.duration_ms;
        }
      } else {
        if (!currentNode) {
          currentNode = {
            path: log.pathname || "/",
            entryTime: log.timestamp,
            events: [],
          };
          nodes.push(currentNode);
        }
        
        let label = log.event_type.replace("_", " ");
        if (log.event_type === "video_watch") {
          label = `Watched Video (${formatDuration(log.metadata?.segmentMs)})`;
        } else if (log.event_type === "login_success") {
          label = `Signed In (${log.metadata?.email || "Google"})`;
        } else if (log.event_type === "signup_success") {
          label = `Registered (${log.metadata?.email || "Email"})`;
        } else if (log.event_type === "checkout_start") {
          label = `Clicked Enroll (Price: $${log.metadata?.price || "0"})`;
        } else if (log.event_type === "purchase_success") {
          label = `Completed Purchase`;
        }

        currentNode.events.push({
          type: log.event_type,
          label,
          time: log.timestamp,
          metadata: log.metadata,
        });
      }
    });

    return nodes;
  }, [sessionTimelineLogs]);

  // Process data in-memory using useMemo
  const metrics = useMemo(() => {
    const totalViews = initialLogs.filter((l) => l.event_type === "page_view").length;
    const uniqueSessions = new Set(initialLogs.map((l) => l.session_id)).size;
    const signups = initialLogs.filter((l) => l.event_type === "signup_success").length;
    const checkouts = initialLogs.filter((l) => l.event_type === "checkout_start").length;
    const purchases = initialLogs.filter((l) => l.event_type === "purchase_success").length;

    const conversionRate = uniqueSessions > 0 ? ((purchases / uniqueSessions) * 100).toFixed(1) : "0.0";

    // 1. Calculate Average Video Watch Time
    const videoWatchLogs = initialLogs.filter((l) => l.event_type === "video_watch");
    const totalVideoMs = videoWatchLogs.reduce((acc, curr) => acc + (curr.metadata?.segmentMs || 0), 0);
    const avgVideoSec = videoWatchLogs.length > 0 ? Math.round((totalVideoMs / videoWatchLogs.length) / 1000) : 0;

    // 2. Compute Conversion Trace & Time-to-Convert (Payback / Registration to purchase interval)
    // Group logs by session
    const sessionLogsMap: Record<string, Log[]> = {};
    initialLogs.forEach((log) => {
      if (!sessionLogsMap[log.session_id]) {
        sessionLogsMap[log.session_id] = [];
      }
      sessionLogsMap[log.session_id].push(log);
    });

    const conversions: any[] = [];
    let totalTimeToConvertMs = 0;
    let conversionCount = 0;

    Object.entries(sessionLogsMap).forEach(([sessionId, sLogs]) => {
      // Sort chronologically
      const sorted = [...sLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const signupLog = sorted.find((l) => l.event_type === "signup_success" || l.event_type === "login_success");
      const purchaseLog = sorted.find((l) => l.event_type === "purchase_success");

      if (purchaseLog) {
        const firstView = sorted[0];
        const timeToConvert = new Date(purchaseLog.timestamp).getTime() - new Date(firstView.timestamp).getTime();
        totalTimeToConvertMs += timeToConvert;
        conversionCount++;

        // Calculate total video time in this session
        const sessionVideoMs = sorted
          .filter((l) => l.event_type === "video_watch")
          .reduce((acc, curr) => acc + (curr.metadata?.segmentMs || 0), 0);

        const sessionUserEmailLog = sorted.find((l) => l.user_id?.email);
        const email = sessionUserEmailLog?.user_id?.email || signupLog?.metadata?.email || "Google / Saved User";

        conversions.push({
          sessionId,
          email,
          utmSource: purchaseLog.utm_source || firstView.utm_source || "Direct / Organic",
          utmCampaign: purchaseLog.utm_campaign || firstView.utm_campaign || "None",
          timeToConvertMin: Math.max(1, Math.round(timeToConvert / 60000)),
          videoWatchMin: (sessionVideoMs / 60000).toFixed(1),
          timestamp: purchaseLog.timestamp,
        });
      }
    });

    const avgConversionMin = conversionCount > 0 ? Math.round((totalTimeToConvertMs / conversionCount) / 60000) : 0;

    // 3. Traffic Trend (Views grouped by Date)
    const trafficByDate: Record<string, { date: string; Views: number; Sessions: number }> = {};
    [...initialLogs].reverse().forEach((log) => {
      const dateStr = new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      if (!trafficByDate[dateStr]) {
        trafficByDate[dateStr] = { date: dateStr, Views: 0, Sessions: 0 };
      }
      if (log.event_type === "page_view") {
        trafficByDate[dateStr].Views += 1;
      }
      trafficByDate[dateStr].Sessions = new Set(
        initialLogs
          .filter((l) => new Date(l.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }) === dateStr)
          .map((l) => l.session_id)
      ).size;
    });
    const trafficChartData = Object.values(trafficByDate);

    // 4. Funnel Chart Data
    const funnelChartData = [
      { name: "1. Total Visitors", Users: uniqueSessions },
      { name: "2. Signups/Logins", Users: signups + initialLogs.filter(l => l.event_type === "login_success").length },
      { name: "3. Started Checkout", Users: checkouts },
      { name: "4. Purchases", Users: purchases },
    ];

    // 5. Time Spent per Page Path
    const pageTimeMap: Record<string, { path: string; totalMs: number; count: number }> = {};
    initialLogs.forEach((log) => {
      if (log.event_type === "page_exit" && log.duration_ms) {
        let cleanPath = log.pathname;
        if (cleanPath.startsWith("/courses/")) {
          cleanPath = "/courses/[course_details]";
        }
        if (!pageTimeMap[cleanPath]) {
          pageTimeMap[cleanPath] = { path: cleanPath, totalMs: 0, count: 0 };
        }
        // Cap individual page duration at 5 minutes (300,000 ms) to prevent backgrounded tabs from skewing metrics
        const duration = Math.min(log.duration_ms, 300000);
        pageTimeMap[cleanPath].totalMs += duration;
        pageTimeMap[cleanPath].count += 1;
      }
    });
    const pageTimeChartData = Object.values(pageTimeMap)
      .map((item) => ({
        path: item.path,
        AvgSeconds: Math.round((item.totalMs / item.count) / 1000),
      }))
      .sort((a, b) => b.AvgSeconds - a.AvgSeconds)
      .slice(0, 5);

    return {
      totalViews,
      uniqueSessions,
      signups,
      checkouts,
      purchases,
      conversionRate,
      avgVideoSec,
      avgConversionMin,
      conversions,
      trafficChartData,
      funnelChartData,
      pageTimeChartData,
    };
  }, [initialLogs]);

  // Filter logs for raw database list
  const filteredLogs = useMemo(() => {
    return initialLogs.filter((log) => {
      const matchSearch =
        log.session_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.pathname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.ip_address && log.ip_address.includes(searchTerm)) ||
        (log.utm_source && log.utm_source.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.user_id?.email && log.user_id.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.metadata?.email && log.metadata.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchType = eventTypeFilter === "all" || log.event_type === eventTypeFilter;

      return matchSearch && matchType;
    });
  }, [initialLogs, searchTerm, eventTypeFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  return (
    <div className="space-y-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Page Views</span>
            <h3 className="text-3xl font-black text-white mt-1">{metrics.totalViews}</h3>
            <p className="text-xs text-sky-400 mt-1 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Logged interactions
            </p>
          </div>
          <div className="bg-sky-500/10 text-sky-400 p-4 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Unique Sessions</span>
            <h3 className="text-3xl font-black text-white mt-1">{metrics.uniqueSessions}</h3>
            <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Distinct visitors
            </p>
          </div>
          <div className="bg-indigo-500/10 text-indigo-400 p-4 rounded-xl">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Checkout Conversions</span>
            <h3 className="text-3xl font-black text-white mt-1">{metrics.purchases}</h3>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Completed purchases
            </p>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl">
            <UserPlus className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Sales Conversion Rate</span>
            <h3 className="text-3xl font-black text-emerald-400 mt-1">{metrics.conversionRate}%</h3>
            <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Session-to-sale ratio
            </p>
          </div>
          <div className="bg-emerald-500/20 text-emerald-300 p-4 rounded-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Expanded Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-x-4">
            <div className="bg-rose-500/10 text-rose-400 p-4 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Avg Time-To-Convert (Payback Speed)</span>
              <h3 className="text-2xl font-extrabold text-white mt-0.5">
                {metrics.avgConversionMin > 0 ? `${metrics.avgConversionMin} minutes` : "No purchases logged"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Elapsed from first page load to checkout purchase success</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-x-4">
            <div className="bg-amber-500/10 text-amber-400 p-4 rounded-xl">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Average Video Watch Session</span>
              <h3 className="text-2xl font-extrabold text-white mt-0.5">
                {metrics.avgVideoSec > 0 ? `${metrics.avgVideoSec} seconds` : "No plays recorded"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Direct playback duration tracked per video lecture segment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Area Chart: Traffic Trend */}
        <div className="bg-[#1a2333] p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Traffic Trends</h3>
            <p className="text-xs text-slate-400">Page Views vs. Unique Visitor Sessions</p>
          </div>
          <div className="h-72 w-full">
            {metrics.trafficChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No traffic data recorded.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.trafficChartData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155" }} labelStyle={{ color: "#fff" }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="Views" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorViews)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Sessions" stroke="#6366f1" fillOpacity={1} fill="url(#colorSess)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar Chart: Conversion Funnel */}
        <div className="bg-[#1a2333] p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Purchase Conversion Funnel</h3>
            <p className="text-xs text-slate-400">Tracking progress from first-touch to course enrollment</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.funnelChartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155" }} />
                <Bar dataKey="Users" fill="#10b981" radius={[8, 8, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Horizontal Bar Chart: Screen engagement times */}
        <div className="bg-[#1a2333] p-6 rounded-2xl border border-slate-800 shadow-xl lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Top 5 Screens by Average Engagement Duration</h3>
            <p className="text-xs text-slate-400">Identifies where visitors spend the most time (in seconds)</p>
          </div>
          <div className="h-64 w-full">
            {metrics.pageTimeChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No page engagement durations logged.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.pageTimeChartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis dataKey="path" type="category" stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155" }} />
                  <Bar dataKey="AvgSeconds" fill="#f59e0b" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Conversion Trace Details */}
      <div className="bg-[#1a2333] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center gap-x-2">
          <BookOpen className="h-5 w-5 text-emerald-400" />
          <div>
            <h3 className="text-lg font-bold text-white">Purchase Conversion Logs</h3>
            <p className="text-xs text-slate-400">Detailed session telemetry of successful course sales</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          {metrics.conversions.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No sales conversion funnels mapped yet.</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#1e293b] text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="p-4">Masked Session</th>
                  <th className="p-4">Email Reference</th>
                  <th className="p-4">UTM Source</th>
                  <th className="p-4">UTM Campaign</th>
                  <th className="p-4">Time to Buy</th>
                  <th className="p-4">Total Video watched</th>
                  <th className="p-4">Completion Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {metrics.conversions.map((conv, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="p-4 font-mono text-slate-400 text-xs">
                      <button
                        onClick={() => setSelectedSessionId(conv.sessionId)}
                        className="hover:underline text-sky-400 font-semibold focus:outline-none text-left"
                      >
                        {conv.sessionId.substring(0, 8)}...{conv.sessionId.substring(conv.sessionId.length - 6)}
                      </button>
                    </td>
                    <td className="p-4 font-medium text-white">
                      <button
                        onClick={() => setSelectedSessionId(conv.sessionId)}
                        className="hover:underline text-sky-400 font-semibold focus:outline-none text-left text-xs"
                      >
                        {conv.email}
                      </button>
                    </td>
                    <td className="p-4">{conv.utmSource}</td>
                    <td className="p-4">{conv.utmCampaign}</td>
                    <td className="p-4 text-emerald-400 font-semibold">{conv.timeToConvertMin} min</td>
                    <td className="p-4 text-amber-400 font-semibold">{conv.videoWatchMin} min</td>
                    <td className="p-4 text-xs text-slate-400">
                      {new Date(conv.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Raw Event Logs Table */}
      <div className="bg-[#1a2333] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {/* Table Header Filter controls */}
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Full Event Telemetry</h3>
            <p className="text-xs text-slate-400">Review all captured visitor actions chronologically</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search session, path, UTM..."
                className="pl-9 pr-4 py-2 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs w-full placeholder:text-slate-500"
              />
            </div>
            {/* Event Type Filter */}
            <div className="relative">
              <select
                value={eventTypeFilter}
                onChange={(e) => {
                  setEventTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs cursor-pointer appearance-none"
              >
                <option value="all">All Events</option>
                <option value="session_start">Session Start</option>
                <option value="page_view">Page View</option>
                <option value="page_exit">Page Exit</option>
                <option value="login_success">Login Success</option>
                <option value="signup_success">Signup Success</option>
                <option value="checkout_start">Checkout Start</option>
                <option value="purchase_success">Purchase Success</option>
                <option value="video_watch">Video Watch</option>
              </select>
              <Filter className="absolute right-3 top-3 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table Layout */}
        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No telemetry records match your filters.</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#1e293b] text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">Event Type</th>
                  <th className="p-4">Pathname</th>
                  <th className="p-4">Masked Session</th>
                  <th className="p-4">User Email</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Campaign</th>
                  <th className="p-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paginatedLogs.map((log) => {
                  let badgeStyle = "bg-slate-800 text-slate-400";
                  if (log.event_type === "purchase_success") badgeStyle = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
                  else if (log.event_type === "checkout_start") badgeStyle = "bg-sky-500/20 text-sky-300 border border-sky-500/30";
                  else if (log.event_type === "login_success" || log.event_type === "signup_success") badgeStyle = "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
                  else if (log.event_type === "video_watch") badgeStyle = "bg-amber-500/20 text-amber-300 border border-amber-500/30";
                  else if (log.event_type === "session_start") badgeStyle = "bg-pink-500/20 text-pink-300 border border-pink-500/30";

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="p-4 text-xs text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${badgeStyle}`}>
                          {log.event_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs max-w-xs truncate text-sky-400">{log.pathname}</td>
                      <td className="p-4 font-mono text-slate-400 text-xs">
                        <button
                          onClick={() => setSelectedSessionId(log.session_id)}
                          className="hover:underline text-sky-400 font-semibold focus:outline-none text-left"
                        >
                          {log.session_id.substring(0, 8)}...
                        </button>
                      </td>
                      <td className="p-4 text-xs text-slate-300 truncate max-w-[180px]" title={log.user_id?.email || log.metadata?.email || "Anonymous"}>
                        {log.user_id?.email || log.metadata?.email ? (
                          <button
                            onClick={() => setSelectedSessionId(log.session_id)}
                            className="hover:underline text-sky-400 font-semibold focus:outline-none text-left"
                          >
                            {log.user_id?.email || log.metadata?.email}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-4 text-xs">
                        <button
                          onClick={() => {
                            setSelectedSessionId(log.session_id);
                            setActiveTab("flow");
                          }}
                          className="hover:underline text-sky-400 font-semibold focus:outline-none text-left"
                        >
                          {log.ip_address || "Unknown"}
                        </button>
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {log.utm_source ? `${log.utm_source} / ${log.utm_campaign || "none"}` : "-"}
                      </td>
                      <td className="p-4 text-xs font-semibold text-slate-300">
                        {log.event_type === "video_watch" 
                          ? formatDuration(log.metadata?.segmentMs) 
                          : formatDuration(log.duration_ms)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing page {currentPage} of {totalPages} ({filteredLogs.length} total entries)
            </span>
            <div className="flex gap-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs hover:bg-slate-700 disabled:opacity-50 text-white cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs hover:bg-slate-700 disabled:opacity-50 text-white cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Journey Flow Timeline Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a2333] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-x-2">
                  <Activity className="h-5 w-5 text-sky-400 animate-pulse" />
                  User Engagement Journey
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Session: {selectedSessionId}
                </p>
              </div>
              <button
                onClick={() => setSelectedSessionId(null)}
                className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition cursor-pointer font-medium"
              >
                Close
              </button>
            </div>

            {/* Modal Content - Scrollable Timeline */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#101726]">
              {/* Session Meta Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block uppercase font-bold tracking-wider text-[10px] mb-0.5">User Email</span>
                  <span className="text-white font-medium">
                    {sessionTimelineLogs.find(l => l.user_id?.email || l.metadata?.email)?.user_id?.email || 
                     sessionTimelineLogs.find(l => l.user_id?.email || l.metadata?.email)?.metadata?.email || 
                     "Anonymous / Guest"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-bold tracking-wider text-[10px] mb-0.5">IP Address</span>
                  <span className="text-white font-medium">{sessionTimelineLogs[0]?.ip_address || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-bold tracking-wider text-[10px] mb-0.5">UTM Acquisition</span>
                  <span className="text-white font-medium truncate block" title={sessionTimelineLogs.find(l => l.utm_source)?.utm_source || "Direct"}>
                    {sessionTimelineLogs.find(l => l.utm_source)?.utm_source 
                      ? `${sessionTimelineLogs.find(l => l.utm_source)?.utm_source} / ${sessionTimelineLogs.find(l => l.utm_source)?.utm_campaign || "none"}`
                      : "Direct / Organic"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-bold tracking-wider text-[10px] mb-0.5">Referrer</span>
                  <span className="text-white font-medium truncate block max-w-[200px]" title={sessionTimelineLogs.find(l => l.referrer)?.referrer || "None"}>
                    {sessionTimelineLogs.find(l => l.referrer)?.referrer || "None"}
                  </span>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-x-2">
                <button
                  onClick={() => setActiveTab("flow")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                    activeTab === "flow" 
                      ? "bg-sky-500 text-white shadow-sm" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Visual Flow Diagram
                </button>
                <button
                  onClick={() => setActiveTab("audit")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                    activeTab === "audit" 
                      ? "bg-sky-500 text-white shadow-sm" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Raw Chronological Log
                </button>
              </div>

              {activeTab === "flow" ? (
                <div className="space-y-4 py-2">
                  {pageNodes.map((node, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      {/* Node Card */}
                      <div className="w-full bg-[#1b253b]/80 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-5 shadow-md transition">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                              Step {idx + 1}: Page View
                            </span>
                            <h4 className="text-sm font-semibold text-sky-400 font-mono break-all">
                              {node.path}
                            </h4>
                          </div>
                          {node.durationMs !== undefined && (
                            <div className="flex items-center gap-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/50 text-[10px] text-slate-300 font-bold">
                              <Clock className="h-3 w-3 text-sky-400" />
                              {formatDuration(node.durationMs)}
                            </div>
                          )}
                        </div>

                        {/* Micro-events inside this page node */}
                        {node.events.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                            <span className="text-[9px] uppercase font-black tracking-widest text-slate-500 block">
                              Page Activities
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {node.events.map((evt, eIdx) => {
                                let badge = "bg-slate-800 text-slate-400 border border-slate-750";
                                if (evt.type === "video_watch") badge = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                                else if (evt.type === "checkout_start") badge = "bg-sky-500/10 text-sky-400 border border-sky-500/20";
                                else if (evt.type === "purchase_success") badge = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                                else if (evt.type === "login_success" || evt.type === "signup_success") badge = "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";

                                return (
                                  <span key={eIdx} className={`px-2 py-1 rounded text-[10px] font-bold ${badge} flex items-center gap-x-1`}>
                                    {evt.label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Connector SVG Arrow */}
                      {idx < pageNodes.length - 1 && (
                        <div className="flex flex-col items-center my-3 group">
                          <div className="h-6 w-0.5 bg-gradient-to-b from-sky-500 to-indigo-500 opacity-60 group-hover:opacity-100 transition" />
                          <svg className="w-4 h-4 text-indigo-400 -mt-0.5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 13l-7 7-7-7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Timeline Container */
                <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 py-2">
                  {sessionTimelineLogs.map((log) => {
                    let badgeColor = "bg-slate-800 text-slate-400 border border-slate-700/50";
                    let dotColor = "bg-slate-700 ring-slate-800";
                    let icon = "📄";
                    let details = null;

                    if (log.event_type === "session_start") {
                      badgeColor = "bg-pink-500/10 text-pink-400 border border-pink-500/20";
                      dotColor = "bg-pink-500 ring-pink-500/30";
                      icon = "🚀";
                    } else if (log.event_type === "page_view") {
                      badgeColor = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                      dotColor = "bg-blue-500 ring-blue-500/30";
                      icon = "👁️";
                    } else if (log.event_type === "page_exit") {
                      badgeColor = "bg-slate-600/10 text-slate-400 border border-slate-600/20";
                      dotColor = "bg-slate-600 ring-slate-600/30";
                      icon = "🚪";
                      details = `Spent ${formatDuration(log.duration_ms)}`;
                    } else if (log.event_type === "login_success" || log.event_type === "signup_success") {
                      badgeColor = "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
                      dotColor = "bg-indigo-500 ring-indigo-500/30";
                      icon = "🔐";
                      details = `Logged in via ${log.metadata?.method || "email"}`;
                    } else if (log.event_type === "checkout_start") {
                      badgeColor = "bg-sky-500/10 text-sky-400 border border-sky-500/20";
                      dotColor = "bg-sky-500 ring-sky-500/30";
                      icon = "🛒";
                      details = `Started checkout process`;
                    } else if (log.event_type === "purchase_success") {
                      badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                      dotColor = "bg-emerald-500 ring-emerald-500/30";
                      icon = "💰";
                      details = `Completed checkout purchase successfully`;
                    } else if (log.event_type === "video_watch") {
                      badgeColor = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                      dotColor = "bg-amber-500 ring-amber-500/30";
                      icon = "🎥";
                      details = `Watched video for ${formatDuration(log.metadata?.segmentMs)}`;
                    }

                    return (
                      <div key={log.id} className="relative group">
                        {/* Timeline Dot */}
                        <span className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${dotColor} ring-4`} />
                        
                        {/* Event Details Card */}
                        <div className="bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 p-4 rounded-xl transition">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-x-2">
                              <span className="text-sm">{icon}</span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${badgeColor}`}>
                                {log.event_type.replace("_", " ")}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <div className="mt-2 text-xs font-mono text-sky-400 break-all">{log.pathname}</div>
                          {details && (
                            <div className="mt-1 text-xs text-slate-300 font-medium">{details}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
