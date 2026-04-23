import React from 'react';

export default function Metric({ label, value, sub }) {
  return (
    <div style={{ padding: '20px 24px', borderRight: '1px solid var(--rule)' }}>
      <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{sub}</div>
    </div>
  );
}
