const NOW = Date.now();
const DAY = 86_400_000;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16_807) % 2_147_483_647;
    return (s - 1) / 2_147_483_646;
  };
}

function formatDate(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

interface DayEntry {
  date: string;
  users: number;
  activeUsers: number;
  matchesViewed: number;
  liveMatchesViewed: number;
  notificationsSent: number;
  packagesOpened: number;
  videoPlays: number;
  adImpressions: number;
  adRevenue: number;
}

export function generateDailyData(days: number): DayEntry[] {
  const rng = seededRandom(42);
  const records: DayEntry[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const ts = NOW - i * DAY;
    const baseActive = 800 + Math.floor(rng() * 400);
    records.push({
      date: formatDate(ts),
      users: 1_200 + Math.floor(rng() * 200) + i * 2,
      activeUsers: baseActive + Math.floor(i * 1.5),
      matchesViewed: 300 + Math.floor(rng() * 300),
      liveMatchesViewed: 100 + Math.floor(rng() * 150),
      notificationsSent: 5 + Math.floor(rng() * 25),
      packagesOpened: 200 + Math.floor(rng() * 200),
      videoPlays: 400 + Math.floor(rng() * 500),
      adImpressions: 2_000 + Math.floor(rng() * 3_000),
      adRevenue: Math.round((2 + rng() * 18) * 100) / 100,
    });
  }

  return records;
}

interface CompetitionEntry {
  name: string;
  views: number;
}

export function generateCompetitionData(): CompetitionEntry[] {
  return [
    { name: "Premier League", views: 12_450 },
    { name: "La Liga", views: 9_320 },
    { name: "Serie A", views: 7_180 },
    { name: "Bundesliga", views: 6_540 },
    { name: "Ligue 1", views: 5_210 },
    { name: "Champions League", views: 10_860 },
    { name: "NBA", views: 8_750 },
    { name: "MLS", views: 3_420 },
  ].sort((a, b) => b.views - a.views);
}

interface DeviceEntry {
  name: string;
  value: number;
}

export function generateDeviceData(): DeviceEntry[] {
  return [
    { name: "iPhone 15", value: 38 },
    { name: "iPhone 14", value: 27 },
    { name: "iPhone 13", value: 15 },
    { name: "iPad", value: 12 },
    { name: "iPhone SE", value: 5 },
    { name: "Other", value: 3 },
  ];
}

interface NotificationRateEntry {
  type: string;
  sent: number;
  opened: number;
}

export function generateNotificationRateData(): NotificationRateEntry[] {
  return [
    { type: "Match Start", sent: 320, opened: 278 },
    { type: "Goal", sent: 480, opened: 405 },
    { type: "Match End", sent: 290, opened: 221 },
    { type: "News", sent: 180, opened: 95 },
    { type: "Announcement", sent: 140, opened: 112 },
  ];
}

export interface AnalyticsSummary {
  totalUsers: number;
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  matchesViewed: number;
  liveMatchesViewed: number;
  notificationsSent: number;
  packagesOpened: number;
  videoPlays: number;
  adImpressions: number;
  estimatedAdRevenue: number;
}

export function computeSummary(daily: DayEntry[]): AnalyticsSummary {
  const latest = daily[daily.length - 1];
  const last30 = daily.slice(-30);
  const totalMatches = daily.reduce((s, d) => s + d.matchesViewed, 0);
  const totalLive = daily.reduce((s, d) => s + d.liveMatchesViewed, 0);
  const totalNotifs = daily.reduce((s, d) => s + d.notificationsSent, 0);
  const totalPkg = daily.reduce((s, d) => s + d.packagesOpened, 0);
  const totalVideos = daily.reduce((s, d) => s + d.videoPlays, 0);
  const totalAds = daily.reduce((s, d) => s + d.adImpressions, 0);
  const totalRev = Math.round(daily.reduce((s, d) => s + d.adRevenue, 0) * 100) / 100;

  return {
    totalUsers: latest.users,
    dailyActiveUsers: latest.activeUsers,
    monthlyActiveUsers: Math.round(
      last30.reduce((s, d) => s + d.activeUsers, 0) / 30
    ),
    matchesViewed: totalMatches,
    liveMatchesViewed: totalLive,
    notificationsSent: totalNotifs,
    packagesOpened: totalPkg,
    videoPlays: totalVideos,
    adImpressions: totalAds,
    estimatedAdRevenue: totalRev,
  };
}
