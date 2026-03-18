import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ScoreHistoryPoint } from "@judge/shared";

echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface ScoreChartProps {
  data: ScoreHistoryPoint[];
  className?: string;
}

export function ScoreChart({ data, className }: ScoreChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    instanceRef.current = chart;

    const option: echarts.EChartsCoreOption = {
      title: {
        text: "分數變化",
        left: "center",
        textStyle: { fontSize: 14, fontWeight: 500 },
      },
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const list = params as Array<{
            axisValueLabel: string;
            value: number;
            data: { assignmentTitle: string };
          }>;
          const item = list[0];
          if (!item) return "";
          return `${item.axisValueLabel}<br/>分數: ${item.value}<br/>作業: ${item.data.assignmentTitle}`;
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        axisLabel: { rotate: 30 },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
      },
      series: [
        {
          type: "line",
          data: data.map((d) => ({
            value: d.score,
            assignmentTitle: d.assignmentTitle,
          })),
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: "#3b82f6" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
              { offset: 1, color: "rgba(59, 130, 246, 0.05)" },
            ]),
          },
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data]);

  return <div ref={chartRef} className={className} style={{ height: 300 }} />;
}
