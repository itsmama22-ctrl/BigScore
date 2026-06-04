"use client";

import {
  ResponsiveContainer,
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart as RechartsBar,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from "recharts";

const colors = {
  gold: "#FFD700",
  blue: "#00D9FF",
  green: "#00FF88",
  red: "#FF3B5C",
  orange: "#FF9500",
  purple: "#A855F7",
  grid: "#2A3654",
  text: "#6B7A94",
  background: "#16181D",
};

interface ChartWrapperProps {
  children: React.ReactNode;
  height?: number;
}

function ChartWrapper({ children, height = 280 }: ChartWrapperProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

const chartTheme = {
  cartesianGrid: { stroke: colors.grid, strokeDasharray: "4 4" },
  xAxis: {
    tick: { fill: colors.text, fontSize: 11 },
    axisLine: { stroke: colors.grid },
    tickLine: false,
  },
  yAxis: {
    tick: { fill: colors.text, fontSize: 11 },
    axisLine: { stroke: colors.grid },
    tickLine: false,
  },
  tooltip: {
    contentStyle: {
      background: colors.background,
      border: `1px solid ${colors.grid}`,
      borderRadius: "8px",
      fontSize: "13px",
      color: "#FFFFFF",
    },
    labelStyle: { color: colors.text },
  },
};

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  lines: Array<{ key: string; color: string; label: string }>;
  xKey: string;
  height?: number;
}

export function LineChart({ data, lines, xKey, height }: LineChartProps) {
  return (
    <ChartWrapper height={height}>
      <RechartsLine data={data}>
        <CartesianGrid {...chartTheme.cartesianGrid} />
        <XAxis dataKey={xKey} {...chartTheme.xAxis} />
        <YAxis {...chartTheme.yAxis} />
        <Tooltip {...chartTheme.tooltip} />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: l.color }}
          />
        ))}
      </RechartsLine>
    </ChartWrapper>
  );
}

interface BarChartProps {
  data: Array<Record<string, unknown>>;
  barKey: string;
  labelKey: string;
  color?: string;
  height?: number;
}

export function BarChart({
  data,
  barKey,
  labelKey,
  color = colors.blue,
  height,
}: BarChartProps) {
  return (
    <ChartWrapper height={height}>
      <RechartsBar data={data}>
        <CartesianGrid {...chartTheme.cartesianGrid} />
        <XAxis dataKey={labelKey} {...chartTheme.xAxis} />
        <YAxis {...chartTheme.yAxis} />
        <Tooltip {...chartTheme.tooltip} />
        <Bar dataKey={barKey} fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBar>
    </ChartWrapper>
  );
}

interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
}

export function PieChart({ data, height }: PieChartProps) {
  const pieColors = [
    colors.blue,
    colors.green,
    colors.gold,
    colors.purple,
    colors.red,
    colors.orange,
  ];

  return (
    <ChartWrapper height={height}>
      <RechartsPie>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          label={(props) =>
            `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={pieColors[i % pieColors.length]}
              stroke={colors.background}
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip {...chartTheme.tooltip} />
      </RechartsPie>
    </ChartWrapper>
  );
}

interface NotificationBarChartProps {
  data: Array<{ type: string; sent: number; opened: number }>;
  height?: number;
}

export function NotificationBarChart({
  data,
  height,
}: NotificationBarChartProps) {
  return (
    <ChartWrapper height={height}>
      <RechartsBar data={data}>
        <CartesianGrid {...chartTheme.cartesianGrid} />
        <XAxis dataKey="type" {...chartTheme.xAxis} />
        <YAxis {...chartTheme.yAxis} />
        <Tooltip {...chartTheme.tooltip} />
        <Bar dataKey="sent" fill={colors.blue} radius={[4, 4, 0, 0]} name="Sent" />
        <Bar dataKey="opened" fill={colors.green} radius={[4, 4, 0, 0]} name="Opened" />
      </RechartsBar>
    </ChartWrapper>
  );
}
