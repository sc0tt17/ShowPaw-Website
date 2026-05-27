import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, useAuth } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Phone, Loader2, List, Map as MapIcon, Star, Clock } from 'lucide-react';
import { Input } from '../components/ui/input';
import { VetsMap } from '../components/VetsMap';

interface Business {
  id: string;
  businessName: string;
  category: string;
  address: string;
  contactNumber: string;
  description?: string;
  isApproved: boolean;
  rating?: number;
  isOpen?: boolean;
  operatingHours?: string;
  services?: string[];
}

export default function Directory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(location.state?.initialSearch || '');
  const [filter, setFilter] = useState(location.state?.initialCategory || 'all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [minRating, setMinRating] = useState('0');
  const [isOpenOnly, setIsOpenOnly] = useState(false);
  const [selectedService, setSelectedService] = useState('all');

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const q = query(collection(db, 'businesses'));
        const querySnapshot = await getDocs(q);
        const fetched: Business[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const seed = doc.id.charCodeAt(0) + doc.id.charCodeAt(doc.id.length - 1);
          const rating = data.rating || Number(((seed % 15) / 10 + 3.5).toFixed(1));
          const isOpen = data.isOpen !== undefined ? data.isOpen : (seed % 2 === 0);
          const operatingHours = data.operatingHours || 'Mon-Sat: 8:00 AM - 6:00 PM, Sun: Closed';
          
          let services = data.services;
          if (!services) {
            if (data.category === 'veterinary') services = ['Vaccination', 'Consultation', 'Surgery', 'Checkup'];
            else if (data.category === 'grooming') services = ['Bathing', 'Haircut', 'Nail Trimming', 'Ear Cleaning'];
            else if (data.category === 'pet_store') services = ['Pet Food', 'Accessories', 'Toys', 'Supplements'];
            else services = [];
          }

          fetched.push({
            id: doc.id,
            ...data,
            rating,
            isOpen,
            operatingHours,
            services
          } as Business);
        });
        setBusinesses(fetched);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'businesses');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBusinesses();
  }, []);

  const mergedBusinesses = businesses.reduce((acc, current) => {
    const existing = acc.find(b => b.businessName === current.businessName);
    if (existing) {
      if (!existing.categories.includes(current.category)) {
        existing.categories.push(current.category);
      }
      return acc;
    } else {
      acc.push({ ...current, categories: [current.category] });
      return acc;
    }
  }, [] as (Business & { categories: string[] })[]);

  const allServices = Array.from(new Set(mergedBusinesses.flatMap(b => b.services || []))).sort();

  const filtered = mergedBusinesses
    .map(b => {
      let score = 0;
      const loweredSearch = search.toLowerCase().trim();
      const searchTerms = loweredSearch.split(/\s+/).filter(t => t.trim() !== '');
      
      const bName = b.businessName.toLowerCase();
      const bAddress = b.address.toLowerCase();
      const bDesc = (b.description || '').toLowerCase();
      
      if (searchTerms.length === 0) {
        score = 1;
      } else {
        // Exact match in name gives highest score
        if (bName === loweredSearch) score += 100;
        // Search term is part of name
        if (bName.includes(loweredSearch)) score += 50;
        
        let allTermsMatched = true;
        for (const term of searchTerms) {
          const matchInName = bName.includes(term);
          const matchInAddress = bAddress.includes(term);
          const matchInDesc = bDesc.includes(term);
          const matchInCats = b.categories.some(cat => cat.toLowerCase().replace('_', ' ').includes(term));
          
          if (!matchInName && !matchInAddress && !matchInDesc && !matchInCats) {
            allTermsMatched = false;
            break;
          }
          if (matchInName) score += 5;
          if (matchInAddress) score += 2;
          if (matchInDesc) score += 1;
          if (matchInCats) score += 3;
        }
        
        if (!allTermsMatched) score = 0;
      }
      
      return { ...b, score };
    })
    .filter(b => {
      const matchesSearch = b.score > 0;
      const matchesCategory = filter === 'all' || b.categories.includes(filter);
      const matchesRating = minRating === '0' || (b.rating && b.rating >= Number(minRating));
      const matchesOpen = !isOpenOnly || b.isOpen;
      const matchesService = selectedService === 'all' || (b.services && b.services.includes(selectedService));
      
      return matchesSearch && matchesCategory && matchesRating && matchesOpen && matchesService;
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col mb-8 gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Service Directory</h1>
            <p className="text-slate-500 mt-1">Find and book verified pet services in Laoag City.</p>
          </div>
          
          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
            <Input 
              placeholder="Search by name, location, or service..." 
              className="w-full md:w-64 rounded-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex bg-slate-100 p-1 rounded-full ml-auto md:ml-0 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full px-4 ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4 mr-2" /> List
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full px-4 ${viewMode === 'map' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setViewMode('map')}
              >
                <MapIcon className="w-4 h-4 mr-2" /> Map
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {['all', 'veterinary', 'grooming', 'pet_store', 'rescue_group'].map(c => (
              <Button 
                key={c}
                variant={filter === c ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilter(c)}
                className="whitespace-nowrap rounded-full"
              >
                {c === 'all' ? 'All Categories' : c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Button>
            ))}
          </div>
          
          <div className="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>
          
          <div className="flex flex-wrap gap-3">
            <Select value={minRating} onValueChange={setMinRating}>
              <SelectTrigger className="w-[140px] h-9 rounded-full">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any Rating</SelectItem>
                <SelectItem value="4.5">4.5+ Stars</SelectItem>
                <SelectItem value="4">4.0+ Stars</SelectItem>
                <SelectItem value="3">3.0+ Stars</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-[160px] h-9 rounded-full">
                <SelectValue placeholder="Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Service</SelectItem>
                {allServices.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant={isOpenOnly ? "default" : "outline"} 
              size="sm" 
              onClick={() => setIsOpenOnly(!isOpenOnly)} 
              className="rounded-full h-9"
            >
              <Clock className="w-4 h-4 mr-2" /> Open Now
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : viewMode === 'map' ? (
        <VetsMap filter={filter} search={search} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-slate-400 mb-2">No services found matching your criteria.</div>
          <Button variant="outline" onClick={() => {setSearch(''); setFilter('all');}}>Clear search</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(business => (
            <Card key={business.id} className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex justify-start items-start gap-2 flex-wrap">
                    {business.categories.map(cat => (
                      <Badge key={cat} variant="secondary" className="capitalize text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-0">
                        {cat.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                  {business.rating && (
                    <Badge variant="outline" className="flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      {business.rating.toFixed(1)}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl flex items-center justify-between">
                  {business.businessName}
                </CardTitle>
                <CardDescription className="line-clamp-2 mt-2">{business.description || 'No description provided.'}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-slate-500">
                    <MapPin className="h-4 w-4 mr-2 shrink-0 text-slate-400" />
                    <span className="truncate">{business.address}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-500">
                    <Phone className="h-4 w-4 mr-2 shrink-0 text-slate-400" />
                    <span>{business.contactNumber}</span>
                  </div>
                  <div className="flex items-start text-sm text-slate-500">
                    <Clock className="h-4 w-4 mr-2 shrink-0 text-slate-400 mt-0.5" />
                    <div className="flex flex-col">
                      <span>{business.operatingHours}</span>
                      <span className={business.isOpen ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                        {business.isOpen ? 'Open Now' : 'Closed'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {business.services && business.services.length > 0 && (
                  <div className="mb-6 flex flex-wrap gap-1">
                    {business.services.slice(0, 3).map(svc => (
                      <span key={svc} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{svc}</span>
                    ))}
                    {business.services.length > 3 && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">+{business.services.length - 3} more</span>
                    )}
                  </div>
                )}

                <Link to={`/businesses/${business.id}`} className="w-full">
                  <Button className="w-full">View Details</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
