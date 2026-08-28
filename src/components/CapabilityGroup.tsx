import { optionLabel } from '../lib/optionLabels';

// A bordered group of checkboxes for one option list (areas / dietary / kashrut).
// Selecting a value toggles it in the chosen set. Shared by the baker settings
// screen and the sign-up form.
export default function CapabilityGroup({
  legend,
  options,
  labels,
  selected,
  onToggle,
}: {
  legend: string;
  options: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="options-fieldset">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option} className="checkbox-option">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
          />
          {optionLabel(labels, option)}
        </label>
      ))}
    </fieldset>
  );
}
