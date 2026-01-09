import React from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, AreaChart, Area
} from 'recharts';

interface GraphChartProps {
    data: any[];
    chartType: string;
    xAxis: string;
    yAxis: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#facc15', '#10b981', '#3b82f6'];

const GraphChart: React.FC<GraphChartProps> = ({ data, chartType, xAxis, yAxis }) => {
    
    if (!data || data.length === 0) {
        return <div className="graph-placeholder">No data to display</div>;
    }

    const CommonProps = {
        data: data,
        margin: { top: 20, right: 30, left: 20, bottom: 50 }
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
                        <Bar dataKey={yAxis} fill="#6366f1" radius={[4, 4, 0, 0]} />
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
                         <Line type="monotone" dataKey={yAxis} stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} activeDot={{ r: 6 }} legendType="circle" />
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
                        <Area type="monotone" dataKey={yAxis} stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    </AreaChart>
                </ResponsiveContainer>
            );
        case 'scatter':
             return (
                 <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                         <XAxis {...XAxisProps} type="category" textAnchor="end" />
                         <YAxis {...YAxisProps} type="number" />
                         <Tooltip 
                             cursor={{ strokeDasharray: '3 3' }} 
                             contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} 
                             labelFormatter={(label) => typeof label === 'string' ? label.split('__')[0] : label}
                         />
                        <Legend />
                        <Scatter name={yAxis} data={data} fill="#ec4899" />
                    </ScatterChart>
                </ResponsiveContainer>
            );
         case 'pie':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={150}
                            fill="#8884d8"
                            dataKey={yAxis} // Value
                            nameKey={xAxis} // Label
                        >
                            {data.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} />
                        <Legend />
                    </RePieChart>
                </ResponsiveContainer>
            );
        default:
            return null;
    }
};

export default GraphChart;
