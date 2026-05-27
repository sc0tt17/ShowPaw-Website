import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Search, MapPin, Calendar, Users, Stethoscope, Scissors, ShoppingBag, Heart } from 'lucide-react';
import { Input } from '../components/ui/input';
import { useState } from 'react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: any) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // In a real app we might pass this via URL params. 
      // Since Directory uses a local state for search, we'd need to either update Directory to read from URL 
      // or use state navigation. Let's redirect to Directory and we will also update Directory to read from location.state
      navigate('/directory', { state: { initialSearch: searchQuery } });
    } else {
      navigate('/directory');
    }
  };
  return (
    <div className="bg-slate-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-32 lg:pt-24 lg:pb-40 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-semibold mb-6 border border-indigo-100">
            <MapPin className="h-4 w-4" />
            Laoag City's Pet Community
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 max-w-4xl mx-auto mb-8">
            Everything your pet needs, <br className="hidden md:block"/>
            <span className="text-indigo-600">all in one place.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            Find the best veterinarians, grooming salons, and pet supplies in Laoag City. Book appointments instantly and connect with other pet owners.
          </p>
          
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto bg-white p-2 rounded-2xl shadow-lg border border-slate-100 flex flex-col sm:flex-row gap-2 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Search for clinics, groomers, or services..." 
                className="w-full pl-10 border-0 bg-transparent shadow-none focus-visible:ring-0 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="rounded-xl shrink-0">Search Services</Button>
          </form>

          <div className="flex justify-center">
            <Button 
               variant="outline" 
               className="rounded-full shadow-sm"
               onClick={() => navigate('/directory', { state: { initialCategory: 'veterinary' } })}
            >
              <Stethoscope className="w-4 h-4 mr-2" />
              Find Nearby Clinics
            </Button>
          </div>
        </div>
      </section>

      {/* Features Categories */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Stethoscope, title: 'Veterinary Clinics', desc: 'Find reliable medical care, vaccinations, and checkups.', color: 'text-blue-600', bg: 'bg-blue-100' },
              { icon: Scissors, title: 'Grooming Centers', desc: 'Keep your pets clean, styled, and healthy.', color: 'text-pink-600', bg: 'bg-pink-100' },
              { icon: ShoppingBag, title: 'Pet Supplies', desc: 'Discover local stores for food, toys, and accessories.', color: 'text-emerald-600', bg: 'bg-emerald-100' },
              { icon: Heart, title: 'Rescue & Adoption', desc: 'Connect with local animal welfare organizations.', color: 'text-rose-600', bg: 'bg-rose-100' },
            ].map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.bg}`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps/How it works */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">How ShowPaw Works</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">A seamless experience designed for pet owners and local businesses in Laoag City.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-slate-100 -z-10"></div>
            {[
              { icon: Search, title: 'Discover Local Services', desc: 'Browse our comprehensive directory of verified pet businesses.' },
              { icon: Calendar, title: 'Book Instantly', desc: 'Schedule appointments for vet visits or grooming sessions online.' },
              { icon: Users, title: 'Join the Community', desc: 'Ask questions, share advice, and connect with fellow pet lovers.' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-indigo-50 border-4 border-white shadow-sm flex items-center justify-center mb-6 z-10 relative">
                  <step.icon className="h-10 w-10 text-indigo-600" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center border-2 border-white">{i + 1}</div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
