import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { generateJournalContent } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { 
  ResearchJournal, JournalContent, 
  ContentFormat, ResearchMethod, AuthorName, User, UserRole 
} from './types';
import { 
  LayoutDashboard, PlusCircle, FileText, Download, 
  Loader2, X, ShieldCheck, Globe, LogOut, Edit3, Save, AlertCircle, PieChart as PieChartIcon, BarChart3, TrendingUp, Calendar, Filter,
  User as UserIcon, IdCard, Briefcase
} from 'lucide-react';

const AUTHORS: AuthorName[] = [
  'Angga Dwika Sispatradhana',
  'Rezha Mayhendra',
  'Muhammad Tasrifudin'
];

const METHODS: ResearchMethod[] = [
  'Qualitative',
  'Quantitative',
  'Mixed Methods',
  'Case Study',
  'Literature Review'
];

const DS_TEAM_CODE = "DSTEAM2026";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new-research' | 'history' | 'profile'>('dashboard');
  const [journals, setJournals] = useState<ResearchJournal[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<{journal: ResearchJournal, lang: 'english' | 'indonesian'} | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', employeeId: '', department: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      const safetyLoader = setTimeout(() => {
        if (authLoading) setAuthLoading(false);
      }, 8000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchUserProfile(session.user.id, session.user.email!, session.user.user_metadata?.full_name);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        clearTimeout(safetyLoader);
        setAuthLoading(false);
      }
    };

    initApp();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email!, session.user.user_metadata?.full_name);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setJournals([]);
        setActiveTab('dashboard');
        setAuthLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string, email: string, metadataName?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setCurrentUser({
          id: data.id,
          email: data.email,
          fullName: data.full_name || metadataName || email.split('@')[0],
          role: data.role as UserRole,
          employeeId: data.employee_id || '',
          department: data.department || '',
          stats: data.stats || { readCount: 0, downloadCount: 0 }
        });
      } else {
        setCurrentUser({
          id: userId,
          email,
          fullName: metadataName || email.split('@')[0],
          role: 'INTERNAL',
          stats: { readCount: 0, downloadCount: 0 }
        });
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.fullName,
          employee_id: editForm.employeeId,
          department: editForm.department
        })
        .eq('id', currentUser.id);
      if (dbError) throw dbError;
      setCurrentUser(prev => prev ? { ...prev, ...editForm } : null);
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert("Update failed: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) fetchJournals();
  }, [currentUser?.id]);

  const fetchJournals = async () => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setJournals((data || []) as ResearchJournal[]);
    } catch (error: any) {
      console.error("Journal load failed:", error.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const filteredJournals = useMemo(() => {
    if (dateFilter === 'all') return journals;
    const now = new Date();
    return journals.filter(j => {
      const jDate = new Date(j.createdAt || Date.now());
      if (dateFilter === 'today') return jDate.toDateString() === now.toDateString();
      if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return jDate >= weekAgo;
      }
      if (dateFilter === 'month') {
        return jDate.getMonth() === now.getMonth() && jDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [journals, dateFilter]);

  const authService = {
    login: async (email: string, pass: string) => {
      setAuthError(null);
      setIsLoadingData(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setAuthError(error.message);
      setIsLoadingData(false);
    },
    register: async (email: string, fullName: string, role: UserRole, employeeId: string, department: string, pass: string, code?: string) => {
      setAuthError(null);
      if (role === 'DS_TEAM' && code !== DS_TEAM_CODE) {
        setAuthError("Kode akses DS Team tidak valid.");
        return;
      }
      setIsLoadingData(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email, 
          password: pass,
          options: { data: { full_name: fullName } }
        });
        if (authError) throw authError;
        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').upsert([{
            id: authData.user.id,
            email,
            full_name: fullName,
            role: role,
            employee_id: employeeId,
            department,
            stats: { readCount: 0, downloadCount: 0 }
          }]);
          if (profileError) throw profileError;
          setAuthError("Registrasi Berhasil! Silakan login.");
          setAuthView('login');
        }
      } catch (err: any) {
        setAuthError(err.message);
      } finally {
        setIsLoadingData(false);
      }
    },
    logout: async () => {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setJournals([]);
      setActiveTab('dashboard');
      setAuthView('login');
    }
  };

  const handleCreateResearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setIsGenerating(true);
    setGenerationStatus('Consulting Gemini Intelligence...');
    
    try {
      const content = await generateJournalContent(
        formData.get('topic') as string, 
        formData.get('type') as any, 
        formData.get('format') as string, 
        formData.get('method') as string
      );

      if (!content || !content.english) {
        throw new Error("Invalid AI response. Please try again.");
      }

      setGenerationStatus('Securing data in Research Vault...');

      const { data, error } = await supabase
        .from('journals')
        .insert([{
          topic: formData.get('topic'),
          author: formData.get('author'),
          type: formData.get('type'),
          format: formData.get('format'),
          method: formData.get('method'),
          industry: 'Logistics & Supply Chain',
          status: 'Completed',
          english: content.english,
          indonesian: content.indonesian,
          created_at: new Date().toISOString()
        }])
        .select().single();

      if (error) throw error;

      setJournals(prev => [data as ResearchJournal, ...prev]);
      setGenerationStatus('Success!');
      setTimeout(() => {
        setIsGenerating(false);
        setActiveTab('dashboard');
      }, 1000);

    } catch (error: any) {
      console.error("Research creation error:", error);
      alert(`Process Failed: ${error.message}`);
      setIsGenerating(false);
    }
  };

  const createPDF = (journal: ResearchJournal, lang: 'english' | 'indonesian') => {
    const content: JournalContent = journal[lang];
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);
    let yPos = 15;
    
    const addHeader = () => {
      doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(150, 150, 150);
      const headerText = `Digital Solution R&I Bank - Research Intelligence [Versi ${lang === 'english' ? 'Bahasa Inggris' : 'Bahasa Indonesia'}]`;
      const dateText = new Date().toLocaleDateString();
      doc.text(headerText, margin, 12);
      doc.text(dateText, pageWidth - margin - doc.getTextWidth(dateText), 12);
      doc.setTextColor(0, 0, 0);
    };

    addHeader();
    yPos = 30;

    doc.setFontSize(24).setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(journal.topic, contentWidth);
    doc.text(titleLines, margin, yPos);
    yPos += (titleLines.length * 10) + 10;

    doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0, 102, 204);
    const metaText = `${journal.format.toUpperCase()} | ${journal.type.toUpperCase()} | METHOD: ${journal.method.toUpperCase()}`;
    doc.text(metaText, margin, yPos);
    yPos += 15;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(12).setFont('helvetica', 'bold').text(lang === 'english' ? "ABSTRACT" : "ABSTRAK", margin, yPos);
    yPos += 7;
    doc.setFillColor(245, 247, 250);
    const abstractLines = doc.splitTextToSize(content.abstract, contentWidth - 10);
    const boxHeight = (abstractLines.length * 6) + 10;
    doc.rect(margin - 2, yPos - 5, contentWidth + 4, boxHeight, 'F');
    doc.setFontSize(11).setFont('helvetica', 'italic');
    abstractLines.forEach((line: string) => { doc.text(line, margin + 3, yPos); yPos += 6; });
    yPos += 15;

    const addSection = (num: string, title: string, text: string) => {
      if (!text) return;
      if (yPos > 240) { doc.addPage(); yPos = 20; addHeader(); yPos = 30; }
      doc.setFontSize(14).setFont('helvetica', 'bold').text(`${num}. ${title}`, margin, yPos);
      yPos += 8;
      doc.setFontSize(11).setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, contentWidth);
      lines.forEach((line: string) => {
        if (yPos > 275) { doc.addPage(); yPos = 20; addHeader(); yPos = 30; }
        doc.text(line, margin, yPos); yPos += 6;
      });
      yPos += 12;
    };

    addSection("I", lang === 'english' ? "INTRODUCTION" : "PENDAHULUAN", content.introduction);
    addSection("II", lang === 'english' ? "METHODOLOGY" : "METODOLOGI", content.methodology);
    addSection("III", lang === 'english' ? "RESULTS & ANALYSIS" : "HASIL & ANALISIS", content.results);
    addSection("IV", lang === 'english' ? "CONCLUSION" : "KESIMPULAN", content.conclusion);

    // References Section
    if (content.references && content.references.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; addHeader(); yPos = 30; }
      doc.setFontSize(14).setFont('helvetica', 'bold').text(lang === 'english' ? "REFERENCES" : "DAFTAR PUSTAKA", margin, yPos);
      yPos += 10;
      doc.setFontSize(10).setFont('helvetica', 'normal');
      content.references.forEach((ref, idx) => {
        const refLines = doc.splitTextToSize(`[${idx + 1}] ${ref}`, contentWidth);
        refLines.forEach((line: string) => {
          if (yPos > 280) { doc.addPage(); yPos = 20; addHeader(); yPos = 30; }
          doc.text(line, margin, yPos);
          yPos += 5;
        });
        yPos += 2;
      });
    }

    return doc;
  };

  const stats = useMemo(() => {
    const total = filteredJournals.length;
    const business = filteredJournals.filter(j => j.type === 'Business Forecast').length;
    const tech = filteredJournals.filter(j => j.type === 'Technology').length;
    const articles = filteredJournals.filter(j => j.format === 'Article').length;
    const journalsCount = filteredJournals.filter(j => j.format === 'Journal').length;
    
    return {
      total, business, tech, articles, journalsCount,
      byAuthor: AUTHORS.map(name => ({
        name,
        count: filteredJournals.filter(j => j.author === name).length
      })),
      userAssets: {
        journal: filteredJournals.filter(j => j.author === currentUser?.fullName && j.format === 'Journal').length,
        article: filteredJournals.filter(j => j.author === currentUser?.fullName && j.format === 'Article').length
      }
    };
  }, [filteredJournals, currentUser]);

  const journalPercent = stats.total > 0 ? (stats.journalsCount / stats.total) * 100 : 0;
  const articlePercent = stats.total > 0 ? (stats.articles / stats.total) * 100 : 0;
  const maxAuthorCount = Math.max(...stats.byAuthor.map(a => a.count), 5);

  if (authLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
      <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
      <p className="font-bold animate-pulse">Initializing Secure Protocol...</p>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-slate-900 p-10 text-center">
          <ShieldCheck className="mx-auto text-blue-500 mb-4" size={48} />
          <h2 className="text-white text-2xl font-bold">R&I Insight Bank</h2>
        </div>
        <div className="p-10">
          {authError && <div className="mb-6 p-4 text-xs font-bold rounded-xl bg-red-50 text-red-700 border border-red-100 flex items-center gap-2"><AlertCircle size={14}/> {authError}</div>}
          {authView === 'login' ? (
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); authService.login(fd.get('email') as string, fd.get('password') as string); }} className="space-y-6">
              <input name="email" type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Email Address" />
              <input name="password" type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Password" />
              <button disabled={isLoadingData} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex justify-center items-center gap-2">
                {isLoadingData ? <Loader2 className="animate-spin" /> : 'Login'}
              </button>
              <p className="text-center text-sm text-slate-500">New team member? <button type="button" onClick={() => setAuthView('register')} className="text-blue-600 font-bold hover:underline">Register</button></p>
            </form>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              authService.register(
                fd.get('email') as string, fd.get('name') as string, fd.get('role') as UserRole, 
                fd.get('eid') as string, fd.get('dept') as string, fd.get('pass') as string, fd.get('code') as string
              );
            }} className="space-y-4">
              <input name="name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Full Name" />
              <input name="eid" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Employee ID" />
              <input name="dept" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Department" />
              <input name="email" type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Email" />
              <input name="pass" type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Password" />
              <select name="role" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"><option value="INTERNAL">INTERNAL ROLE</option><option value="DS_TEAM">DS_TEAM ROLE</option></select>
              <input name="code" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="DS Access Code (Optional)" />
              <button disabled={isLoadingData} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex justify-center items-center gap-2">
                {isLoadingData ? <Loader2 className="animate-spin" /> : 'Register'}
              </button>
              <button type="button" onClick={() => setAuthView('login')} className="w-full text-slate-400 text-sm font-bold">Back to Login</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="w-72 bg-slate-900 text-white p-6 hidden lg:flex flex-col border-r border-slate-800 fixed h-full z-40">
        <div className="flex items-center gap-3 mb-10"><ShieldCheck className="text-blue-500" size={32} /><h1 className="text-lg font-bold">Insight Bank</h1></div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg font-bold' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={20} /> Dashboard</button>
          {currentUser.role === 'DS_TEAM' && <button onClick={() => setActiveTab('new-research')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'new-research' ? 'bg-blue-600 shadow-lg font-bold' : 'text-slate-400 hover:bg-slate-800'}`}><PlusCircle size={20} /> Create Research</button>}
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-blue-600 shadow-lg font-bold' : 'text-slate-400 hover:bg-slate-800'}`}><FileText size={20} /> Vault</button>
          <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-blue-600 shadow-lg font-bold' : 'text-slate-400 hover:bg-slate-800'}`}><UserIcon size={20} /> My Profile</button>
        </nav>
        <button onClick={() => authService.logout()} className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-bold"><LogOut size={20} /> Logout</button>
      </aside>

      <main className="flex-1 lg:ml-72 min-h-screen">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest"><Globe size={14} className="text-blue-600" /> Secure Protocol Link</div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{currentUser.fullName}</p>
              <p className="text-[10px] text-blue-600 font-black uppercase tracking-tighter">{currentUser.role.replace('_', ' ')} ACCESS</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">{(currentUser.fullName || "U").charAt(0)}</div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Filter size={16} />
                  <span className="text-[10px] font-black uppercase">Time Period Filter</span>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {['all', 'today', 'week', 'month'].map((f) => (
                    <button 
                      key={f}
                      onClick={() => setDateFilter(f as any)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${dateFilter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-slate-400 text-[9px] font-black uppercase mb-1">Total Assets</p>
                  <div className="flex items-end justify-between"><h3 className="text-2xl font-bold">{stats.total}</h3><TrendingUp size={16} className="text-green-500 mb-1" /></div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-slate-400 text-[9px] font-black uppercase mb-1">Business Forecast</p>
                  <h3 className="text-2xl font-bold text-amber-600">{stats.business}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-slate-400 text-[9px] font-black uppercase mb-1">Tech Innovation</p>
                  <h3 className="text-2xl font-bold text-indigo-600">{stats.tech}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-slate-400 text-[9px] font-black uppercase mb-1">Total Journals</p>
                  <h3 className="text-2xl font-bold text-blue-600">{stats.journalsCount}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-slate-400 text-[9px] font-black uppercase mb-1">My Journals</p>
                  <h3 className="text-2xl font-bold text-slate-800">{stats.userAssets.journal}</h3>
                </div>
                <div className="bg-blue-600 p-5 rounded-2xl shadow-lg text-white">
                  <p className="text-blue-100 text-[9px] font-black uppercase mb-1">My Articles</p>
                  <h3 className="text-2xl font-bold">{stats.userAssets.article}</h3>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Pie Chart Presisi */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-8">
                    <PieChartIcon size={18} className="text-blue-600" />
                    <h4 className="font-bold text-slate-900">Asset Format Composition</h4>
                  </div>
                  <div className="flex flex-col md:flex-row items-center justify-around gap-12">
                    <div className="relative w-48 h-48">
                      <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90 drop-shadow-sm">
                        <circle cx="80" cy="80" r="70" stroke="#f1f5f9" strokeWidth="18" fill="none" />
                        <circle 
                          cx="80" cy="80" r="70" 
                          stroke="#2563eb" 
                          strokeWidth="18" 
                          fill="none" 
                          strokeDasharray="440" 
                          strokeDashoffset={440 - (440 * journalPercent) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-slate-900">{stats.total}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Assets</span>
                      </div>
                    </div>
                    <div className="space-y-6 flex-1 w-full max-w-[240px]">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                          <span className="text-xs font-bold text-slate-600">Scientific Journals</span>
                        </div>
                        <span className="text-xs font-black text-blue-600">{journalPercent.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-slate-200 rounded-full"></div>
                          <span className="text-xs font-bold text-slate-600">Executive Articles</span>
                        </div>
                        <span className="text-xs font-black text-slate-400">{articlePercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bar Chart Sumbu & Angka */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-8">
                    <BarChart3 size={18} className="text-indigo-600" />
                    <h4 className="font-bold text-slate-900">Individual Assets Contribution</h4>
                  </div>
                  <div className="relative h-60 flex">
                    <div className="flex flex-col justify-between h-52 text-[9px] font-bold text-slate-400 pr-3 border-r border-slate-100">
                      {[maxAuthorCount, Math.floor(maxAuthorCount*0.75), Math.floor(maxAuthorCount*0.5), Math.floor(maxAuthorCount*0.25), 0].map(val => (
                        <span key={val}>{val}</span>
                      ))}
                    </div>
                    <div className="flex-1 flex items-end justify-around gap-2 px-6 relative">
                      <div className="absolute inset-0 flex flex-col justify-between h-52 pointer-events-none opacity-50">
                        {[1,2,3,4].map(i => <div key={i} className="w-full border-t border-slate-100 border-dashed"></div>)}
                      </div>
                      
                      {stats.byAuthor.map((auth, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group z-10">
                          <div className="relative w-full flex justify-center items-end h-52">
                            <div 
                              style={{ height: `${(auth.count / maxAuthorCount) * 100}%` }}
                              className={`w-full max-w-[44px] rounded-t-2xl transition-all duration-1000 ease-out shadow-lg shadow-blue-500/10 ${idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-indigo-600' : 'bg-slate-900'} group-hover:brightness-110`}
                            >
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 bg-slate-900 text-white text-[10px] px-3 py-1 rounded-lg font-black whitespace-nowrap">
                                {auth.count} Assets
                              </div>
                            </div>
                          </div>
                          <div className="h-10 text-center">
                            <p className="text-[9px] font-black text-slate-500 uppercase leading-none truncate max-w-[70px]">
                              {auth.name.split(' ')[0]}
                            </p>
                            <p className="text-[7px] font-bold text-slate-300 uppercase mt-1">Author</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Recent Publications Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-slate-400" />
                    <h4 className="font-bold text-sm">Recent Publications Vault</h4>
                  </div>
                  <button onClick={() => setActiveTab('history')} className="text-[10px] text-blue-600 font-black uppercase hover:underline tracking-widest">View All Assets</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/20 border-b border-slate-100">
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/2">Topic Objective</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type Focus</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredJournals.length > 0 ? filteredJournals.slice(0, 5).map(j => (
                        <tr key={j.id} className="hover:bg-slate-50/50 group transition-all">
                          <td className="px-8 py-5">
                            <p className="font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors text-sm">{j.topic}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-2">
                              Lead: <span className="text-slate-600">{j.author}</span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              <span>{new Date(j.createdAt || Date.now()).toLocaleDateString()}</span>
                            </p>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[9px] font-black border shadow-sm ${j.type === 'Business Forecast' ? 'bg-amber-50 text-amber-700 border-amber-200 ring-2 ring-amber-500/5' : 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-2 ring-indigo-500/5'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-2 ${j.type === 'Business Forecast' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                              {j.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex justify-end items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => createPDF(j, 'english').save(`${j.topic}_EN.pdf`)} className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-900 text-[10px] font-black transition-colors">EN</button>
                              <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                              <button onClick={() => createPDF(j, 'indonesian').save(`${j.topic}_ID.pdf`)} className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-900 text-[10px] font-black transition-colors">ID</button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-400 text-sm italic font-medium">Vault access authorized, but no assets found in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'new-research' && (
            <div className="max-w-3xl mx-auto py-10 space-y-10">
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-bold text-slate-900">Execute Strategic AI Research</h2>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Gemini-3 Flash Reasoning Engine Active</p>
              </div>
              <form onSubmit={handleCreateResearch} className="bg-white p-12 rounded-[40px] border border-slate-200 shadow-2xl shadow-blue-500/5 space-y-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Research Topic Formulation</label>
                  <input name="topic" required className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" placeholder="Enter specific research objective or business problem..." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Author Assignment</label>
                    <select name="author" required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all">{AUTHORS.map(a => <option key={a}>{a}</option>)}</select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Research Focus</label>
                    <select name="type" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"><option value="Business Forecast">Business Forecast</option><option value="Technology">Technology Innovation</option></select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Methodology</label>
                    <select name="method" required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all">{METHODS.map(m => <option key={m}>{m}</option>)}</select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Output Format</label>
                    <select name="format" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"><option value="Journal">Scientific Journal</option><option value="Article">Executive Article</option></select>
                  </div>
                </div>
                <button disabled={isGenerating} className="w-full py-6 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-black flex flex-col justify-center items-center gap-1 shadow-2xl transition-all disabled:opacity-80 active:scale-[0.98]">
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin mb-1 text-blue-400" />
                      <span className="text-xs font-black uppercase tracking-widest">{generationStatus}</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle size={24} className="mb-1" />
                      <span className="text-sm font-black uppercase tracking-widest">Initiate AI Research</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-8">
              {filteredJournals.length > 0 ? filteredJournals.map(j => (
                <div key={j.id} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col h-full hover:shadow-xl hover:-translate-y-1 transition-all">
                   <div className="flex justify-between items-start mb-6">
                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border ${j.type === 'Business Forecast' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                      {j.type}
                    </span>
                    <p className="text-[9px] font-black text-slate-300 uppercase">{new Date(j.createdAt || Date.now()).toLocaleDateString()}</p>
                   </div>
                  <h4 className="font-serif-journal text-xl font-bold text-slate-900 mb-4 flex-1 leading-snug">{j.topic}</h4>
                  <div className="pt-6 border-t border-slate-50 mt-auto">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">{j.author.charAt(0)}</div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">{j.author}</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setSelectedJournal({journal: j, lang: 'english'})} className="flex-1 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-black transition-colors">READ EN</button>
                      <button onClick={() => setSelectedJournal({journal: j, lang: 'indonesian'})} className="flex-1 py-3 bg-slate-100 text-slate-700 text-[10px] font-black rounded-xl hover:bg-slate-200 transition-colors">READ ID</button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-40 text-center space-y-4">
                  <FileText size={48} className="mx-auto text-slate-200" />
                  <p className="text-slate-400 font-medium">The vault is currently empty for this period.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="animate-in slide-in-from-right-8 max-w-4xl mx-auto">
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
                <div className="bg-slate-900 p-16 text-center text-white relative">
                  <div className="absolute top-8 right-8 px-5 py-2.5 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">{currentUser.role.replace('_', ' ')}</div>
                  <div className="w-40 h-40 rounded-[48px] bg-blue-500 text-white mx-auto flex items-center justify-center text-6xl font-black mb-8 shadow-2xl ring-8 ring-slate-800/50">{(currentUser.fullName || "U").charAt(0)}</div>
                  <h2 className="text-4xl font-bold mb-3">{currentUser.fullName}</h2>
                  <p className="text-slate-400 font-medium text-lg mb-8">{currentUser.email}</p>
                  <button onClick={() => { setEditForm({ fullName: currentUser.fullName, employeeId: currentUser.employeeId || '', department: currentUser.department || '' }); setIsEditModalOpen(true); }} className="px-8 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-3 mx-auto">
                    <Edit3 size={16} /> Edit Credentials
                  </button>
                </div>
                <div className="p-16 grid grid-cols-1 md:grid-cols-2 gap-12 bg-slate-50/50">
                  <div className="space-y-8">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-4">Secure Identity Protocol</h3>
                    <div className="flex items-center gap-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner"><IdCard size={24} /></div>
                      <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Employee ID</p><p className="font-bold text-slate-900 text-lg">{currentUser.employeeId || 'NOT SET'}</p></div>
                    </div>
                    <div className="flex items-center gap-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shadow-inner"><Briefcase size={24} /></div>
                      <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Department Unit</p><p className="font-bold text-slate-900 text-lg">{currentUser.department || 'NOT SET'}</p></div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-4">Activity Insights</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
                        <p className="text-[24px] font-black text-slate-900 mb-1">{stats.userAssets.journal + stats.userAssets.article}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase">My Research</p>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
                        <p className="text-[24px] font-black text-blue-600 mb-1">{stats.total}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Vault Total</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isSavingProfile && setIsEditModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-3"><Edit3 size={20} className="text-blue-600" /> Secure Profile Update</h3>
              {!isSavingProfile && <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2"><X size={24} /></button>}
            </div>
            <form onSubmit={handleUpdateProfile} className="p-10 space-y-6">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Full Name</label><input disabled={isSavingProfile} value={editForm.fullName} onChange={e => setEditForm(p => ({...p, fullName: e.target.value}))} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold disabled:opacity-50" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Employee ID</label><input disabled={isSavingProfile} value={editForm.employeeId} onChange={e => setEditForm(p => ({...p, employeeId: e.target.value}))} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold disabled:opacity-50" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Department Unit</label><input disabled={isSavingProfile} value={editForm.department} onChange={e => setEditForm(p => ({...p, department: e.target.value}))} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold disabled:opacity-50" /></div>
              <button type="submit" disabled={isSavingProfile} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl disabled:bg-slate-400 active:scale-95">
                {isSavingProfile ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Journal View Modal */}
      {selectedJournal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedJournal(null)}></div>
          <div className="relative bg-white w-full max-w-5xl h-[92vh] rounded-[48px] overflow-hidden flex flex-col animate-in zoom-in-95 shadow-2xl">
            <div className="p-8 border-b flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Research Protocol Preview</span>
                <span className="text-xs font-black text-blue-600 uppercase flex items-center gap-2">
                  <Globe size={12} /> {selectedJournal.lang === 'english' ? 'Global Version (EN)' : 'Local Version (ID)'}
                </span>
              </div>
              <button onClick={() => setSelectedJournal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={28} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 lg:p-20 bg-white">
              <div className="max-w-4xl mx-auto space-y-16">
                <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Digital Solution R&I Bank - Research Intelligence Unit</p>
                   <p className="text-[10px] text-slate-400 font-bold">{new Date(selectedJournal.journal.createdAt || Date.now()).toLocaleDateString()}</p>
                </div>

                <div className="space-y-6">
                  <h1 className="text-5xl font-serif-journal font-bold text-slate-900 leading-tight">{selectedJournal.journal.topic}</h1>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
                      {selectedJournal.journal.format}
                    </span>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
                      {selectedJournal.journal.type}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Method: {selectedJournal.journal.method}
                    </span>
                  </div>
                </div>

                <div className="space-y-12 prose prose-slate max-w-none text-justify">
                  <div className="bg-slate-50 border-l-[6px] border-blue-500 p-10 rounded-r-[40px] shadow-inner">
                    <h5 className="font-black text-[10px] uppercase tracking-[0.2em] text-blue-600 mb-6">Abstract Formulation</h5>
                    <p className="italic text-slate-700 leading-relaxed font-serif-journal text-lg">"{selectedJournal.journal[selectedJournal.lang].abstract}"</p>
                  </div>
                  
                  <section className="space-y-6">
                    <h5 className="font-black text-xs uppercase tracking-[0.3em] text-slate-400 border-b-2 border-slate-50 pb-4">I. Introduction</h5>
                    <p className="text-slate-800 leading-loose text-lg">{selectedJournal.journal[selectedJournal.lang].introduction}</p>
                  </section>
                  
                  <section className="space-y-6">
                    <h5 className="font-black text-xs uppercase tracking-[0.3em] text-slate-400 border-b-2 border-slate-50 pb-4">II. Research Methodology</h5>
                    <p className="text-slate-800 leading-loose text-lg">{selectedJournal.journal[selectedJournal.lang].methodology}</p>
                  </section>
                  
                  <section className="space-y-6">
                    <h5 className="font-black text-xs uppercase tracking-[0.3em] text-slate-400 border-b-2 border-slate-50 pb-4">III. Empirical Analysis & Results</h5>
                    <p className="text-slate-800 leading-loose text-lg">{selectedJournal.journal[selectedJournal.lang].results}</p>
                  </section>
                  
                  <section className="space-y-6">
                    <h5 className="font-black text-xs uppercase tracking-[0.3em] text-slate-400 border-b-2 border-slate-50 pb-4">IV. Strategic Conclusion</h5>
                    <p className="text-slate-800 leading-loose text-lg">{selectedJournal.journal[selectedJournal.lang].conclusion}</p>
                  </section>

                  {selectedJournal.journal[selectedJournal.lang].references && (
                    <section className="space-y-8 pt-10">
                      <h5 className="font-black text-xs uppercase tracking-[0.3em] text-slate-900 border-b-2 border-slate-900 pb-4">References</h5>
                      <ul className="list-none pl-0 space-y-4 text-sm text-slate-600 font-medium">
                        {selectedJournal.journal[selectedJournal.lang].references.map((ref, i) => (
                          <li key={i} className="flex gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors">
                            <span className="text-blue-500 font-black">[{i+1}]</span> 
                            <span>{ref}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </div>
            </div>
            <div className="p-8 border-t bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                <ShieldCheck size={16} className="text-green-500" /> Authorized Publication Access
              </div>
              <button onClick={() => createPDF(selectedJournal.journal, selectedJournal.lang).save(`${selectedJournal.journal.topic}.pdf`)} className="w-full sm:w-auto px-12 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl active:scale-95">
                <Download size={20} /> Export High-Res PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;