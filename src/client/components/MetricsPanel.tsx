import type { EvaluationReport } from '../../types/index';
import { formatScore } from '../format';

interface MetricsPanelProps {
  report: EvaluationReport | null;
  reviewedCount: number;
  error: string | null;
}

export function MetricsPanel({ report, reviewedCount, error }: MetricsPanelProps) {
  return (
    <section className="panel" data-testid="metrics-panel">
      <h2>Evaluation</h2>
      {!report ? (
        <p className="panel-note">
          Precision and recall need ground truth. Confirm or change a class to treat your label as the actual class.
          Reviewed regions: {reviewedCount}.
        </p>
      ) : (
        <>
          <dl>
            <div>
              <dt>Macro precision</dt>
              <dd>{formatScore(report.macroPrecision)}</dd>
            </div>
            <div>
              <dt>Macro recall</dt>
              <dd>{formatScore(report.macroRecall)}</dd>
            </div>
            <div>
              <dt>Macro F1</dt>
              <dd>{formatScore(report.macroF1)}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{formatScore(report.accuracy)}</dd>
            </div>
          </dl>
          <p className="panel-note">
            Accuracy alone hides failures on rare classes. Macro F1 weights each class equally. These scores compare
            the model label with the human label.
          </p>
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1</th>
                <th>Support</th>
              </tr>
            </thead>
            <tbody>
              {report.perClass.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{formatScore(row.precision)}</td>
                  <td>{formatScore(row.recall)}</td>
                  <td>{formatScore(row.f1)}</td>
                  <td>{row.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="matrix-wrap">
            <table className="matrix" data-testid="confusion-matrix">
              <caption>Confusion matrix, rows are human labels and columns are model labels</caption>
              <thead>
                <tr>
                  <th />
                  {report.confusionMatrix.labels.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.confusionMatrix.values.map((row, rowIndex) => (
                  <tr key={report.confusionMatrix.labels[rowIndex] ?? rowIndex}>
                    <th>{report.confusionMatrix.labels[rowIndex]}</th>
                    {row.map((value, columnIndex) => (
                      <td key={`${String(rowIndex)}-${String(columnIndex)}`}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
