import type { OptimizationObjective } from '../../types';

interface ObjectiveToggleProps {
  value: OptimizationObjective;
  onChange: (value: OptimizationObjective) => void;
}

export default function ObjectiveToggle({ value, onChange }: ObjectiveToggleProps) {
  return (
    <div className="objective-toggle">
      <button type="button" className={value === 'TIME' ? 'active' : ''} onClick={() => onChange('TIME')}>
        Fastest
      </button>
      <button type="button" className={value === 'DISTANCE' ? 'active' : ''} onClick={() => onChange('DISTANCE')}>
        Shortest
      </button>
    </div>
  );
}
