import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, getDocs, addDoc, serverTimestamp, where, deleteDoc } from 'firebase/firestore';
import { db, useAuth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MapPin, Phone, Clock, Loader2, ArrowLeft, Star, StarHalf, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

interface Business {
  id: string;
  businessName: string;
  category: string;
  address: string;
  contactNumber: string;
  description?: string;
  isApproved: boolean;
  isOpen?: boolean;
  operatingHours?: string;
}

interface Service {
  id: string;
  serviceName: string;
  description: string;
  price: number;
  durationMinutes: number;
}

interface Pet {
  id: string;
  petName: string;
  species: string;
}

interface Review {
  id: string;
  authorId: string;
  rating: number;
  content: string;
  createdAt: any;
}

export default function BusinessDetails() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  // Booking state
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedPet, setSelectedPet] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  
  // Review state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!id || !user) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'businesses', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const seed = docSnap.id.charCodeAt(0) + docSnap.id.charCodeAt(docSnap.id.length - 1);
          const isOpen = data.isOpen !== undefined ? data.isOpen : (seed % 2 === 0);
          const operatingHours = data.operatingHours || 'Mon-Sat: 8:00 AM - 6:00 PM, Sun: Closed';
          
          if (!isMounted) return;
          setBusiness({ id: docSnap.id, ...data, isOpen, operatingHours } as Business);
          
          const servicesQ = query(collection(db, `businesses/${id}/services`));
          const servicesSnap = await getDocs(servicesQ);
          let loadedServices = servicesSnap.docs.map(s => ({ id: s.id, ...s.data() } as Service));
          
          if (!isMounted) return;

          // Deduplicate services
          const seenNames = new Set();
          const uniqueServices: Service[] = [];
          for (const s of loadedServices) {
            if (seenNames.has(s.serviceName)) {
              if (user?.uid === data.ownerId || userRole === 'admin') {
                 try {
                     await deleteDoc(doc(db, `businesses/${id}/services`, s.id!));
                 } catch (e) {
                     console.error("Error deleting duplicate service", e);
                 }
              }
            } else {
              seenNames.add(s.serviceName);
              uniqueServices.push(s);
            }
          }
          loadedServices = uniqueServices;
          
          if (loadedServices.length === 0) {
            let predefinedServices = [
              { serviceName: "Medical Services", description: "Professional consultation, health checkups, targeted surgeries, and whelping assistance.", price: 500, durationMinutes: 30 },
              { serviceName: "Confinement & IV Fluids", description: "Dedicated inpatient care monitoring and intravenous fluid therapy for sick or recovering pets.", price: 1500, durationMinutes: 1440 },
              { serviceName: "Preventive Care", description: "Routine health vaccinations, scheduled deworming, and parasite preventives.", price: 300, durationMinutes: 15 },
              { serviceName: "Laboratory Diagnostics", description: "Fast-acting test kits and microscopic evaluations, including fecalysis, skin scrapings, ear mite checks, and smear tests.", price: 800, durationMinutes: 45 },
              { serviceName: "Pet Grooming", description: "Dedicated hygiene maintenance routines for both dogs and cats.", price: 600, durationMinutes: 60 },
              { serviceName: "On-Site Pharmacy & Supplies", description: "Quick access to prescription medications, therapeutic diets, and everyday pet retail products.", price: 100, durationMinutes: 10 },
              { serviceName: "Outreach Care", description: "Flexible home service options for pets unable to travel directly to the physical facility.", price: 1000, durationMinutes: 60 }
            ];
            
            const bName = data.businessName || '';
            if (bName.includes('Provincial Veterinary Office')) {
              predefinedServices = [
                { serviceName: "Free Public Health Drives", description: "Routine anti-rabies vaccinations and basic deworming programs for cats and dogs.", price: 0, durationMinutes: 15 },
                { serviceName: "Walk-In Consultations", description: "Basic health checkups and veterinary medical consultations at their primary office.", price: 0, durationMinutes: 30 },
                { serviceName: "Livestock Support", description: "Distribution of livestock (\"Agri Ka Dito\" program) and availability of specialized equipment like egg incubators and forage choppers for registered local raisers.", price: 0, durationMinutes: 60 },
                { serviceName: "Community Medical Missions", description: "Regular barangay-level medical missions providing free pet micro-surgeries (like spaying and castration) in partnership with the Laoag City Veterinary Office.", price: 0, durationMinutes: 120 },
                { serviceName: "Disease Surveillance", description: "Monitoring, zoning, and quarantine management for local livestock diseases, such as African Swine Fever (ASF).", price: 0, durationMinutes: 60 }
              ];
            } else if (bName.includes('PETSCHOICE')) {
              predefinedServices = [
                { serviceName: "Veterinary Consultations", description: "Physical health exams, sickness diagnostics, and professional medical advice.", price: 500, durationMinutes: 30 },
                { serviceName: "Preventative Medicine", description: "Routine anti-rabies, core multi-protection vaccines (like 5-in-1 or 4-in-1 formulas), and targeted deworming schedules.", price: 300, durationMinutes: 15 },
                { serviceName: "Pet Grooming & Maintenance", description: "Regular hygienic bathing, hair trimming, styling, nail clipping, and ear cleaning.", price: 600, durationMinutes: 60 },
                { serviceName: "Pharmacy & Retail Supplies", description: "Commercial pet accessories, premium dog and cat food brands, nutritional supplements, specific vitamins, and prescribed veterinary medications.", price: 100, durationMinutes: 10 }
              ];
            } else if (bName.includes('Vets For Pets')) {
              predefinedServices = [
                { serviceName: "Veterinary Medical Care", description: "General checkups, patient health assessments, disease management, and focused surgeries.", price: 500, durationMinutes: 30 },
                { serviceName: "Preventative Treatment", description: "Core vaccinations, routine deworming schedules, and anti-parasite solutions.", price: 300, durationMinutes: 15 },
                { serviceName: "Hygienic Pet Grooming", description: "Full cleaning, bathing, and hair trimming services for companion dogs and cats.", price: 600, durationMinutes: 60 },
                { serviceName: "Inpatient Updates", description: "Dedicated tracking and regular text or messenger status updates for confined or recovering animals.", price: 200, durationMinutes: 1440 }
              ];
            } else if (bName.includes('WKND AGRI VET')) {
              predefinedServices = [
                { serviceName: "Pet Foods & Nutrition", description: "A variety of commercial dry kibble, wet food, treats, and dietary supplements for dogs, cats, and other domestic pets.", price: 100, durationMinutes: 10 },
                { serviceName: "Poultry & Livestock Feeds", description: "High-quality feeds, hog mash, and starter/grower/finisher crumbles tailored for local poultry and backyard livestock farmers.", price: 500, durationMinutes: 15 },
                { serviceName: "Over-the-Counter Animal Medicines", description: "Retail distribution of veterinary essentials such as vitamins, dewormers, tick and flea preventatives, and general animal health care supplements.", price: 150, durationMinutes: 10 },
                { serviceName: "Pet Accessories", description: "Leashes, collars, feeding bowls, grooming supplies, and basic pet care hardware.", price: 300, durationMinutes: 10 },
                { serviceName: "In-Store Retail & Walk-in Assistance", description: "Direct over-the-counter sales with staff available to guide you on basic feed selection, product usage, and nutritional care.", price: 0, durationMinutes: 30 },
                { serviceName: "Store-to-Door Delivery", description: "They offer specialized local delivery options to bring bulk feeds or pet supplies directly to your residence, farm, or business location within the area.", price: 200, durationMinutes: 60 },
                { serviceName: "Accessibility Accommodations", description: "The Gov. Roque B. Ablan branch features wheelchair-accessible entrances, parking, and seating facilities for on-site convenience.", price: 0, durationMinutes: 5 }
              ];
            } else if (bName.includes('Corpus Christi')) {
              predefinedServices = [
                { serviceName: "Clinical & Medical Care", description: "They provide medical consultations, diagnostics, and treatments for domestic pets. They handle general small-animal healthcare, including post-natal care, checking on sick pets, and addressing urgent cases.", price: 500, durationMinutes: 30 },
                { serviceName: "Pet Supply Store", description: "In addition to veterinary treatments, the facility houses a retail section stocked with essential pet supplies, including pet food (kibble and wet food), vitamins, grooming items, and animal health supplements.", price: 100, durationMinutes: 10 },
                { serviceName: "Emergency & Dedicated Support", description: "While routine check-ups happen during regular hours, the clinic has a strong reputation for responsiveness when local \"fur parents\" face urgent pet care situations.", price: 1500, durationMinutes: 60 }
              ];
            } else if (bName.includes('LAOAG') || bName.includes('Laoag City')) {
              predefinedServices = [
                { serviceName: "General Medical Consultations & Diagnostics", description: "Routine physical examinations, checking on lethargic or sick pets, and identifying targeted illnesses.", price: 500, durationMinutes: 30 },
                { serviceName: "Veterinary Surgery", description: "Minor and major surgical procedures, including standard neutering/spaying (castration) and critical soft-tissue or emergency intervention.", price: 3000, durationMinutes: 120 },
                { serviceName: "Preventative Care & Vaccinations", description: "Administration of core pet vaccines (anti-rabies, 5-in-1/6-in-1 shots) and primary deworming regimens to keep puppies, kittens, and older pets safe from common local pathogens.", price: 300, durationMinutes: 15 },
                { serviceName: "Pet Grooming & Hygiene", description: "Full-service pet bathing, nail trimming, ear cleaning, and hair clipping/shaving tailored to handle local environmental factors like the heavy Ilocos heat.", price: 600, durationMinutes: 60 },
                { serviceName: "Pet Supply Retail Counter", description: "An integrated commercial space offering prescribed animal medicines, standard commercial pet foods (dry and wet), vitamins, post-recovery supplements, and essential accessories.", price: 100, durationMinutes: 10 }
              ];
            }

            for (const s of predefinedServices) {
               const sRef = await addDoc(collection(db, `businesses/${id}/services`), {
                businessId: id,
                ...s,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              loadedServices.push({ id: sRef.id, ...s } as Service);
            }
          }

          setServices(loadedServices);
          
          const reviewsQ = query(collection(db, `businesses/${id}/reviews`));
          const reviewsSnap = await getDocs(reviewsQ);
          setReviews(reviewsSnap.docs.map(r => ({ id: r.id, ...r.data() } as Review)).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
          
          if (user) {
            const result = await getDocs(query(collection(db, 'pets'), where('ownerId', '==', user.uid)));
            setPets(result.docs.map(p => ({ id: p.id, ...p.data() } as Pet)));
          }
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Fetch Data Error:", error);
        handleFirestoreError(error, OperationType.GET, `businesses/${id} or subcollections`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [id, user]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !reviewContent.trim()) return;
    
    setIsSubmittingReview(true);
    try {
      const reviewData = {
        businessId: id,
        authorId: user.uid,
        rating: reviewRating,
        content: reviewContent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, `businesses/${id}/reviews`), reviewData);
      
      // Optimitistic UI update
      setReviews([{ id: docRef.id, ...reviewData, createdAt: { toMillis: () => Date.now() } } as any, ...reviews]);
      setReviewContent('');
      setReviewRating(5);
      toast.success("Review posted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
      toast.error("Failed to post review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !selectedServiceId || !selectedPet || !scheduledAt) return;
    try {
      await addDoc(collection(db, 'appointments'), {
        userId: user.uid,
        businessId: id,
        serviceId: selectedServiceId,
        petId: selectedPet,
        scheduledAt,
        status: 'pending',
        notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Appointment requested successfully!");
      // Reset form (keep service selected)
      setSelectedPet('');
      setScheduledAt('');
      setNotes('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'appointments');
      toast.error("Failed to book appointment");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  
  if (!user) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <p className="text-slate-500 mb-4">Please sign in to view business details and book appointments.</p>
        <Button onClick={() => navigate('/login')}>Sign in</Button>
      </div>
    );
  }

  if (!business) return <div className="text-center py-20">Business not found.</div>;

  const selectedServiceObj = services.find(s => s.id === selectedServiceId) || null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <Button variant="ghost" onClick={() => navigate('/directory')} className="mb-6 -ml-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
      </Button>
      
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* Main Content Column */}
        <div className="flex-1 min-w-0">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 mb-10 text-center md:text-left">
        <Badge variant="secondary" className="capitalize text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-0 mb-4 inline-flex">
          {business.category.replace('_', ' ')}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">{business.businessName}</h1>
        <p className="text-lg text-slate-600 mb-6 max-w-3xl">{business.description}</p>
        
        <div className="flex flex-col md:flex-row justify-center md:justify-start gap-4 md:gap-6 text-slate-500">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 shrink-0" />
            <span>{business.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 shrink-0" />
            <span>{business.contactNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 shrink-0" />
            <div className="flex items-center gap-2">
              <span>{business.operatingHours}</span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${business.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {business.isOpen ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Services Offered</h2>
        {services.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm"
            className="text-slate-500 hover:text-rose-600"
            onClick={async () => {
              if (window.confirm("This will delete all current services so you can re-seed them. Continue?")) {
                try {
                  const loader = toast.loading("Resetting services...");
                  for (const s of services) {
                    await deleteDoc(doc(db, `businesses/${id}/services`, s.id!));
                  }
                  toast.dismiss(loader);
                  window.location.reload();
                } catch(e) {
                  console.error(e);
                  toast.error("Failed to reset services.");
                }
              }
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
        )}
      </div>
      {services.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-slate-200 text-center">
          <p className="text-slate-500 font-medium mb-4">No services currently listed for this business.</p>
          <Button 
            onClick={async () => {
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
                  await addDoc(collection(db, `businesses/${id}/services`), {
                    businessId: id,
                    ...s,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                  });
                }
                toast.success("Demo services seeded! Please refresh the page to see them.");
                setTimeout(() => window.location.reload(), 1500);
              } catch(e) {
                console.error(e);
                toast.error("Failed to seed services.");
              }
            }}
            variant="outline"
          >
            Seed Demo Services
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map(service => (
            <Card key={service.id} className="flex flex-col border-slate-100 shadow-sm hover:shadow-md transition-all hover:border-indigo-100 overflow-hidden group">
              <div className="h-2 w-full bg-indigo-50 group-hover:bg-indigo-500 transition-colors" />
              <CardHeader className="pt-6">
                <div className="flex justify-between items-start mb-2 gap-4">
                  <CardTitle className="text-xl leading-tight group-hover:text-indigo-700 transition-colors">{service.serviceName}</CardTitle>
                  <div className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full shrink-0">
                    ₱{service.price}
                  </div>
                </div>
                <CardDescription className="line-clamp-3 mt-2">{service.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0 flex flex-col gap-4">
                <div className="flex items-center text-sm font-medium text-slate-500 bg-slate-50 w-fit px-3 py-1.5 rounded-md">
                  <Clock className="w-4 h-4 mr-2 text-slate-400" />
                  <span>{service.durationMinutes} mins</span>
                </div>
                
                <Button 
                  className="w-full group-hover:bg-indigo-600 transition-colors" 
                  variant={selectedServiceId === service.id ? "default" : "outline"}
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    document.getElementById('booking-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {selectedServiceId === service.id ? 'Selected' : 'Select Service'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Reviews & Ratings</h2>
        
        {/* Write a Review Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <h3 className="font-semibold text-lg mb-4">Write a Review</h3>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="flex gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <div
                  key={star}
                  role="button"
                  tabIndex={0}
                  onClick={() => setReviewRating(star)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setReviewRating(star);
                    }
                  }}
                  className="focus:outline-none cursor-pointer"
                >
                  <Star 
                    className={`w-6 h-6 ${star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} 
                  />
                </div>
              ))}
            </div>
            <Textarea
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
              placeholder="Share your experience with this business..."
              className="min-h-[100px]"
              required
            />
            <Button type="submit" disabled={isSubmittingReview || !reviewContent.trim()}>
              {isSubmittingReview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Post Review
            </Button>
          </form>
        </div>

        {/* Existing Reviews */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No reviews yet. Be the first to review!</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star}
                        className={`w-4 h-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-sm text-slate-500">
                    {review.createdAt?.toMillis ? new Date(review.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                  </span>
                </div>
                <p className="text-slate-700">{review.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
      </div>

      {/* Booking Side Panel */}
      <div id="booking-panel" className="w-full lg:w-[400px] shrink-0">
        <div className="sticky top-8">
          <Card className="border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-6">
              <CardTitle className="text-xl">Book Appointment</CardTitle>
              <CardDescription>
                {selectedServiceObj ? `Scheduling: ${selectedServiceObj.serviceName}` : 'Select a service to schedule'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {!user ? (
                <div className="py-8 text-center flex flex-col items-center">
                  <p className="mb-4 text-slate-500">Sign in to book an appointment with {business.businessName}.</p>
                  <Button onClick={() => navigate('/login')} className="w-full">Sign In</Button>
                </div>
              ) : pets.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center">
                  <p className="mb-4 text-slate-500">You need to add a pet to your profile before booking.</p>
                  <Button onClick={() => navigate('/profile')} className="w-full">Go to Profile</Button>
                </div>
              ) : (
                <form onSubmit={handleBooking} className="space-y-5 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Selected Service</label>
                    <Select value={selectedServiceId} onValueChange={setSelectedServiceId} required>
                      <SelectTrigger className="bg-slate-50">
                        {selectedServiceId && services.length > 0 ? (
                          <div className="flex-1 text-left truncate">
                            {(() => {
                              const s = services.find(s => s.id === selectedServiceId);
                              return s ? `${s.serviceName} - ₱${s.price}` : "Choose a service";
                            })()}
                          </div>
                        ) : (
                          <SelectValue placeholder="Choose a service" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {services.map(s => (
                          <SelectItem key={s.id} value={s.id}>{`${s.serviceName} - ₱${s.price}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Select Pet</label>
                    <Select value={selectedPet} onValueChange={setSelectedPet} required>
                      <SelectTrigger>
                        {selectedPet && pets.length > 0 ? (
                          <div className="flex-1 text-left truncate">
                            {(() => {
                              const p = pets.find(p => p.id === selectedPet);
                              return p ? `${p.petName} (${p.species})` : "Choose a pet";
                            })()}
                          </div>
                        ) : (
                          <SelectValue placeholder="Choose a pet" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {pets.map(pet => (
                          <SelectItem key={pet.id} value={pet.id}>{`${pet.petName} (${pet.species})`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Date & Time</label>
                    <input 
                      type="datetime-local" 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Notes (Optional)</label>
                    <Textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special instructions or concerns?"
                      className="resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="pt-2">
                    <Button type="submit" size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700 text-base shadow-md">
                      Confirm Booking
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
      
    </div>
  );
}
