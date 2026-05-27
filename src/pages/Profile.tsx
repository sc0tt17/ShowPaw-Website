import React, { useState, useEffect } from 'react';
import { useAuth, db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { useNavigate } from 'react-router-dom';

interface Pet {
  id: string;
  petName: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
}

interface Appointment {
  id: string;
  businessId: string;
  serviceId: string;
  petId: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
  businessName?: string;
  serviceName?: string;
  petName?: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [userProfile, setUserProfile] = useState<{ fullName: string, phone: string } | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '' });
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);

  const [formData, setFormData] = useState({
    petName: '',
    species: 'dog',
    breed: '',
    dateOfBirth: ''
  });

  const fetchPets = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'pets'), where('ownerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const fetchedPets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pet[];
      setPets(fetchedPets);
      
      // Fetch appointments
      const appQ = query(collection(db, 'appointments'), where('userId', '==', user.uid));
      const appSnap = await getDocs(appQ);
      
      const apps = appSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[];
      
      // Enrich appointments
      for (const app of apps) {
        // Find pet name
        const pet = fetchedPets.find(p => p.id === app.petId);
        if (pet) app.petName = pet.petName;
        
        // Fetch business and service info
        try {
          const bDoc = await getDoc(doc(db, 'businesses', app.businessId));
          if (bDoc.exists()) {
             app.businessName = bDoc.data().businessName;
             const sDoc = await getDoc(doc(db, `businesses/${app.businessId}/services`, app.serviceId));
             if(sDoc.exists()) {
               app.serviceName = sDoc.data().serviceName;
             }
          }
        } catch (e) {
          console.error("Error fetching business/service details", e);
        }
      }
      
      setAppointments(apps.sort((a,b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()));
      
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'pets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchUser = async () => {    
      try {
        const uDoc = await getDoc(doc(db, 'users', user.uid));
        if (uDoc.exists()) {
          const data = uDoc.data();
          setUserProfile({ fullName: data.fullName || '', phone: data.phone || '' });
          setProfileForm({ fullName: data.fullName || '', phone: data.phone || '' });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'users');
      }
    };
    fetchUser();
    fetchPets();
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: profileForm.fullName,
        phone: profileForm.phone,
        updatedAt: serverTimestamp()
      });
      setUserProfile(profileForm);
      setIsEditingProfile(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      toast.error("Failed to update profile");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editingPet) {
        await updateDoc(doc(db, 'pets', editingPet.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success("Pet updated successfully");
      } else {
        await addDoc(collection(db, 'pets'), {
          ownerId: user.uid,
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Pet added successfully");
      }
      setIsDialogOpen(false);
      setEditingPet(null);
      setFormData({ petName: '', species: 'dog', breed: '', dateOfBirth: '' });
      fetchPets();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'pets');
      toast.error(editingPet ? "Failed to update pet" : "Failed to add pet");
    }
  };

  const handleDelete = async (petId: string) => {
    if (confirm("Are you sure you want to remove this pet?")) {
      try {
        await deleteDoc(doc(db, 'pets', petId));
        toast.success("Pet removed successfully");
        fetchPets();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'pets');
        toast.error("Failed to delete pet");
      }
    }
  };

  const openEdit = (pet: Pet) => {
    setEditingPet(pet);
    setFormData({
      petName: pet.petName,
      species: pet.species,
      breed: pet.breed || '',
      dateOfBirth: pet.dateOfBirth || ''
    });
    setIsDialogOpen(true);
  };

  if (loading) return <div className="p-10 text-center">Loading profile...</div>;
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-slate-500 mb-4">Please sign in to view your profile.</p>
        <Button onClick={() => navigate('/login')}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 -ml-4 text-slate-600">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold">My Profile</h1>
            {userRole && (
              <Badge variant="secondary" className="capitalize text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-0">
                {userRole.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <p className="text-slate-500">{user?.email}</p>
        </div>
        <Button variant="outline" onClick={() => setIsEditingProfile(true)}>
          <Edit2 className="w-4 h-4 mr-2" /> Edit Personal Info
        </Button>
      </div>

      <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Personal Information</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProfileSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName" 
                required 
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({...profileForm, fullName: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone" 
                value={profileForm.phone}
                onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
              />
            </div>
            <div className="pt-4 flex justify-end">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {userProfile && (
        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="text-xl">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-medium text-slate-700">Full Name: </span>
              <span className="text-slate-600">{userProfile.fullName || 'Not provided'}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Phone: </span>
              <span className="text-slate-600">{userProfile.phone || 'Not provided'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">My Appointments</h2>
        {appointments.length === 0 ? (
          <Card className="bg-slate-50 border-dashed text-center py-10">
            <CardContent className="pt-6">
              <p className="text-slate-500 mb-4">You have no upcoming or past appointments.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map(app => (
              <Card key={app.id}>
                <CardContent className="pt-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{app.serviceName || 'Service'}</h3>
                    <p className="text-slate-600">{app.businessName || 'Business'}</p>
                    <div className="text-sm text-slate-500 mt-2">
                      <p>Pet: <span className="font-medium text-slate-800">{app.petName || 'Unknown'}</span></p>
                      <p>Date: <span className="font-medium text-slate-800">{new Date(app.scheduledAt).toLocaleString()}</span></p>
                    </div>
                  </div>
                  <div>
                    <Badge className={
                      app.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                      app.status === 'pending' ? 'bg-amber-100 text-amber-800' : 
                      app.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      app.status === 'cancelled' ? 'bg-slate-100 text-slate-800' : 'bg-red-100 text-red-800'
                    }>{app.status.toUpperCase()}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">My Pets</h2>
          <Button onClick={() => {
            setEditingPet(null);
            setFormData({ petName: '', species: 'dog', breed: '', dateOfBirth: '' });
            setIsDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" /> Add Pet
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPet ? "Edit Pet" : "Add a New Pet"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="petName">Pet Name *</Label>
                  <Input 
                    id="petName" 
                    required 
                    value={formData.petName}
                    onChange={(e) => setFormData({...formData, petName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="species">Species *</Label>
                  <Select 
                    value={formData.species} 
                    onValueChange={(v) => setFormData({...formData, species: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select species" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dog">Dog</SelectItem>
                      <SelectItem value="cat">Cat</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breed">Breed</Label>
                  <Input 
                    id="breed" 
                    value={formData.breed}
                    onChange={(e) => setFormData({...formData, breed: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input 
                    id="dateOfBirth" 
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                  />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit">{editingPet ? "Save Changes" : "Add Pet"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {pets.length === 0 ? (
          <Card className="bg-slate-50 border-dashed text-center py-10">
            <CardContent className="pt-6">
              <p className="text-slate-500 mb-4">You haven't added any pets yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pets.map(pet => (
              <Card key={pet.id}>
                <CardContent className="pt-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">{pet.petName}</h3>
                    <div className="text-sm text-slate-500 capitalize">{pet.species} {pet.breed ? `- ${pet.breed}` : ''}</div>
                    {pet.dateOfBirth && <div className="text-sm text-slate-500 mt-1">Born: {new Date(pet.dateOfBirth).toLocaleDateString()}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(pet)}>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(pet.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
