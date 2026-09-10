import { useState } from 'react';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showLabel: string; // accessible label for the reveal button when the password is hidden
  hideLabel: string; // accessible label for the reveal button when the password is shown
  required?: boolean;
};

// A password input with a show/hide toggle (the same eye icon everywhere the
// app collects a password — sign-in, sign-up, and joining as an organization —
// so anyone can double-check what they typed before submitting).
export default function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  showLabel,
  hideLabel,
  required,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <label>
      {label}
      <div className="password-field">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={showPassword ? hideLabel : showLabel}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((v) => !v)}
        >
          <EyeIcon off={showPassword} />
        </button>
      </div>
    </label>
  );
}

// A small eye icon for the reveal-password toggle. When `off` is true (the
// password is currently visible) it shows the "eye with a slash" variant. It's
// decorative — the button that wraps it carries the accessible label.
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}
