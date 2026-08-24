import type { AnalyticsPeriodInput } from '../../api/analytics';

interface AnalyticsPeriodPickerProps {
  value: AnalyticsPeriodInput;
  onChange: (value: AnalyticsPeriodInput) => void;
}

export function AnalyticsPeriodPicker({ value, onChange }: AnalyticsPeriodPickerProps) {
  return (
    <fieldset className="flex flex-wrap items-end gap-2">
      <legend className="sr-only">Analytics date range</legend>
      <label className="grid gap-1 text-xs font-medium text-navy/60">
        From
        <input
          type="date"
          value={value.from ?? ''}
          max={value.to}
          onChange={(event) => onChange({ ...value, from: event.target.value || undefined })}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-navy/60">
        To
        <input
          type="date"
          value={value.to ?? ''}
          min={value.from}
          onChange={(event) => onChange({ ...value, to: event.target.value || undefined })}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy"
        />
      </label>
      {(value.from || value.to) && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="rounded-full px-3 py-2 text-sm font-semibold text-navy/60 hover:bg-cream hover:text-navy"
        >
          Reset
        </button>
      )}
    </fieldset>
  );
}
