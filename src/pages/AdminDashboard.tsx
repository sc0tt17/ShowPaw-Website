import { useState, useEffect } from 'react';
import { useAuth, db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, ArrowLeft, Trash2, Users, Store, ShieldAlert, Activity, Building2, UserCog, Plus, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Business {
  id: string;
  businessName: string;
  category: string;
  address: string;
  contactNumber: string;
  description: string;
  isApproved: boolean;
}

interface AppUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
  createdAt: any;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<Partial<Business> | null>(null);

  const fetchBusinesses = async () => {
    try {
      const q = query(collection(db, 'businesses'));
      const snap = await getDocs(q);
      const bList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
      setBusinesses(bList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'businesses');
    }
  };

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const uList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(uList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  };

  useEffect(() => {
    if (userRole === 'admin') {
      Promise.all([fetchBusinesses(), fetchUsers()]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [userRole]);

  const handleApproval = async (businessId: string, approve: boolean) => {
    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        isApproved: approve
      });
      setBusinesses(businesses.map(b => b.id === businessId ? { ...b, isApproved: approve } : b));
      toast.success(approve ? "Business approved!" : "Business rejected.");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'businesses');
      toast.error("Failed to update status");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("User role updated successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      toast.error("Failed to update user role");
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      setUsers(users.filter(u => u.id !== userToDelete.id));
      toast.success("User deleted successfully");
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
      toast.error("Failed to delete user");
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness) return;
    
    try {
      if (editingBusiness.id) {
        // Update
        await updateDoc(doc(db, 'businesses', editingBusiness.id), {
          businessName: editingBusiness.businessName,
          category: editingBusiness.category,
          address: editingBusiness.address,
          contactNumber: editingBusiness.contactNumber || '',
          description: editingBusiness.description,
        });
        setBusinesses(businesses.map(b => b.id === editingBusiness.id ? { ...b, ...editingBusiness } as Business : b));
        toast.success("Business updated successfully");
      } else {
        // Create
        const docRef = await addDoc(collection(db, 'businesses'), {
          ...editingBusiness,
          isApproved: true,
          createdAt: serverTimestamp(),
        });
        setBusinesses([...businesses, { id: docRef.id, ...editingBusiness, isApproved: true } as Business]);
        toast.success("Business added successfully");
      }
      setEditingBusiness(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'businesses');
      toast.error("Failed to save business");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex flex-col items-center justify-center mb-6 text-rose-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 mb-8 max-w-md">You need an administrator account to access the control center.</p>
        
        <div className="bg-white border rounded-2xl p-6 shadow-sm max-w-md w-full mb-8">
          <h3 className="font-medium text-slate-900 mb-2">Testing Admin Features?</h3>
          <p className="text-slate-600 text-sm mb-4">
            Sign out of your current account and select "Sign in as Admin" on the authentication page.
          </p>
          <Button onClick={() => navigate(-1)} className="w-full rounded-xl">
             <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const pendingBusinesses = businesses.filter(b => !b.isApproved);
  const approvedBusinesses = businesses.filter(b => b.isApproved);
  const adminUsers = users.filter(u => u.role === 'admin');

  return (
    <div className="min-h-screen bg-slate-950 pb-12 pt-6">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-full shadow-sm bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Admin Control Center</h1>
            <p className="text-slate-400 mt-1">Manage businesses, users, and platform settings.</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <Card className="bg-slate-900 shadow-sm border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Total Users</CardTitle>
              <Users className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{users.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 shadow-sm border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Total Businesses</CardTitle>
              <Building2 className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{businesses.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 shadow-sm border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Pending Approvals</CardTitle>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{pendingBusinesses.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 shadow-sm border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Admin Accounts</CardTitle>
              <UserCog className="w-4 h-4 text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{adminUsers.length}</div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="businesses" className="w-full">
          <TabsList className="mb-8 p-1 bg-slate-900 border-slate-800 rounded-xl max-w-sm grid grid-cols-2">
            <TabsTrigger value="businesses" className="rounded-lg py-2.5 text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm">
              <Store className="w-4 h-4 mr-2" />
              Businesses
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg py-2.5 text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="businesses" className="space-y-10">
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">Needs Approval</h2>
                  <p className="text-slate-400 text-sm mt-1">Review and approve new business listings.</p>
                </div>
                {pendingBusinesses.length > 0 && <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">{pendingBusinesses.length} Pending</Badge>}
              </div>

              {pendingBusinesses.length === 0 ? (
                <div className="bg-slate-900 border-2 border-dashed border-slate-800 rounded-2xl p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-white">All caught up!</h3>
                  <p className="text-slate-400 mt-1">There are no pending business approvals at the moment.</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingBusinesses.map(b => (
                  <Card key={b.id} className="overflow-hidden border-amber-900/30 bg-amber-950/10 shadow-sm hover:border-amber-700/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 uppercase text-[10px] tracking-wider border-0">{b.category.replace('_', ' ')}</Badge>
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-white">{b.businessName}</h3>
                      <p className="text-sm text-slate-400 mb-6 line-clamp-3">{b.description}</p>
                      
                      <div className="flex gap-3">
                        <Button onClick={() => handleApproval(b.id, true)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border-0">
                          <CheckCircle className="w-4 h-4 mr-2" /> Approve
                        </Button>
                        <Button onClick={() => handleApproval(b.id, false)} variant="outline" className="flex-1 border-rose-900/50 text-rose-400 bg-rose-950/20 hover:bg-rose-900/40 hover:text-rose-300">
                          <XCircle className="w-4 h-4 mr-2" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Approved Directory</h2>
                <p className="text-slate-400 text-sm mt-1">Currently active businesses on the platform.</p>
              </div>
              <Button onClick={() => setEditingBusiness({})} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-sm rounded-xl">
                <Plus className="w-4 h-4 mr-2" /> Add Business
              </Button>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Business Name</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Address</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {approvedBusinesses.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{b.businessName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="capitalize text-slate-300 bg-slate-800/50 border-slate-700">{b.category.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-400 truncate max-w-xs">{b.address}</div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button onClick={() => setEditingBusiness(b)} title="Edit" variant="ghost" size="sm" className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/50 h-8 px-3">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleApproval(b.id, false)} title="Revoke" variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 h-8 px-3">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {approvedBusinesses.length === 0 && (
                     <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No approved businesses yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          </TabsContent>

          <TabsContent value="users">
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">User Management</h2>
                  <p className="text-slate-400 text-sm mt-1">Manage accounts, roles, and access.</p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Account Details</th>
                      <th className="px-6 py-4 font-medium">Contact</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{u.fullName || 'No Name Provided'}</div>
                          <div className="text-slate-400">{u.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-400">
                            {/*@ts-ignore*/}
                            {u.phone || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                            <SelectTrigger className="w-[140px] h-9 bg-slate-800 border-slate-700 text-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                              <SelectItem value="pet_owner">Pet Owner</SelectItem>
                              <SelectItem value="business_owner">Business Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="icon" className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg h-9 w-9" onClick={() => setUserToDelete(u)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>
        </Tabs>
        <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <div className="w-12 h-12 bg-rose-950/30 border border-rose-900/50 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <DialogTitle className="text-xl text-white">Delete User Account</DialogTitle>
              <DialogDescription className="pt-2 text-base text-slate-400">
                Are you sure you want to delete <span className="font-semibold text-white">{userToDelete?.fullName || userToDelete?.email}</span>? This action is permanent and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white" onClick={() => setUserToDelete(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 border-0 text-white" onClick={confirmDeleteUser}>Delete Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={!!editingBusiness} onOpenChange={(open) => !open && setEditingBusiness(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl">{editingBusiness?.id ? 'Edit Business Directory' : 'Add Business Directory'}</DialogTitle>
              <DialogDescription className="text-slate-400">Manage directory listing details, which will be available globally.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveBusiness} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Business Name</Label>
                <Input required value={editingBusiness?.businessName || ''} onChange={e => setEditingBusiness({...editingBusiness!, businessName: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Category</Label>
                <Select value={editingBusiness?.category || ''} onValueChange={v => setEditingBusiness({...editingBusiness!, category: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectItem value="veterinary_clinic">Veterinary Clinic</SelectItem>
                    <SelectItem value="grooming_salon">Grooming Salon</SelectItem>
                    <SelectItem value="pet_boarding">Pet Boarding</SelectItem>
                    <SelectItem value="pet_store">Pet Store</SelectItem>
                    <SelectItem value="training_center">Training Center</SelectItem>
                    <SelectItem value="pet_cafe">Pet Cafe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Address / Location</Label>
                <Input required value={editingBusiness?.address || ''} onChange={e => setEditingBusiness({...editingBusiness!, address: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Contact Number</Label>
                <Input value={editingBusiness?.contactNumber || ''} onChange={e => setEditingBusiness({...editingBusiness!, contactNumber: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Description</Label>
                <Textarea required value={editingBusiness?.description || ''} onChange={e => setEditingBusiness({...editingBusiness!, description: e.target.value})} className="min-h-[100px] bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingBusiness(null)} className="rounded-xl bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">Cancel</Button>
                <Button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-0">Save Directory Entry</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
