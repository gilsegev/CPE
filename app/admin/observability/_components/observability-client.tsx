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

export const ObservabilityClient = ({ initialLogs }: ObservabilityClientProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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
        pageTimeMap[cleanPath].totalMs += log.duration_ms;
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

  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null) return "-";
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const min = Math.floor(sec / 60);
    const remSec = Math.round(sec % 60);
    return `${min}m ${remSec}s`;
  };

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
                      {conv.sessionId.substring(0, 8)}...{conv.sessionId.substring(conv.sessionId.length - 6)}
                    </td>
                    <td className="p-4 font-medium text-white">{conv.email}</td>
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
                        {log.session_id.substring(0, 8)}...
                      </td>
                      <td className="p-4 text-xs text-slate-300 truncate max-w-[180px]" title={log.user_id?.email || log.metadata?.email || "Anonymous"}>
                        {log.user_id?.email || log.metadata?.email || "-"}
                      </td>
                      <td className="p-4 text-xs">{log.ip_address || "Unknown"}</td>
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
    </div>
  );
};
