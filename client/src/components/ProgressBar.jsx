export default function ProgressBar({ hoursUsed, totalAllowed }) {
  if (totalAllowed === 0) {
    return (
      <div className="progress-placeholder">
        Please select your hour allocation below
      </div>
    );
  }

  const pct = Math.min((hoursUsed / totalAllowed) * 100, 100);
  
  // Determine fill color based on percentage
  const getBarColor = () => {
    if (pct >= 90) return '#dc2626'; // Red
    if (pct >= 70) return '#d97706'; // Amber
    return '#16a34a'; // Green
  };

  const getBarColorClass = () => {
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'amber';
    return 'green';
  };

  // Calculate milestone positions (at 25% and 50% of total allowed hours)
  const marker25Pct = (25 / totalAllowed) * 100;
  const marker50Pct = (50 / totalAllowed) * 100;

  // Determine if percentage text should be inside or outside the bar
  const showTextInside = pct >= 15;

  return (
    <div className="progress-bar-wrapper">
      {/* Progress header */}
      <div className="progress-header">
        <span className="progress-label">Progress</span>
        <span className="progress-stats">{hoursUsed.toFixed(1)}h / {totalAllowed}h</span>
      </div>

      {/* Progress bar container */}
      <div className="progress-bar-container">
        {/* Milestone markers */}
        {marker25Pct <= 100 && (
          <div 
            className="milestone-marker" 
            style={{ left: `${marker25Pct}%` }}
            aria-label={`25% milestone at 25 hours`}
          >
            <div className="milestone-line"></div>
            <div className="milestone-label">25h</div>
          </div>
        )}
        
        {marker50Pct <= 100 && (
          <div 
            className="milestone-marker" 
            style={{ left: `${marker50Pct}%` }}
            aria-label={`50% milestone at 50 hours`}
          >
            <div className="milestone-line"></div>
            <div className="milestone-label">50h</div>
          </div>
        )}

        {/* Progress bar track */}
        <div className="progress-bar-track">
          {/* Progress bar fill */}
          <div
            className={`progress-bar-fill progress-fill-${getBarColorClass()}`}
            style={{ 
              width: `${Math.max(pct, 2)}%`,
              backgroundColor: getBarColor(),
            }}
          >
            {showTextInside && (
              <span className="progress-text-inside">{pct.toFixed(0)}%</span>
            )}
          </div>
        </div>

        {/* Percentage text outside (if too narrow) */}
        {!showTextInside && (
          <span className="progress-text-outside">{pct.toFixed(0)}%</span>
        )}
      </div>

      {/* Color legend */}
      <div className="progress-legend">
        <div className="legend-item">
          <div className="legend-dot legend-dot-green"></div>
          <span>On track (0–70%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot legend-dot-amber"></div>
          <span>Nearing limit (70–90%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot legend-dot-red"></div>
          <span>At limit (90%+)</span>
        </div>
      </div>
    </div>
  );
}
