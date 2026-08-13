export interface ChartDataPoint {
    label: string;
    value: number;
    secondary?: number;
  }
  
  export interface TrendSeries {
    month: string;
    count: number;
    value: number;
    avg_value?: number;
  }
  
  export interface RegionData {
    region: string;
    count: number;
    value: number;
  }
  
  export interface SectorBreakdown {
    sector: string;
    count: number;
    total_value: number;
    percentage?: number;
  }