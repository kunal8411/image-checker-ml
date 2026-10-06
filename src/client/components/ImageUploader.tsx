interface ImageUploaderProps {
  fileName: string | null;
  onSelect: (file: File | null) => void;
}

export function ImageUploader({ fileName, onSelect }: ImageUploaderProps) {
  return (
    <div className="uploader">
      <label className="button secondary">
        Choose Image
        <input
          className="file-input"
          data-testid="file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onSelect(file);
          }}
        />
      </label>
      <p className="file-name">{fileName ?? 'PNG, JPEG, or WebP up to 8 MB'}</p>
    </div>
  );
}
