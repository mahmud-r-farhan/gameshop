import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { authAPI } from '@/services/api';
import toast from 'react-hot-toast';

vi.mock('@/services/api', () => ({
  authAPI: {
    forgotPassword: vi.fn(),
    verifyOTP: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const RESET_TOKEN = 'signed-reset-token-from-verify-otp';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function reachResetStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/email/i), 'buyer@example.com');
  await user.click(screen.getByRole('button', { name: /send otp/i }));
  await user.type(await screen.findByLabelText(/one-time code/i), '123456');
  await user.click(screen.getByRole('button', { name: /verify otp/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authAPI.forgotPassword).mockResolvedValue({ data: { success: true } } as never);
  vi.mocked(authAPI.verifyOTP).mockResolvedValue({
    data: { success: true, data: { resetToken: RESET_TOKEN, expiresInSeconds: 900 } },
  } as never);
  vi.mocked(authAPI.resetPassword).mockResolvedValue({ data: { success: true } } as never);
});

describe('ForgotPassword', () => {
  // Regression: the reset token issued by /auth/verify-otp was discarded, so
  // /auth/reset-password always failed its strict Zod validation. Queries here
  // deliberately work against the old markup too, so the assertion that fails
  // on the old code is the missing token, not a missing label.
  it('forwards the resetToken issued by the OTP step', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox'), 'buyer@example.com');
    await user.click(screen.getByRole('button', { name: /send otp/i }));
    await user.type(await screen.findByRole('textbox'), '123456');
    await user.click(screen.getByRole('button', { name: /verify otp/i }));

    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).not.toBeNull();
    await user.type(passwordInput as HTMLInputElement, 'SecurePass1');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(authAPI.resetPassword).toHaveBeenCalledWith('buyer@example.com', 'SecurePass1', RESET_TOKEN);
  });

  it('sends the resetToken from the OTP step with the new password', async () => {
    const user = userEvent.setup();
    renderPage();

    await reachResetStep(user);
    await user.type(await screen.findByLabelText(/new password/i), 'SecurePass1');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(authAPI.resetPassword).toHaveBeenCalledWith('buyer@example.com', 'SecurePass1', RESET_TOKEN);
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Password reset. Please log in.');
  });

  it('rejects a password the backend schema would reject, without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await reachResetStep(user);
    await user.type(await screen.findByLabelText(/new password/i), 'abcdefgh');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('at least one digit');
    expect(authAPI.resetPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/new password/i)).toHaveValue('abcdefgh');
  });

  it('starts over when the OTP response has no reset token', async () => {
    vi.mocked(authAPI.verifyOTP).mockResolvedValue({ data: { data: {} } } as never);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'buyer@example.com');
    await user.click(screen.getByRole('button', { name: /send otp/i }));
    await user.type(await screen.findByLabelText(/one-time code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify otp/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Verification expired');
    expect(screen.getByRole('button', { name: /send otp/i })).toBeInTheDocument();
  });

  it('shows the API error and keeps the entered password when reset fails', async () => {
    vi.mocked(authAPI.resetPassword).mockRejectedValue({
      response: { data: { error: 'Reset token expired' } },
    });
    const user = userEvent.setup();
    renderPage();

    await reachResetStep(user);
    await user.type(await screen.findByLabelText(/new password/i), 'SecurePass1');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reset token expired');
    expect(screen.getByLabelText(/new password/i)).toHaveValue('SecurePass1');
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });
});
