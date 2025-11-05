import React, { useState } from 'react';
import { CloudIcon, DesktopIcon } from './icons';

const logoSrc = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjNEY0NkU1Ii8+PHRleHQgeD0iNTAiIHk9Ijc1IiBmb250LXNpemU9IjcwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlA8L3RleHQ+PC9zdmc+";

interface WelcomePageProps {
  onStartLocal: () => void;
  onCreateOnline: () => Promise<void>;
  onJoinOnline: (url: string) => Promise<void>;
  isConnecting: boolean;
  error: string | null;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onStartLocal, onCreateOnline, onJoinOnline, isConnecting, error }) => {
    const [joinUrl, setJoinUrl] = useState('');
    const [joinError, setJoinError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);

    const handleCreate = async () => {
        setCreateError(null);
        try {
            await onCreateOnline();
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : "Creazione sessione fallita.");
        }
    };
    
    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinUrl) {
            setJoinError("L'URL non può essere vuoto.");
            return;
        }
        setJoinError(null);
        try {
            await onJoinOnline(joinUrl);
        } catch (e) {
            setJoinError(e instanceof Error ? e.message : "Impossibile connettersi alla sessione.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans">
            <div className="text-center mb-8">
                <img src={logoSrc} alt="Logo" className="w-16 h-16 mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-slate-800">Analisi Impatto Parcheggio</h1>
                <p className="text-slate-600 mt-2 text-lg">Benvenuto/a. Scegli come iniziare la tua sessione di analisi.</p>
            </div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Online Card */}
                <div className="bg-white p-8 rounded-2xl shadow-lg flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <CloudIcon className="w-8 h-8 text-indigo-500" />
                        <h2 className="text-2xl font-bold text-slate-800">Sessione Online</h2>
                    </div>
                    <p className="text-slate-600 mb-6 flex-grow">Crea una sessione condivisa per collaborare in tempo reale con altri utenti, oppure unisciti a una sessione esistente.</p>
                    
                    <div className="space-y-4">
                        <button 
                            onClick={handleCreate}
                            disabled={isConnecting}
                            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition"
                        >
                            {isConnecting ? 'Creazione...' : 'Crea Nuova Sessione'}
                        </button>
                        {createError && <p className="text-red-500 text-sm">{createError}</p>}

                        <div className="relative my-2">
                            <hr/>
                            <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-2 text-slate-500 text-sm">oppure</span>
                        </div>

                        <form onSubmit={handleJoin} className="flex gap-2">
                            <input 
                                type="text"
                                value={joinUrl}
                                onChange={(e) => setJoinUrl(e.target.value)}
                                placeholder="Incolla URL sessione"
                                disabled={isConnecting}
                                className="flex-grow px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition disabled:bg-slate-200"
                            />
                            <button 
                                type="submit"
                                disabled={isConnecting}
                                className="bg-slate-700 text-white font-semibold px-6 py-3 rounded-lg hover:bg-slate-800 disabled:bg-slate-500 transition"
                            >
                                Unisciti
                            </button>
                        </form>
                        {joinError && <p className="text-red-500 text-sm">{joinError}</p>}
                    </div>
                </div>

                {/* Offline Card */}
                <div className="bg-white p-8 rounded-2xl shadow-lg flex flex-col">
                     <div className="flex items-center gap-3 mb-4">
                        <DesktopIcon className="w-8 h-8 text-slate-500" />
                        <h2 className="text-2xl font-bold text-slate-800">Sessione Locale</h2>
                    </div>
                    <p className="text-slate-600 mb-6 flex-grow">Lavora in modalità offline. Tutti i dati raccolti verranno salvati esclusivamente sul tuo dispositivo attuale.</p>
                    <button 
                        onClick={onStartLocal}
                        disabled={isConnecting}
                        className="w-full bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-lg hover:bg-slate-300 disabled:bg-slate-100 transition mt-auto"
                    >
                        Continua Offline
                    </button>
                </div>

            </div>
             {error && <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">{error}</div>}
        </div>
    );
};

export default WelcomePage;
