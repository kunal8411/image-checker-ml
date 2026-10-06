import type { ImageQualityReport } from '../../types/index';

interface ImagePreviewProps {
  src: string | null;
  quality: ImageQualityReport | null;
}

export function ImagePreview({ src, quality }: ImagePreviewProps) {
  if (!src) {
    return <p className="empty-preview">The uploaded image will appear here, then each grid region is classified separately.</p>;
  }

  return (
    <figure className="preview">
      <img src={src} alt="Uploaded source" />
      {quality?.isLowQuality ? (
        <figcaption>
          Low image quality (score {quality.score.toFixed(2)}). Preprocessing can resize and adjust contrast, but it
          cannot reconstruct detail that the original image does not contain.
        </figcaption>
      ) : null}
    </figure>
  );
}
