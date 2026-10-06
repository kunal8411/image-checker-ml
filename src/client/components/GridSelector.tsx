interface GridSelectorProps {
  value: 3 | 4;
  onChange: (value: 3 | 4) => void;
}

export function GridSelector({ value, onChange }: GridSelectorProps) {
  return (
    <fieldset className="choice-row">
      <legend>Grid</legend>
      {([3, 4] as const).map((size) => (
        <label key={size} className={value === size ? 'choice selected' : 'choice'}>
          <input
            type="radio"
            name="grid"
            value={size}
            data-testid={`grid-${size}`}
            checked={value === size}
            onChange={() => onChange(size)}
          />
          {size} × {size}
        </label>
      ))}
    </fieldset>
  );
}
