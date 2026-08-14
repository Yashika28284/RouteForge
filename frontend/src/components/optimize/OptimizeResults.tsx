import type { OptimizationResponse } from '../../types';

interface OptimizeResultsProps {
  result: OptimizationResponse;
}

export default function OptimizeResults({ result }: OptimizeResultsProps) {
  const { baseline, improvement, performance, totalDistanceKm, totalDurationMinutes } = result;
  const headlinePercent = Math.max(improvement.distancePercent, improvement.timePercent);

  return (
    <div className="results-panel card">
      <div className="improvement-banner">
        <div className="value">{headlinePercent}% faster</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          than your {baseline.strategy === 'NEAREST_NEIGHBOR' ? 'nearest-neighbor' : 'original-order'} baseline
        </div>
      </div>

      <div>
        <div className="section-title">Optimized vs. baseline</div>
        <div className="compare-grid">
          <div className="compare-col">
            <div className="label">Baseline</div>
            <div className="compare-stat">
              {baseline.distanceKm.toFixed(1)}
              <span className="compare-stat-unit">km</span>
            </div>
            <div className="compare-stat" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {Math.round(baseline.durationMinutes)}
              <span className="compare-stat-unit">min</span>
            </div>
          </div>
          <div className="compare-col optimized">
            <div className="label">Optimized</div>
            <div className="compare-stat">
              {totalDistanceKm.toFixed(1)}
              <span className="compare-stat-unit">km</span>
            </div>
            <div className="compare-stat" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {Math.round(totalDurationMinutes)}
              <span className="compare-stat-unit">min</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Improvement</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div className="label">Distance</div>
            <div className="mono" style={{ fontSize: 15, color: 'var(--accent-2)' }}>
              −{improvement.distancePercent}%
            </div>
          </div>
          <div>
            <div className="label">Time</div>
            <div className="mono" style={{ fontSize: 15, color: 'var(--accent-2)' }}>
              −{improvement.timePercent}%
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Performance</div>
        <div className="perf-readout">
          <span>
            matrix <b>{performance.matrixTimeMs}ms</b>
          </span>
          <span>
            solver <b>{performance.solverTimeMs}ms</b>
          </span>
          <span>
            total <b>{performance.totalTimeMs}ms</b>
          </span>
          <span>
            cache <b>{performance.cacheHit ? 'hit' : 'miss'}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
