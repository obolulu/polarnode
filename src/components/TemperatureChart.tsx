// src/components/TemperatureChart.tsx
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export type TempPoint = { t: number; temp: number };

interface TemperatureChartProps {
  points: TempPoint[];
}

export function TemperatureChart({ points }: TemperatureChartProps) {
  if (points.length === 0) {
    return <p>No temperature data yet.</p>;
  }

  const labels = points.map((p) =>
    new Date(p.t).toLocaleTimeString(undefined, {
      minute: '2-digit',
      second: '2-digit',
    })
  );

  const temps = points.map((p) => p.temp);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);

  const data = {
    labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: temps,
        borderColor: '#ff4500',
        backgroundColor: 'rgba(255, 69, 0, 0.2)',
        tension: 0.25,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    animation: { duration: 0 },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        intersect: false,
        mode: 'index' as const,
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 8,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Temperature (°C)',
        },
        suggestedMin: minTemp === maxTemp ? minTemp - 1 : undefined,
        suggestedMax: minTemp === maxTemp ? maxTemp + 1 : undefined,
      },
    },
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <Line data={data} options={options} />
    </div>
  );
}

