import { describe, it, expect } from 'vitest';
import { emailProblem } from './authErrors';

describe('emailProblem', () => {
  it('spots an invalid email address by code or message', () => {
    expect(emailProblem({ code: 'email_address_invalid', message: 'x' })).toBe('invalid');
    expect(emailProblem(new Error('Email address "a@b" is invalid'))).toBe('invalid');
  });
  it('spots the email sending limit', () => {
    expect(emailProblem({ code: 'over_email_send_rate_limit', message: 'x' })).toBe('tooMany');
    expect(emailProblem(new Error('email rate limit exceeded'))).toBe('tooMany');
  });
  it('leaves everything else alone', () => {
    expect(emailProblem(new Error('Invalid login credentials'))).toBeNull();
    expect(emailProblem({ message: 'Email not confirmed' })).toBeNull();
    expect(emailProblem(null)).toBeNull();
    expect(emailProblem('boom')).toBeNull();
  });
});
