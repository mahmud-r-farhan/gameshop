import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { authAPI } from '@/services/api';
import { Mail, Key, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export const ForgotPassword = () => {
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      toast.success('OTP sent to your email');
      setStep('otp');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.verifyOTP(email, otp);
      toast.success('OTP verified');
      setStep('reset');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.resetPassword(email, password);
      toast.success('Password reset successful!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {step === 'email' ? 'Forgot Password' : step === 'otp' ? 'Verify OTP' : 'Reset Password'}
            </CardTitle>
            <CardDescription>
              {step === 'email' ? "Enter your email to receive an OTP" : step === 'otp' ? 'Enter the OTP sent to your email' : 'Enter your new password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending...' : 'Send OTP'}</Button>
              </form>
            )}
            {step === 'otp' && (
              <form onSubmit={handleOTPSubmit} className="space-y-4">
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)} className="pl-10" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Verifying...' : 'Verify OTP'}</Button>
              </form>
            )}
            {step === 'reset' && (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="New password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</Button>
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
