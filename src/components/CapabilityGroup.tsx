import { optionLabel } from '../lib/optionLabels';
import { OTHER_OPTION, hasOtherSelected, otherFreeText } from '../lib/options';

// A bordered group of checkboxes for one option list (areas / dietary / kashrut).
// Selecting a value toggles it in the chosen set. Shared by the baker settings
// screen, the sign-up form, and the cake request form. The "Other" option (only
// present in the dietary list) gets a free-text box once checked, so someone
// whose need isn't listed can still say what it is.
export default function CapabilityGroup({
  legend,
  options,
  labels,
  selected,
  onToggle,
  onOtherTextChange,
  otherPlaceholder,
}: {
  legend: string;
  options: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onToggle: (value: string) => void;
  onOtherTextChange?: (text: string) => void; // required to show the free-text box at all
  otherPlaceholder?: string;
}) {
  return (
    <fieldset className="options-fieldset">
      <legend>{legend}</legend>
      {options.map((option) => {
        const isOther = option === OTHER_OPTION;
        const checked = isOther ? hasOtherSelected(selected) : selected.includes(option);
        return (
          <div key={option} className="checkbox-option-row">
            <label className="checkbox-option">
              <input type="checkbox" checked={checked} onChange={() => onToggle(option)} />
              {optionLabel(labels, option)}
            </label>
            {isOther && checked && onOtherTextChange && (
              <input
                type="text"
                className="other-free-text"
                value={otherFreeText(selected)}
                placeholder={otherPlaceholder}
                onChange={(e) => onOtherTextChange(e.target.value)}
              />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
