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
import type { ClassCumulativeScorePoint } from "@judge/shared";
import { i18n } from "@/i18n";

echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface ScoreChartProps {
  data: ClassCumulativeScorePoint[];
  className?: string;
}

export function ScoreChart({ data, className }: ScoreChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    instanceRef.current = chart;

    const formatPointTime = (value: string) =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));

    const option: echarts.EChartsCoreOption = {
      title: {
        text: i18n.t("components.scoreChart.title"),
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
          return i18n.t("components.scoreChart.tooltip", {
            time: formatPointTime(item.axisValueLabel),
            value: item.value,
            assignmentTitle: item.data.assignmentTitle,
          });
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
        axisLabel: {
          rotate: 30,
          formatter: (value: string) => formatPointTime(value),
        },
      },
      yAxis: {
        type: "value",
        min: 0,
      },
      series: [
        {
          type: "line",
          data: data.map((d) => ({
            value: d.totalScore,
            assignmentTitle: d.assignmentTitle,
          })),
          smooth: true,
          lineStyle: { width: 3 },
          itemStyle: { color: "#3b82f6" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(59, 130, 246, 0.32)" },
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
