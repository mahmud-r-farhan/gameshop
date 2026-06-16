import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { User, Mail, Phone, MapPin, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export const Profile = () => {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({ fullName: '', phone: '', division: '', district: '', address: '', postalCode: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        division: (user as any).division || '',
        district: (user as any).district || '',
        address: (user as any).address || '',
        postalCode: (user as any).postalCode || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.updateProfile(form);
      setUser(res.data.data);
      toast.success('Profile updated!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="container px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">My Profile</h1>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader><CardTitle>Account Information</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium"><User className="h-4 w-4 inline mr-1" />Full Name</label>
                <Input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium"><Phone className="h-4 w-4 inline mr-1" />Phone</label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Division</label>
                  <Input value={form.division} onChange={e => setForm({...form, division: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">District</label>
                  <Input value={form.district} onChange={e => setForm({...form, district: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium"><MapPin className="h-4 w-4 inline mr-1" />Address</label>
                <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full p-3 border rounded-lg bg-background" rows={3} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Postal Code</label>
                <Input value={form.postalCode} onChange={e => setForm({...form, postalCode: e.target.value})} />
              </div>
              <Button type="submit" disabled={loading}><Save className="h-4 w-4 mr-2" />{loading ? 'Saving...' : 'Save Changes'}</Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
