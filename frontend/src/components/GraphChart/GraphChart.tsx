import React from 'react';
import { 
  BarChart, Bar, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';

interface GraphChartProps {
    data: any[];
    chartType: string;
    xAxis: string;
    yAxis: string;
    enableAnimation?: boolean;
}


const GraphChart: React.FC<GraphChartProps> = ({ data, chartType, yAxis, enableAnimation = true }) => {
    
    if (!data || data.length === 0) {
        return <div className="graph-placeholder">No data to display</div>;
    }

    const CommonProps = {
        data: data,
        margin: { top: 20, right: 30, left: 20, bottom: 50 },
    };

    const XAxisProps = {
         dataKey: "_uniqueKey",
         tickFormatter: (val: string) => val.split('__')[0],
         angle: -45, 
         height: 120,
         stroke: "#9ca3af" // text-gray-400
    };

    const YAxisProps = {
        stroke: "#9ca3af",
    };

    switch (chartType) {
        case 'bar':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis {...XAxisProps} textAnchor="end" />
                        <YAxis {...YAxisProps} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} 
                            labelFormatter={(label) => label.split('__')[0]}
                        />
                        <Legend />
                        <Bar dataKey={yAxis} fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={enableAnimation} />
                    </BarChart>
                </ResponsiveContainer>
            );
        case 'line':
            return (
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                         <XAxis {...XAxisProps} textAnchor="end" />
                        <YAxis {...YAxisProps} />
                         <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} />
                        <Legend />
                         <Line type="monotone" dataKey={yAxis} stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} activeDot={{ r: 6 }} legendType="circle" isAnimationActive={enableAnimation} />
                    </LineChart>
                </ResponsiveContainer>
            );
         case 'area':
            return (
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                         <XAxis {...XAxisProps} textAnchor="end" />
                        <YAxis {...YAxisProps} />
                         <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} />
                        <Legend />
                        <Area type="monotone" dataKey={yAxis} stroke="#10b981" fill="#10b981" fillOpacity={0.3} isAnimationActive={enableAnimation} />
                    </AreaChart>
                </ResponsiveContainer>
            );
        default:
            return null;
    }
};

export default GraphChart;
