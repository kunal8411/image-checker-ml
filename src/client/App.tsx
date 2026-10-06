import { useEffect, useState } from 'react';

import { analyzeUpload, submitEvaluation } from './api';
import { GridSelector } from './components/GridSelector';
import { ImagePreview } from './components/ImagePreview';
import { ImageUploader } from './components/ImageUploader';
import { LatencyPanel } from './components/LatencyPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { RegionCard } from './components/RegionCard';
import { changeReview, confirmReview, createReview, type RegionReview } from './reviewState';
import { CATEGORIES, type AnalyzeResponse, type EvaluationReport } from '../types/index';

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [grid, setGrid] = useState<3 | 4>(3);
  const [target, setTarget] = useState<string>(CATEGORIES[0]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [reviews, setReviews] = useState<Record<string, RegionReview>>({});
  const [metrics, setMetrics] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const items = Object.values(reviews).flatMap((review) =>
      review.humanPrediction
        ? [{ actual: review.humanPrediction, predicted: review.modelPrediction }]
        : [],
    );
    if (items.length === 0) {
      setMetrics(null);
      setMetricsError(null);
      return;
    }

    let cancelled = false;
    void submitEvaluation(items)
      .then((report) => {
        if (!cancelled) {
          setMetrics(report);
          setMetricsError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setMetricsError(reason instanceof Error ? reason.message : 'Evaluation failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reviews]);

  async function onAnalyze(): Promise<void> {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const analysis = await analyzeUpload(file, grid, grid);
      const nextReviews: Record<string, RegionReview> = {};
      for (const region of analysis.regions) {
        nextReviews[region.id] = createReview(region.prediction.predictedClass);
      }
      setResult(analysis);
      setReviews(nextReviews);
    } catch (reason: unknown) {
      setResult(null);
      setReviews({});
      setError(reason instanceof Error ? reason.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  }

  const reviewedCount = Object.values(reviews).filter((review) => review.humanPrediction).length;

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Local benchmark</p>
        <h1 data-testid="app-title">Computer Vision Image Classification Lab</h1>
        <p>
          Upload a local image, divide it into a grid, and compare batch classification results. Predictions stay in
          this analysis. Nothing is submitted anywhere else.
        </p>
      </header>

      <section className="controls">
        <h2>Upload Image</h2>
        <ImageUploader fileName={file?.name ?? null} onSelect={setFile} />
        <GridSelector value={grid} onChange={setGrid} />
        <label className="target">
          Classification Target
          <select data-testid="target-class" value={target} onChange={(event) => setTarget(event.target.value)}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button primary"
          data-testid="analyze-button"
          disabled={!file || busy}
          onClick={() => {
            void onAnalyze();
          }}
        >
          {busy ? 'Analyzing…' : 'Analyze Image'}
        </button>
        {error ? (
          <p className="error" data-testid="error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <ImagePreview src={previewUrl} quality={result?.quality ?? null} />

      {result ? (
        <>
          <LatencyPanel latency={result.latency} />
          <section
            className="region-grid"
            data-testid="region-grid"
            style={{ ['--cols' as string]: String(result.columns) }}
          >
            {result.regions.map((region) => {
              const review = reviews[region.id] ?? createReview(region.prediction.predictedClass);
              return (
                <RegionCard
                  key={region.id}
                  region={region}
                  review={review}
                  matchesTarget={region.prediction.predictedClass === target}
                  onConfirm={() => {
                    setReviews((current) => ({
                      ...current,
                      [region.id]: confirmReview(review),
                    }));
                  }}
                  onChange={(label) => {
                    setReviews((current) => ({
                      ...current,
                      [region.id]: changeReview(review, label),
                    }));
                  }}
                />
              );
            })}
          </section>
          <MetricsPanel report={metrics} reviewedCount={reviewedCount} error={metricsError} />
        </>
      ) : null}
    </main>
  );
}
