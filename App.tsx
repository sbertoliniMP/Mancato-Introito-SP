import React, { useState, useEffect, useCallback } from 'react';
import InterviewPage from './components/InterviewPage';
import SummaryPage from './components/SummaryPage';
import WelcomePage from './components/WelcomePage';
import { InterviewData } from './types';
import { FormIcon, ChartIcon, CloudIcon, SyncIcon } from './components/icons';
import { getAllInterviewsDB, addInterviewDB, clearAllInterviewsDB, replaceInterviewsDB } from './db';

type Page = 'interview' | 'summary';
type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'connected' | 'error';
type SessionMode = 'welcome' | 'local' | 'online';

const logoSrc = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjNEY0NkU1Ii8+PHRleHQgeD0iNTAiIHk9Ijc1IiBmb250LXNpemU9IjcwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlA8L3RleHQ+PC9zdmc+";

interface SyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDisconnect: () => void;
    syncUrl: string | null;
}

const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onDisconnect, syncUrl }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        if (syncUrl) {
            navigator.clipboard.writeText(syncUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl p-8 m-4 max-w-md w-full space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">Sessione Condivisa</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
                </div>
                {syncUrl ? (
                    <div className="space-y-4">
                        <p className="text-slate-600 text-center">Condividi questo URL per collaborare:</p>
                        <div className="flex gap-2 items-center">
                           <input 
                                type="text"
                                value={syncUrl}
                                readOnly
                                className="w-full flex-grow px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono text-sm text-slate-700"
                                onFocus={(e) => e.target.select()}
                           />
                           <button onClick={handleCopy} className="font-semibold px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition whitespace-nowrap">
                                {copied ? 'Copiato!' : 'Copia'}
                           </button>
                        </div>
                        <button onClick={onDisconnect} className="w-full bg-red-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-600 transition">
                            Disconnetti
                        </button>
                    </div>
                ) : (
                   <p className="text-slate-600 text-center">Nessuna sessione online attiva.</p>
                )}
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [sessionMode, setSessionMode] = useState<SessionMode>('welcome');
  const [currentPage, setCurrentPage] = useState<Page>('interview');
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncUrl, setSyncUrl] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  
  const KVDB_NEW_BIN_URL = 'https://kvdb.io/new/bin';

  const sortInterviews = (data: InterviewData[]) => data.sort((a, b) => new Date(b.interviewDateTime).getTime() - new Date(a.interviewDateTime).getTime());

  const getBinData = useCallback(async (url: string): Promise<InterviewData[]> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Impossibile recuperare i dati. (HTTP ${response.status})`);
    }
    const newEtag = response.headers.get('ETag');
    if (newEtag) setEtag(newEtag);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }, []);

  const handleManualSync = useCallback(async () => {
    if (!syncUrl) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
        const cloudData = await getBinData(syncUrl);
        const sortedData = sortInterviews(cloudData);
        setInterviews(sortedData);
        await replaceInterviewsDB(sortedData);
        setSyncStatus('connected');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
        setSyncStatus('error');
        setSyncError(`Sincronizzazione manuale fallita: ${errorMessage}`);
    }
  }, [syncUrl, getBinData]);

  const handleStartLocalSession = async () => {
    setIsLoading(true);
    const localData = await getAllInterviewsDB();
    setInterviews(sortInterviews(localData));
    localStorage.setItem('sessionMode', 'local');
    localStorage.removeItem('syncUrl');
    setSessionMode('local');
    setSyncUrl(null);
    setIsLoading(false);
  };

  const handleConnectSession = useCallback(async (url: string, shouldConfirm = true): Promise<void> => {
    if (!url.startsWith('https://kvdb.io/')) {
        setSyncError("URL non valido. Assicurati che inizi con 'https://kvdb.io/'.");
        throw new Error("URL non valido.");
    }
    setSyncStatus('connecting');
    setSyncError(null);
    setIsLoading(true);
    try {
        const cloudData = await getBinData(url);
        if (!shouldConfirm || window.confirm("Connettendoti, i tuoi dati locali verranno sostituiti con quelli della sessione condivisa. Continuare?")) {
            const sortedData = sortInterviews(cloudData);
            localStorage.setItem('sessionMode', 'online');
            localStorage.setItem('syncUrl', url);
            setSyncUrl(url);
            setInterviews(sortedData);
            await replaceInterviewsDB(sortedData);
            setSessionMode('online');
            setSyncStatus('connected');
        } else {
            setSyncStatus('idle');
        }
    } catch (error) {
        setSyncStatus('error');
        const errorMessage = error instanceof Error ? `URL non valido o sessione non trovata. ${error.message}` : 'Errore sconosciuto';
        setSyncError(errorMessage);
        throw error; // Re-throw to be caught by caller
    } finally {
        setIsLoading(false);
    }
  }, [getBinData]);
  
  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
        setIsLoading(true);
        const savedSessionMode = localStorage.getItem('sessionMode') as SessionMode | null;
        const savedSyncUrl = localStorage.getItem('syncUrl');

        if (savedSessionMode === 'online' && savedSyncUrl) {
            try {
                await handleConnectSession(savedSyncUrl, false);
            } catch {
                // Fallback to local on connection error
                await handleStartLocalSession();
                setSyncError("Impossibile connettersi alla sessione cloud. Caricamento dati locali.");
            }
        } else if (savedSessionMode === 'local') {
            await handleStartLocalSession();
        } else {
            setSessionMode('welcome');
        }
        setIsLoading(false);
    };
    loadInitialData();
  }, [handleConnectSession]);
  
  // Polling for real-time updates
  useEffect(() => {
    if (sessionMode !== 'online' || syncStatus !== 'connected' || !syncUrl) return;

    const poll = async () => {
        try {
            const response = await fetch(syncUrl, { headers: etag ? { 'If-None-Match': etag } : {} });
            if (response.status === 200) {
                const newEtag = response.headers.get('ETag');
                if (newEtag) setEtag(newEtag);
                const cloudData = await response.json();
                const sortedData = sortInterviews(Array.isArray(cloudData) ? cloudData : []);
                setInterviews(sortedData);
                await replaceInterviewsDB(sortedData);
            } else if (response.status !== 304) {
                throw new Error(`Server error during poll: ${response.status}`);
            }
        } catch (error) {
            console.error('Polling error:', error);
            setSyncStatus('error');
            setSyncError('Connessione persa. Riprova a sincronizzare manualmente.');
        }
    };
    const intervalId = setInterval(poll, 5000);
    return () => clearInterval(intervalId);
  }, [sessionMode, syncUrl, etag, syncStatus]);

  const addInterview = async (interview: InterviewData) => {
    const optimisticNewData = sortInterviews([...interviews, interview]);
    setInterviews(optimisticNewData); // Optimistic UI update

    if (sessionMode === 'online' && syncUrl) {
        setSyncStatus('syncing');
        try {
            const response = await fetch(syncUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json-patch+json' },
                body: JSON.stringify([{ op: 'add', path: '/-', value: interview }]),
            });
            if (!response.ok) throw new Error(`Sincronizzazione fallita. (HTTP ${response.status})`);
            
            await addInterviewDB(interview);
            const newEtag = response.headers.get('ETag');
            if (newEtag) setEtag(newEtag);
            setSyncStatus('connected');
        } catch (error) {
            setSyncStatus('error');
            const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
            setSyncError(`Sincronizzazione fallita: ${errorMessage}. La modifica è salvata solo localmente.`);
            await addInterviewDB(interview); // Save locally on failure
            throw error;
        }
    } else {
        await addInterviewDB(interview);
    }
  };
  
  const clearInterviews = async () => {
    if (sessionMode === 'online' && syncUrl) {
        await fetch(syncUrl, { method: 'POST', body: '[]', headers: { 'Content-Type': 'application/json' }});
    }
    await clearAllInterviewsDB();
    setInterviews([]);
  };

  const replaceInterviews = async (newInterviews: InterviewData[]) => {
    const sortedData = sortInterviews(newInterviews);
    if (sessionMode === 'online' && syncUrl) {
        const response = await fetch(syncUrl, { method: 'POST', body: JSON.stringify(sortedData), headers: { 'Content-Type': 'application/json' }});
        const newEtag = response.headers.get('ETag');
        if (newEtag) setEtag(newEtag);
    }
    await replaceInterviewsDB(sortedData);
    setInterviews(sortedData);
  };
  
  const handleCreateSession = async () => {
    setSyncStatus('connecting');
    setSyncError(null);
    setIsLoading(true);
    try {
        const response = await fetch(KVDB_NEW_BIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(interviews),
        });
        if (!response.ok) throw new Error(`Creazione sessione fallita (HTTP ${response.status})`);
        const url = await response.text();
        localStorage.setItem('sessionMode', 'online');
        localStorage.setItem('syncUrl', url);
        setSyncUrl(url);
        const newEtag = response.headers.get('ETag');
        if (newEtag) setEtag(newEtag);
        setSessionMode('online');
        setSyncStatus('connected');
    } catch (error) {
        setSyncStatus('error');
        setSyncError(error instanceof Error ? error.message : 'Errore sconosciuto');
        throw error;
    } finally {
        setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
      localStorage.removeItem('syncUrl');
      localStorage.removeItem('sessionMode');
      setSyncUrl(null);
      setSyncStatus('idle');
      setSyncError(null);
      setEtag(null);
      setInterviews([]);
      setSessionMode('welcome');
      setIsSyncModalOpen(false);
  };

  const NavButton: React.FC<{ pageName: Page; label: string; icon: React.ReactNode; }> = ({ pageName, label, icon }) => (
    <button onClick={() => setCurrentPage(pageName)} className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition ${currentPage === pageName ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-200'}`}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  if (isLoading && sessionMode !== 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-xl font-semibold text-slate-700 animate-pulse">Caricamento sessione...</p>
      </div>
    );
  }

  if (sessionMode === 'welcome') {
      return <WelcomePage 
        onStartLocal={handleStartLocalSession}
        onCreateOnline={handleCreateSession}
        onJoinOnline={handleConnectSession}
        isConnecting={syncStatus === 'connecting'}
        error={syncError}
      />
  }

  const getStatusIndicator = () => {
    if (sessionMode === 'local') {
      return { icon: <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>, text: 'Sessione Locale' };
    }
    if (sessionMode === 'online') {
      switch (syncStatus) {
        case 'connected': return { icon: <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>, text: 'Sessione Online' };
        case 'connecting': return { icon: <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse"></span>, text: 'Connessione...' };
        case 'syncing': return { icon: <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse"></span>, text: 'Sincronizzazione...' };
        case 'error': return { icon: <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>, text: 'Errore Sincronizzazione' };
        default: return { icon: <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>, text: 'Offline' };
      }
    }
    return null;
  };
  const status = getStatusIndicator();


  return (
    <div className="min-h-screen bg-slate-100 font-sans">
        <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} onDisconnect={handleDisconnect} syncUrl={syncUrl} />
      <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={logoSrc} alt="Logo Parcheggio" className="w-8 h-8" />
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 hidden sm:block">Analisi Impatto Parcheggio</h1>
            {status && (
              <div className="flex items-center gap-2 text-sm bg-slate-100 px-3 py-1 rounded-full">
                {status.icon}
                <span className="text-slate-600 hidden md:inline">{status.text}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sessionMode === 'online' && syncUrl && (
              <button onClick={handleManualSync} disabled={syncStatus === 'syncing'} title="Sincronizza Dati" className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50">
                  <SyncIcon className={`w-5 h-5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              </button>
            )}
             <button onClick={() => setIsSyncModalOpen(true)} title="Sessione Condivisa" className={`p-2 rounded-full ${sessionMode === 'online' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'} hover:bg-slate-200`}>
                  <CloudIcon className="w-5 h-5" />
              </button>
            <nav className="flex items-center gap-2 bg-slate-100 p-1 rounded-full">
              <NavButton pageName="interview" label="Intervista" icon={<FormIcon className="w-5 h-5"/>} />
              <NavButton pageName="summary" label="Riepilogo" icon={<ChartIcon className="w-5 h-5"/>} />
            </nav>
          </div>
        </div>
      </header>
      <main>
        {currentPage === 'interview' && <InterviewPage addInterview={addInterview} />}
        {currentPage === 'summary' && <SummaryPage interviews={interviews} clearInterviews={clearInterviews} replaceInterviews={replaceInterviews} />}
      </main>
      <footer className="text-center py-4 text-slate-500 text-sm">
        <p>Applicazione per l'analisi del mancato introito TPL e Sosta.</p>
      </footer>
    </div>
  );
};

export default App;