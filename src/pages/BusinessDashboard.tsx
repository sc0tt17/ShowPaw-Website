import React, { useState, useEffect } from 'react';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { useAuth, db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, addDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Loader2, Plus, Edit, ArrowLeft, Calendar, Star, Clock, RefreshCw } from 'lucide-react';
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

interface Service {
  id: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
  description: string;
}

interface Appointment {
  id: string;
  petId: string;
  serviceId: string;
  scheduledAt: string;
  status: string;
  notes: string;
  petName?: string;
  serviceName?: string;
}

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avgRating: 0, reviewsCount: 0 });
  const [pets, setPets] = useState<any[]>([]);
  const [petRecords, setPetRecords] = useState<any[]>([]);
  const [moderationPosts, setModerationPosts] = useState<any[]>([]);

  const [weekOffset, setWeekOffset] = useState(0);

  // Forms
  const [bForm, setBForm] = useState<Partial<Business>>({});
  const [sForm, setSForm] = useState<Partial<Service>>({});
  const [isAddingService, setIsAddingService] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const bQuery = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
        const bSnap = await getDocs(bQuery);
        
        let fetchedBusiness = null;
        if (!bSnap.empty) {
          fetchedBusiness = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() } as Business;
          setBusiness(fetchedBusiness);
          setBForm(fetchedBusiness);
          
          // Fetch services
          const sQuery = query(collection(db, `businesses/${fetchedBusiness.id}/services`));
          const sSnap = await getDocs(sQuery);
          setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));

          // Fetch appointments
          const aQuery = query(collection(db, 'appointments'), where('businessId', '==', fetchedBusiness.id));
          const aSnap = await getDocs(aQuery);
          const rawAppointments = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
          
          // Try to attach names (this can be optimized for larger datasets)
          for (let app of rawAppointments) {
            try {
              const pSnap = await getDocs(query(collection(db, 'pets'), where('__name__', '==', app.petId)));
              if (!pSnap.empty) app.petName = pSnap.docs[0].data().petName;
              const serv = sSnap.docs.find(s => s.id === app.serviceId);
              if (serv) app.serviceName = serv.data().serviceName;
            } catch (e) {
              console.error(e);
            }
          }
          setAppointments(rawAppointments);

          // Fetch reviews for stats
          const rQuery = query(collection(db, `businesses/${fetchedBusiness.id}/reviews`));
          const rSnap = await getDocs(rQuery);
          if (!rSnap.empty) {
            const ratings = rSnap.docs.map(d => d.data().rating as number);
            const avgRating = ratings.reduce((acc, curr) => acc + curr, 0) / ratings.length;
            setStats({ avgRating, reviewsCount: ratings.length });
          }

          // Fetch all pets for the Pet Database
          const petsQuery = query(collection(db, 'pets'));
          const petsSnap = await getDocs(petsQuery);
          setPets(petsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          
          // Fetch community posts for moderation
          const postsQuery = query(collection(db, 'posts'));
          const postsSnap = await getDocs(postsQuery);
          
          const rawPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          // Fetch author names
          for (let post of rawPosts) {
            try {
              const uDoc = await getDoc(doc(db, 'users', (post as any).authorId));
              if (uDoc.exists()) (post as any).authorName = uDoc.data().fullName;
            } catch (e) {}
          }
          setModerationPosts(rawPosts);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'businesses');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const bRef = doc(collection(db, 'businesses'));
      await setDoc(bRef, {
        ownerId: user.uid,
        ...bForm,
        isApproved: false, // Wait for admin
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Business profile created! Waiting for admin approval.");
      // Soft reload
      window.location.reload();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'businesses');
      toast.error("Failed to create business.");
    }
  };

  const handleSeedServices = async () => {
    if (!business) return;
    try {
      let predefinedServices = [
        { serviceName: "Medical Services", description: "Professional consultation, health checkups, targeted surgeries, and whelping assistance.", price: 500, durationMinutes: 30 },
        { serviceName: "Confinement & IV Fluids", description: "Dedicated inpatient care monitoring and intravenous fluid therapy for sick or recovering pets.", price: 1500, durationMinutes: 1440 },
        { serviceName: "Preventive Care", description: "Routine health vaccinations, scheduled deworming, and parasite preventives.", price: 300, durationMinutes: 15 },
        { serviceName: "Laboratory Diagnostics", description: "Fast-acting test kits and microscopic evaluations, including fecalysis, skin scrapings, ear mite checks, and smear tests.", price: 800, durationMinutes: 45 },
        { serviceName: "Pet Grooming", description: "Dedicated hygiene maintenance routines for both dogs and cats.", price: 600, durationMinutes: 60 },
        { serviceName: "On-Site Pharmacy & Supplies", description: "Quick access to prescription medications, therapeutic diets, and everyday pet retail products.", price: 100, durationMinutes: 10 },
        { serviceName: "Outreach Care", description: "Flexible home service options for pets unable to travel directly to the physical facility.", price: 1000, durationMinutes: 60 }
      ];

      if (business.businessName.includes('Provincial Veterinary Office')) {
        predefinedServices = [
          { serviceName: "Free Public Health Drives", description: "Routine anti-rabies vaccinations and basic deworming programs for cats and dogs.", price: 0, durationMinutes: 15 },
          { serviceName: "Walk-In Consultations", description: "Basic health checkups and veterinary medical consultations at their primary office.", price: 0, durationMinutes: 30 },
          { serviceName: "Livestock Support", description: "Distribution of livestock (\"Agri Ka Dito\" program) and availability of specialized equipment like egg incubators and forage choppers for registered local raisers.", price: 0, durationMinutes: 60 },
          { serviceName: "Community Medical Missions", description: "Regular barangay-level medical missions providing free pet micro-surgeries (like spaying and castration) in partnership with the Laoag City Veterinary Office.", price: 0, durationMinutes: 120 },
          { serviceName: "Disease Surveillance", description: "Monitoring, zoning, and quarantine management for local livestock diseases, such as African Swine Fever (ASF).", price: 0, durationMinutes: 60 }
        ];
      } else if (business.businessName.includes('PETSCHOICE')) {
        predefinedServices = [
          { serviceName: "Veterinary Consultations", description: "Physical health exams, sickness diagnostics, and professional medical advice.", price: 500, durationMinutes: 30 },
          { serviceName: "Preventative Medicine", description: "Routine anti-rabies, core multi-protection vaccines (like 5-in-1 or 4-in-1 formulas), and targeted deworming schedules.", price: 300, durationMinutes: 15 },
          { serviceName: "Pet Grooming & Maintenance", description: "Regular hygienic bathing, hair trimming, styling, nail clipping, and ear cleaning.", price: 600, durationMinutes: 60 },
          { serviceName: "Pharmacy & Retail Supplies", description: "Commercial pet accessories, premium dog and cat food brands, nutritional supplements, specific vitamins, and prescribed veterinary medications.", price: 100, durationMinutes: 10 }
        ];
      } else if (business.businessName.includes('Vets For Pets')) {
        predefinedServices = [
          { serviceName: "Veterinary Medical Care", description: "General checkups, patient health assessments, disease management, and focused surgeries.", price: 500, durationMinutes: 30 },
          { serviceName: "Preventative Treatment", description: "Core vaccinations, routine deworming schedules, and anti-parasite solutions.", price: 300, durationMinutes: 15 },
          { serviceName: "Hygienic Pet Grooming", description: "Full cleaning, bathing, and hair trimming services for companion dogs and cats.", price: 600, durationMinutes: 60 },
          { serviceName: "Inpatient Updates", description: "Dedicated tracking and regular text or messenger status updates for confined or recovering animals.", price: 200, durationMinutes: 1440 }
        ];
      } else if (business.businessName.includes('WKND AGRI VET')) {
        predefinedServices = [
          { serviceName: "Pet Foods & Nutrition", description: "A variety of commercial dry kibble, wet food, treats, and dietary supplements for dogs, cats, and other domestic pets.", price: 100, durationMinutes: 10 },
          { serviceName: "Poultry & Livestock Feeds", description: "High-quality feeds, hog mash, and starter/grower/finisher crumbles tailored for local poultry and backyard livestock farmers.", price: 500, durationMinutes: 15 },
          { serviceName: "Over-the-Counter Animal Medicines", description: "Retail distribution of veterinary essentials such as vitamins, dewormers, tick and flea preventatives, and general animal health care supplements.", price: 150, durationMinutes: 10 },
          { serviceName: "Pet Accessories", description: "Leashes, collars, feeding bowls, grooming supplies, and basic pet care hardware.", price: 300, durationMinutes: 10 },
          { serviceName: "In-Store Retail & Walk-in Assistance", description: "Direct over-the-counter sales with staff available to guide you on basic feed selection, product usage, and nutritional care.", price: 0, durationMinutes: 30 },
          { serviceName: "Store-to-Door Delivery", description: "They offer specialized local delivery options to bring bulk feeds or pet supplies directly to your residence, farm, or business location within the area.", price: 200, durationMinutes: 60 },
          { serviceName: "Accessibility Accommodations", description: "The Gov. Roque B. Ablan branch features wheelchair-accessible entrances, parking, and seating facilities for on-site convenience.", price: 0, durationMinutes: 5 }
        ];
      } else if (business.businessName.includes('Corpus Christi')) {
        predefinedServices = [
          { serviceName: "Clinical & Medical Care", description: "They provide medical consultations, diagnostics, and treatments for domestic pets. They handle general small-animal healthcare, including post-natal care, checking on sick pets, and addressing urgent cases.", price: 500, durationMinutes: 30 },
          { serviceName: "Pet Supply Store", description: "In addition to veterinary treatments, the facility houses a retail section stocked with essential pet supplies, including pet food (kibble and wet food), vitamins, grooming items, and animal health supplements.", price: 100, durationMinutes: 10 },
          { serviceName: "Emergency & Dedicated Support", description: "While routine check-ups happen during regular hours, the clinic has a strong reputation for responsiveness when local \"fur parents\" face urgent pet care situations.", price: 1500, durationMinutes: 60 }
        ];
      } else if (business.businessName.includes('LAOAG') || business.businessName.includes('Laoag City')) {
        predefinedServices = [
          { serviceName: "General Medical Consultations & Diagnostics", description: "Routine physical examinations, checking on lethargic or sick pets, and identifying targeted illnesses.", price: 500, durationMinutes: 30 },
          { serviceName: "Veterinary Surgery", description: "Minor and major surgical procedures, including standard neutering/spaying (castration) and critical soft-tissue or emergency intervention.", price: 3000, durationMinutes: 120 },
          { serviceName: "Preventative Care & Vaccinations", description: "Administration of core pet vaccines (anti-rabies, 5-in-1/6-in-1 shots) and primary deworming regimens to keep puppies, kittens, and older pets safe from common local pathogens.", price: 300, durationMinutes: 15 },
          { serviceName: "Pet Grooming & Hygiene", description: "Full-service pet bathing, nail trimming, ear cleaning, and hair clipping/shaving tailored to handle local environmental factors like the heavy Ilocos heat.", price: 600, durationMinutes: 60 },
          { serviceName: "Pet Supply Retail Counter", description: "An integrated commercial space offering prescribed animal medicines, standard commercial pet foods (dry and wet), vitamins, post-recovery supplements, and essential accessories.", price: 100, durationMinutes: 10 }
        ];
      } else if (business.businessName.includes('Paws N Fresh')) {
        predefinedServices = [
          { serviceName: "Professional Dog Grooming & Styling", description: "Full-service grooming packages that include relaxing pet baths, blow-drying, fur brushing, custom hair clipping, and stylish trims.", price: 600, durationMinutes: 60 },
          { serviceName: "Pet Hygiene & Maintenance", description: "Essential hygienic care such as thorough nail trimming, ear cleaning, and refreshing treatments to keep your dog comfortable and smelling great.", price: 300, durationMinutes: 30 },
          { serviceName: "Pet Boarding & Lodging", description: "Safe overnight or multi-day boarding facilities where \"fur parents\" can confidently leave their dogs under attentive supervision when out of town or busy.", price: 1000, durationMinutes: 1440 }
        ];
      }

      for (const s of predefinedServices) {
        const sRef = await addDoc(collection(db, `businesses/${business.id}/services`), {
          businessId: business.id,
          ...s,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setServices(prev => [...prev, { id: sRef.id, ...s } as Service]);
      }
      toast.success("Default services seeded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to seed services.");
    }
  };

  const handleUpdateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        ...bForm,
        updatedAt: serverTimestamp()
      });
      toast.success("Business profile updated!");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'businesses');
      toast.error("Failed to update business.");
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    try {
      const sRef = await addDoc(collection(db, `businesses/${business.id}/services`), {
        businessId: business.id,
        serviceName: sForm.serviceName,
        description: sForm.description || '',
        price: Number(sForm.price),
        durationMinutes: Number(sForm.durationMinutes),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Service added!");
      setServices([...services, { id: sRef.id, ...sForm } as Service]);
      setSForm({});
      setIsAddingService(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'services');
      toast.error("Failed to add service.");
    }
  };

  const updateAppointmentStatus = async (appId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'appointments', appId), {
        status,
        updatedAt: serverTimestamp()
      });
      setAppointments(appointments.map(a => a.id === appId ? { ...a, status } : a));
      toast.success(`Appointment marked as ${status}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'appointments');
      toast.error("Failed to update appointment");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  if (userRole !== 'business_owner') {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 -ml-4 text-slate-600 block mx-auto w-fit">
          <ArrowLeft className="w-4 h-4 mr-2 inline" /> Back
        </Button>
        <h1 className="text-3xl font-bold mb-4">Business Dashboard</h1>
        <p className="text-slate-600 mb-8">You need to have a Business Owner account to access this page.</p>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 inline-block text-left max-w-lg">
          <h2 className="text-lg font-bold text-indigo-900 mb-2">For Evaluation / Testing:</h2>
          <p className="text-indigo-800 text-sm mb-4">
            Since this is a preview application, you can elevate your access to Business Owner by opening the Firebase Console linked in your AI Studio settings, navigating to Firestore Database, locating your user document in the <code className="bg-indigo-100 px-1 rounded">users</code> collection, and changing your <code className="bg-indigo-100 px-1 rounded">role</code> to <code className="bg-indigo-100 px-1 rounded">business_owner</code>.
          </p>
          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>I've changed my role, reload page</Button>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 -ml-4 text-slate-600">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-bold mb-8">Setup Your Business Profile</h1>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateBusiness} className="space-y-4">
              <div className="space-y-2"><Label>Business Name</Label><Input required value={bForm.businessName || ''} onChange={e => setBForm({...bForm, businessName: e.target.value})} /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={bForm.category || ''} onValueChange={v => setBForm({...bForm, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veterinary">Veterinary</SelectItem>
                    <SelectItem value="grooming">Grooming</SelectItem>
                    <SelectItem value="pet_store">Pet Store</SelectItem>
                    <SelectItem value="rescue_group">Rescue Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input required value={bForm.address || ''} onChange={e => setBForm({...bForm, address: e.target.value})} /></div>
              <div className="space-y-2"><Label>Contact Number</Label><Input required value={bForm.contactNumber || ''} onChange={e => setBForm({...bForm, contactNumber: e.target.value})} /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={bForm.description || ''} onChange={e => setBForm({...bForm, description: e.target.value})} /></div>
              <Button type="submit">Create Business Profile</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 -ml-4 text-slate-600">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{business.businessName}</h1>
          <p className="text-slate-500">Business Dashboard {!business.isApproved && '(Pending Approval)'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-lg">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Appointments</p>
                <h3 className="text-2xl font-bold text-slate-900">{appointments.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                <Star className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Average Rating</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-slate-900">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'}</h3>
                  <span className="text-sm text-slate-500">({stats.reviewsCount} reviews)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Upcoming Bookings</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {appointments.filter(a => new Date(a.scheduledAt) > new Date() && a.status !== 'cancelled').length}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="appointments">
        <TabsList className="mb-8 overflow-x-auto flex flex-nowrap w-full">
          <TabsTrigger value="appointments">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar Grid</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="pet_database">Pet Database</TabsTrigger>
          <TabsTrigger value="community_mod">Community Mod</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">
          <div className="grid grid-cols-1 mb-8 gap-4">
            {appointments.length === 0 ? <p className="text-slate-500">No appointments yet.</p> : 
              appointments.sort((a,b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()).map(app => (
              <Card key={app.id}>
                <CardContent className="pt-6 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{app.petName || 'Unknown Pet'}</h3>
                    <p className="text-slate-500">Service: {app.serviceName || 'Unknown Service'}</p>
                    <p className="text-slate-500">Date: {new Date(app.scheduledAt).toLocaleString()}</p>
                    <div className="mt-2 text-sm font-semibold capitalize text-rose-600">Status: {app.status}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {app.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => updateAppointmentStatus(app.id, 'confirmed')} className="bg-green-600 hover:bg-green-700">Confirm</Button>
                        <Button size="sm" variant="destructive" onClick={() => updateAppointmentStatus(app.id, 'rejected')}>Reject</Button>
                      </>
                    )}
                    {app.status === 'confirmed' && (
                      <Button size="sm" onClick={() => updateAppointmentStatus(app.id, 'completed')}>Mark Completed</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Calendar Schedule</h2>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset - 1)}>
                &larr; Prev Week
              </Button>
              <span className="font-medium">
                {format(addDays(startOfDay(new Date()), weekOffset * 7), 'MMM d')} - {format(addDays(startOfDay(new Date()), weekOffset * 7 + 6), 'MMM d, yyyy')}
              </span>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset + 1)}>
                Next Week &rarr;
              </Button>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto mb-8">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = addDays(startOfDay(new Date()), weekOffset * 7 + i);
                  const isToday = isSameDay(date, new Date());
                  return (
                    <div key={date.toString()} className={`p-4 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-rose-50 border-b-2 border-b-rose-500' : ''}`}>
                      <div className={`text-sm font-medium ${isToday ? 'text-rose-600' : 'text-slate-500'}`}>{format(date, 'EEE')}</div>
                      <div className={`text-lg font-bold ${isToday ? 'text-rose-700' : 'text-slate-900'}`}>{format(date, 'MMM d')}</div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = addDays(startOfDay(new Date()), weekOffset * 7 + i);
                  const dayApps = appointments.filter(a => isSameDay(new Date(a.scheduledAt), date)).sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
                  
                  return (
                    <div key={date.toString()} className={`border-r border-slate-100 p-2 last:border-r-0 flex flex-col gap-2 ${isSameDay(date, new Date()) ? 'bg-rose-50/10' : 'bg-slate-50/30'}`}>
                      {dayApps.map(app => (
                        <div key={app.id} className={`p-3 rounded-lg text-xs shadow-sm ${app.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : app.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-white text-slate-700 border border-slate-200'}`}>
                          <div className="font-bold text-sm mb-1">{format(new Date(app.scheduledAt), 'h:mm a')}</div>
                          <div className="truncate font-semibold">{app.petName || 'Unknown Pet'}</div>
                          <div className="text-[11px] truncate opacity-80 mb-2">{app.serviceName || 'Service'}</div>
                          <div className="flex gap-1">
                            {app.status === 'pending' && (
                              <button onClick={() => updateAppointmentStatus(app.id, 'confirmed')} className="bg-white hover:bg-amber-100 transition-colors text-amber-700 rounded px-2 py-1 font-medium flex-1 shadow-sm border border-amber-200/50">Confirm</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pet_database">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Pet Profile Database</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pets.length === 0 ? <p className="text-slate-500">No pets found in database.</p> : pets.map(pet => (
              <Card key={pet.id}>
                <CardContent className="pt-6">
                  <h3 className="font-bold text-lg text-indigo-900">{pet.petName}</h3>
                  <div className="text-sm text-slate-500 mb-4 capitalize">{pet.species} &bull; {pet.breed || 'Unknown Build'}</div>
                  
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Medical Records & Vaccinations</Label>
                      <Textarea 
                         placeholder="Enter medical notes and vaccination dates..." 
                         className="mt-1 text-sm bg-white" 
                         defaultValue={pet.medicalRecords || ''}
                         onBlur={(e) => {
                           updateDoc(doc(db, 'pets', pet.id), { medicalRecords: e.target.value, updatedAt: serverTimestamp() }).then(() => toast.success("Medical records saved."));
                         }}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                       <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                         <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Dietary Needs</Label>
                         <Input 
                            placeholder="e.g. Hypoallergenic" 
                            className="mt-1 text-sm bg-white"
                            defaultValue={pet.dietaryNeeds || ''}
                            onBlur={(e) => {
                              updateDoc(doc(db, 'pets', pet.id), { dietaryNeeds: e.target.value, updatedAt: serverTimestamp() }).then(() => toast.success("Dietary needs saved."));
                            }}
                         />
                       </div>
                       <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                         <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Weight History</Label>
                         <Input 
                            placeholder="e.g. 15kg (Oct 2023)" 
                            className="mt-1 text-sm bg-white"
                            defaultValue={pet.weightHistory || ''}
                            onBlur={(e) => {
                              updateDoc(doc(db, 'pets', pet.id), { weightHistory: e.target.value, updatedAt: serverTimestamp() }).then(() => toast.success("Weight history saved."));
                            }}
                         />
                       </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="community_mod">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Community Moderation</h2>
            <p className="text-slate-500 text-sm">Remove inappropriate posts.</p>
          </div>
          <div className="space-y-4">
             {moderationPosts.length === 0 ? <p className="text-slate-500">No community posts yet.</p> : moderationPosts.sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map(post => (
               <Card key={post.id}>
                 <CardContent className="pt-6 flex justify-between items-start gap-4">
                   <div>
                     <div className="font-semibold text-slate-900">{post.authorName || 'Unknown User'}</div>
                     <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{post.content}</p>
                   </div>
                   <Button variant="outline" size="sm" className="text-rose-600 hover:text-white hover:bg-rose-600 border-rose-200" onClick={async () => {
                     if (window.confirm("Delete this post?")) {
                       try {
                         await deleteDoc(doc(db, 'posts', post.id));
                         setModerationPosts(moderationPosts.filter(p => p.id !== post.id));
                         toast.success("Post deleted.");
                       } catch (e) {
                         toast.error("Failed to delete post.");
                       }
                     }
                   }}>
                     Delete
                   </Button>
                 </CardContent>
               </Card>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="services">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Manage Services</h2>
            <div className="flex gap-2">
              {services.length > 0 && (
                <Button 
                  variant="ghost" 
                  className="text-slate-500 hover:text-rose-600"
                  onClick={async () => {
                    if (window.confirm("This will delete all current services so you can re-seed them. Continue?")) {
                      try {
                        const loader = toast.loading("Resetting services...");
                        for (const s of services) {
                          await deleteDoc(doc(db, `businesses/${business!.id}/services`, s.id!));
                        }
                        toast.dismiss(loader);
                        setServices([]);
                      } catch(e) {
                        toast.error("Failed to reset.");
                      }
                    }
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Reset Defaults
                </Button>
              )}
              {services.length === 0 && (
                <Button variant="outline" onClick={handleSeedServices}>
                  <Plus className="w-4 h-4 mr-2" /> Seed Common Services
                </Button>
              )}
              <Button onClick={() => setIsAddingService(!isAddingService)}><Plus className="w-4 h-4 mr-2" /> Add Service</Button>
            </div>
          </div>
          
          {isAddingService && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <form onSubmit={handleAddService} className="space-y-4">
                  <div className="space-y-2"><Label>Service Name</Label><Input required value={sForm.serviceName || ''} onChange={e => setSForm({...sForm, serviceName: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Price (₱)</Label><Input type="number" required value={sForm.price || ''} onChange={e => setSForm({...sForm, price: Number(e.target.value)})} /></div>
                    <div className="space-y-2"><Label>Duration (Minutes)</Label><Input type="number" required value={sForm.durationMinutes || ''} onChange={e => setSForm({...sForm, durationMinutes: Number(e.target.value)})} /></div>
                  </div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={sForm.description || ''} onChange={e => setSForm({...sForm, description: e.target.value})} /></div>
                  <Button type="submit">Save Service</Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map(s => (
              <Card key={s.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xl">{s.serviceName}</h3>
                    <span className="font-bold text-rose-600">₱{s.price}</span>
                  </div>
                  <p className="text-slate-500 mb-4">{s.description}</p>
                  <div className="text-sm text-slate-500">{s.durationMinutes} minutes</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleUpdateBusiness} className="space-y-4">
                <div className="space-y-2"><Label>Business Name</Label><Input required value={bForm.businessName || ''} onChange={e => setBForm({...bForm, businessName: e.target.value})} /></div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={bForm.category || ''} onValueChange={v => setBForm({...bForm, category: v})}>
                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="veterinary">Veterinary</SelectItem>
                      <SelectItem value="grooming">Grooming</SelectItem>
                      <SelectItem value="pet_store">Pet Store</SelectItem>
                      <SelectItem value="rescue_group">Rescue Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Address</Label><Input required value={bForm.address || ''} onChange={e => setBForm({...bForm, address: e.target.value})} /></div>
                <div className="space-y-2"><Label>Contact Number</Label><Input required value={bForm.contactNumber || ''} onChange={e => setBForm({...bForm, contactNumber: e.target.value})} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={bForm.description || ''} onChange={e => setBForm({...bForm, description: e.target.value})} /></div>
                <Button type="submit">Update Profile</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
