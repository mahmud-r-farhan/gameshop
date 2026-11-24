import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { authAPI } from '@/services/api';
import { apiErrorMessage } from '@/lib/errors';
import { Mail, Key, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'email' | 'otp' | 'reset';

/** Mirrors `passwordSchema` in backend/src/schemas/auth.schema.ts. */
function passwordProblem(value: string): string | null {
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 128) return 'Password must be at most 128 characters';
  if (!/[A-Za-z]/.test(value)) return 'Password must contain at least one letter';
  if (!/\d/.test(value)) return 'Password must contain at least one digit';
  return null;
}

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  // Signed by /auth/verify-otp and required by /auth/reset-password.
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetToken(null);
    try {
      await authAPI.forgotPassword(email);
      toast.success('OTP sent to your email');
      setStep('otp');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not send an OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authAPI.verifyOTP(email, otp);
      // The backend returns `resetToken`, not `token`. Dropping it made every
      // reset fail the strict `resetPasswordSchema` validation.
      const token = res.data.data?.resetToken;
      if (typeof token !== 'string' || token.length === 0) {
        setError('Verification expired. Start again.');
        setStep('email');
        return;
      }
      setResetToken(token);
      toast.success('OTP verified');
      setStep('reset');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Invalid OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (!resetToken) {
      setError('Verification expired. Start again.');
      setStep('email');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authAPI.resetPassword(email, password, resetToken);
      toast.success('Password reset. Please log in.');
      navigate('/login');
    } catch (err: unknown) {
      // Keep the entered password and the token so a retry needs no re-entry.
      setError(apiErrorMessage(err, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <h1 className="sr-only">Reset your password</h1>
            <CardTitle className="text-2xl">
              {step === 'email' ? 'Forgot Password' : step === 'otp' ? 'Verify OTP' : 'Reset Password'}
            </CardTitle>
            <CardDescription>
              {step === 'email'
                ? 'Enter your email to receive an OTP'
                : step === 'otp'
                  ? 'Enter the OTP sent to your email'
                  : 'Enter your new password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="reset-email" className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending...' : 'Send OTP'}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleOTPSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="reset-otp" className="text-sm font-medium">One-time code</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="\d{6}"
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="reset-password" className="text-sm font-medium">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      placeholder="At least 8 characters, with a letter and a number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      aria-describedby="reset-password-hint"
                      required
                    />
                  </div>
                  <p id="reset-password-hint" className="text-xs text-muted-foreground">
                    At least 8 characters, including a letter and a number.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">Back to login</Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
