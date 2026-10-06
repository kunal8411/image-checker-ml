import type { LatencyReport } from '../../types/index';
import { formatMs } from '../format';

interface LatencyPanelProps {
  latency: LatencyReport;
}

export function LatencyPanel({ latency }: LatencyPanelProps) {
  return (
    <section
      className="panel"
      data-testid="latency-panel"
      data-preprocessing-ms={latency.preprocessingMs}
      data-inference-ms={latency.inferenceMs}
      data-total-ms={latency.totalMs}
      data-average-ms={latency.averageRegionLatencyMs}
    >
      <h2>Latency</h2>
      <dl>
        <div>
          <dt>Preprocessing</dt>
          <dd>{formatMs(latency.preprocessingMs)}</dd>
        </div>
        <div>
          <dt>Model inference</dt>
          <dd>{formatMs(latency.inferenceMs)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatMs(latency.totalMs)}</dd>
        </div>
        <div>
          <dt>Average region latency</dt>
          <dd>{formatMs(latency.averageRegionLatencyMs)}</dd>
        </div>
      </dl>
      <p className="panel-note">
        {latency.batched
          ? `${String(latency.regionCount)} regions were scored in one batch. Average latency is the inference time divided by the region count.`
          : 'The model executed the regions separately after a fused batch was unavailable.'}
      </p>
    </section>
  );
}
