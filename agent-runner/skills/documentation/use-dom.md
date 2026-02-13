// components/WebChart.tsx
"use dom";export default function WebChart({
data,
}: {
data: number[];
dom: import("expo/dom").DOMProps;
}) {
return (
&#x3C;div style={{ padding: 20 }}>
&#x3C;h2>Chart Data&#x3C;/h2>
&#x3C;ul>
{data.map((value, i) => (
&#x3C;li key={i}>{value}&#x3C;/li>
))}
&#x3C;/ul>
&#x3C;/div>
);
}