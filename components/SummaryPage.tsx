import React, { useMemo, useState, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { InterviewData, TravelMode, Location, PaymentType } from '../types';
import { CarIcon, BusIcon, FormIcon, DownloadIcon, TrashIcon, UploadIcon } from './icons';

interface SummaryPageProps {
  interviews: InterviewData[];
  clearInterviews: () => void;
  replaceInterviews: (interviews: InterviewData[]) => Promise<void>;
}

type Tab = 'combined' | Location;

const SummaryPage: React.FC<SummaryPageProps> = ({ interviews, clearInterviews, replaceInterviews }) => {
  const [activeTab, setActiveTab] = useState<Tab>('combined');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredInterviews = useMemo(() => {
    return interviews.filter(interview => {
        if (!startDate && !endDate) {
            return true;
        }
        const interviewDate = new Date(interview.interviewDateTime);

        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (interviewDate < start) return false;
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (interviewDate > end) return false;
        }

        return true;
    });
  }, [interviews, startDate, endDate]);

  const calculateMetrics = (currentInterviews: InterviewData[]) => {
    const totalParkingLoss = currentInterviews
      .filter(i => i.previousTravelMode === TravelMode.CAR && i.usesParkAndRide)
      .reduce((sum, i) => sum + i.previousWeeklyCost, 0);

    const totalTplLoss = currentInterviews
      .filter(i => i.previousTravelMode === TravelMode.TPL && i.usesParkAndRide)
      .reduce((sum, i) => sum + i.previousWeeklyCost, 0);
      
    const totalWeeklyLoss = totalParkingLoss + totalTplLoss;
    
    return {
      totalParkingLoss,
      totalTplLoss,
      totalWeeklyLoss,
      totalInterviews: currentInterviews.length,
    };
  };

  const summary = useMemo(() => {
    const darmiparkInterviews = filteredInterviews.filter(i => i.location === Location.DARMIPARK);
    const palaparkInterviews = filteredInterviews.filter(i => i.location === Location.PALAPARK);

    return {
      [Location.DARMIPARK]: calculateMetrics(darmiparkInterviews),
      [Location.PALAPARK]: calculateMetrics(palaparkInterviews),
      combined: calculateMetrics(filteredInterviews),
    };
  }, [filteredInterviews]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };
  
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) { return "Data non valida"; }
  };
  
  const currentData = summary[activeTab];

  const chartData = [
    { name: 'Sosta Auto', "Mancato Introito Settimanale": currentData.totalParkingLoss },
    { name: 'Trasporto Pubblico', "Mancato Introito Settimanale": currentData.totalTplLoss },
  ];

  const handleExport = () => {
    if (filteredInterviews.length === 0) {
      return;
    }

    const headers = [
      'ID',
      'Data e Ora Intervista',
      'Località',
      'Spostamento Precedente',
      'Tipo Pagamento Precedente',
      'Costo Settimanale Precedente',
      'Utilizza Park & Ride'
    ];
    
    const escapeCsvCell = (cell: string | number | boolean) => {
        const str = String(cell);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = filteredInterviews.map(i => [
      escapeCsvCell(i.id),
      escapeCsvCell(formatDateTime(i.interviewDateTime)),
      escapeCsvCell(i.location),
      escapeCsvCell(i.previousTravelMode),
      escapeCsvCell(i.previousPaymentType === "NONE" ? "-" : i.previousPaymentType),
      escapeCsvCell(String(i.previousWeeklyCost.toFixed(2)).replace('.', ',')),
      escapeCsvCell(i.usesParkAndRide ? 'Sì' : 'No')
    ].join(';'));

    const csvHeader = headers.join(';');
    const csvContent = "\uFEFF" + csvHeader + '\n' + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `esportazione_interviste_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (csvText: string): InterviewData[] => {
    let text = csvText;
    if (text.startsWith('\uFEFF')) {
        text = text.substring(1);
    }
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
        throw new Error('Il file CSV è vuoto o contiene solo l\'intestazione.');
    }
    const headers = lines[0].split(';').map(h => h.trim());
    const expectedHeaders = [
        'ID', 'Data e Ora Intervista', 'Località', 'Spostamento Precedente',
        'Tipo Pagamento Precedente', 'Costo Settimanale Precedente', 'Utilizza Park & Ride'
    ];

    if (headers.length !== expectedHeaders.length || !headers.every((h, i) => h === expectedHeaders[i])) {
        throw new Error(`Intestazioni del file non valide. Attese: ${expectedHeaders.join('; ')}`);
    }
    
    return lines.slice(1).map((line, index) => {
        if (!line.trim()) return null;
        const values = line.split(';');

        const rowNum = index + 2;
        if (values.length !== headers.length) throw new Error(`Numero di colonne errato alla riga ${rowNum}.`);
        
        const rowData: { [key: string]: string } = headers.reduce((obj, header, i) => ({ ...obj, [header]: values[i]?.trim() }), {});

        const isLocation = (v: string): v is Location => Object.values(Location).includes(v as Location);
        const isTravelMode = (v: string): v is TravelMode => Object.values(TravelMode).includes(v as TravelMode);
        const isPaymentType = (v: string): v is PaymentType => Object.values(PaymentType).includes(v as PaymentType);

        const location = rowData['Località'];
        if (!isLocation(location)) throw new Error(`Valore località non valido "${location}" alla riga ${rowNum}`);
        
        const previousTravelMode = rowData['Spostamento Precedente'];
        if (!isTravelMode(previousTravelMode)) throw new Error(`Valore modalità di spostamento non valido "${previousTravelMode}" alla riga ${rowNum}`);

        let previousPaymentType = rowData['Tipo Pagamento Precedente'];
        if (previousPaymentType === "-") previousPaymentType = PaymentType.NONE;
        if (!isPaymentType(previousPaymentType)) throw new Error(`Valore tipo di pagamento non valido "${previousPaymentType}" alla riga ${rowNum}`);
        
        const dateStr = rowData['Data e Ora Intervista'].replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/, '$3-$2-$1T$4:$5:00');
        const interviewDate = new Date(dateStr);
        if (isNaN(interviewDate.getTime())) throw new Error(`Formato data non valido "${rowData['Data e Ora Intervista']}" alla riga ${rowNum}`);

        const weeklyCost = parseFloat(rowData['Costo Settimanale Precedente'].replace(',', '.'));
        if (isNaN(weeklyCost)) throw new Error(`Costo settimanale non valido "${rowData['Costo Settimanale Precedente']}" alla riga ${rowNum}`);

        return {
            id: rowData['ID'],
            interviewDateTime: interviewDate.toISOString(),
            location,
            previousTravelMode,
            previousPaymentType,
            previousWeeklyCost: weeklyCost,
            usesParkAndRide: rowData['Utilizza Park & Ride'].toLowerCase() === 'sì'
        };
    }).filter((item): item is InterviewData => item !== null);
  };
    
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const target = event.target;
    if (!file) { return; }

    if (window.confirm("Sei sicuro di voler importare questo file? Tutti i dati attuali verranno sostituiti. L'operazione è irreversibile.")) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error('Impossibile leggere il file.');
                const parsedInterviews = parseCSV(text);
                await replaceInterviews(parsedInterviews);
            } catch (error) {
                alert(`Errore durante l'analisi del file CSV: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                if (target) target.value = '';
            }
        };
        reader.onerror = () => {
             alert('Errore nella lettura del file.');
             if (target) target.value = '';
        }
        reader.readAsText(file, 'UTF-8');
    } else {
        if (target) target.value = '';
    }
  };

  if (interviews.length === 0) {
    return (
        <div className="text-center p-10 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10 space-y-4">
            <h2 className="text-2xl font-semibold text-slate-700">Nessuna intervista registrata.</h2>
            <p className="text-slate-500">Vai alla pagina 'Intervista' per aggiungerne una, oppure importa i dati da un file CSV.</p>
            <div>
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-emerald-600 transition flex items-center gap-2 mx-auto"
                >
                    <UploadIcon className="w-5 h-5" />
                    <span>Importa Dati</span>
                </button>
            </div>
        </div>
    );
  }

  const renderContent = () => (
    <div className="space-y-8">
       {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="N. Interviste" 
            value={currentData.totalInterviews.toString()} 
            period={activeTab === 'combined' ? 'Filtrate in totale' : `Filtrate a ${activeTab}`}
            icon={<FormIcon className="w-8 h-8 text-purple-500" />} 
        />
        <StatCard title="Mancato Introito Sosta" value={formatCurrency(currentData.totalParkingLoss)} period="settimanale" icon={<CarIcon className="w-8 h-8 text-sky-500" />} />
        <StatCard title="Mancato Introito TPL" value={formatCurrency(currentData.totalTplLoss)} period="settimanale" icon={<BusIcon className="w-8 h-8 text-emerald-500" />} />
        <StatCardTotal title="Mancato Introito Totale" value={formatCurrency(currentData.totalWeeklyLoss)} period="settimanale" />
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h3 className="text-xl font-semibold text-slate-700 mb-4">Visualizzazione Mancato Introito Settimanale</h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `€${value}`} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), 'Introito perso']} />
              <Legend />
              <Bar dataKey="Mancato Introito Settimanale" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Projections */}
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h3 className="text-xl font-semibold text-slate-700 mb-6 text-center">Proiezioni del Mancato Introito</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <ProjectionBreakdownCard title="Giornaliero" totalLoss={currentData.totalWeeklyLoss / 5} parkingLoss={currentData.totalParkingLoss / 5} tplLoss={currentData.totalTplLoss / 5} />
            <ProjectionBreakdownCard title="Mensile" totalLoss={currentData.totalWeeklyLoss * 4.33} parkingLoss={currentData.totalParkingLoss * 4.33} tplLoss={currentData.totalTplLoss * 4.33} />
            <ProjectionBreakdownCard title="Annuale" totalLoss={currentData.totalWeeklyLoss * 52} parkingLoss={currentData.totalParkingLoss * 52} tplLoss={currentData.totalTplLoss * 52} />
        </div>
      </div>

       {/* Interview List */}
       <div className="bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-slate-700">Dettaglio Interviste ({filteredInterviews.length})</h3>
            <div className="flex items-center gap-2">
               <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
               <button 
                onClick={() => fileInputRef.current?.click()} 
                className="bg-emerald-500 text-white font-semibold px-3 py-2 rounded-lg hover:bg-emerald-600 transition flex items-center gap-2" 
                title="Importa da CSV"
              >
                  <UploadIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Importa</span>
              </button>
               <button 
                onClick={handleExport} 
                className="bg-sky-500 text-white font-semibold px-3 py-2 rounded-lg hover:bg-sky-600 transition flex items-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed" 
                title="Esporta in CSV"
                disabled={filteredInterviews.length === 0}
              >
                  <DownloadIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Esporta</span>
              </button>
              <button 
                onClick={() => {if(window.confirm('Sei sicuro di voler cancellare tutti i dati? L\'operazione è irreversibile.')) clearInterviews()}} 
                className="bg-red-500 text-white font-semibold px-3 py-2 rounded-lg hover:bg-red-600 transition flex items-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed" 
                title="Cancella tutti i dati"
                disabled={interviews.length === 0}
              >
                  <TrashIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Cancella</span>
              </button>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="p-3 font-semibold text-slate-600">Data e Ora</th>
                        <th className="p-3 font-semibold text-slate-600">Località</th>
                        <th className="p-3 font-semibold text-slate-600">Spostamento Prec.</th>
                        <th className="p-3 font-semibold text-slate-600">Tipo Pagamento Prec.</th>
                        <th className="p-3 font-semibold text-slate-600 text-right">Costo Sett. Prec.</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredInterviews.map(interview => (
                        <tr key={interview.id} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="p-3">{formatDateTime(interview.interviewDateTime)}</td>
                            <td className="p-3">{interview.location}</td>
                            <td className="p-3">{interview.previousTravelMode}</td>
                            <td className="p-3">{interview.previousPaymentType === "NONE" ? "-" : interview.previousPaymentType}</td>
                            <td className="p-3 text-right font-mono">{formatCurrency(interview.previousWeeklyCost)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col items-center">
        <h2 className="text-3xl font-bold text-slate-800 text-center">Riepilogo Risultati</h2>
        <div className="mt-6 bg-slate-200 p-1.5 rounded-full flex space-x-2">
            <TabButton label="Totale" isActive={activeTab === 'combined'} onClick={() => setActiveTab('combined')} />
            <TabButton label="Darmipark" isActive={activeTab === Location.DARMIPARK} onClick={() => setActiveTab(Location.DARMIPARK)} />
            <TabButton label="Palapark" isActive={activeTab === Location.PALAPARK} onClick={() => setActiveTab(Location.PALAPARK)} />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h3 className="text-xl font-semibold text-slate-700 mb-4">Filtra per Periodo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-2">
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-600 mb-1">Da</label>
                <input 
                    type="date" 
                    id="startDate" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
            </div>
            <div className="lg:col-span-2">
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-600 mb-1">A</label>
                <input 
                    type="date" 
                    id="endDate" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    min={startDate}
                />
            </div>
            <div className="lg:col-span-1">
                <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }} 
                    className="w-full bg-slate-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-600 transition"
                >
                    Resetta
                </button>
            </div>
        </div>
      </div>


      <div className="mt-4">
        {filteredInterviews.length > 0 ? (
            renderContent()
        ) : (
            <div className="text-center p-10 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold text-slate-700">Nessun dato trovato.</h2>
                <p className="text-slate-500 mt-2">Prova a modificare il periodo selezionato o a resettare il filtro.</p>
            </div>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} className={`px-4 sm:px-6 py-2 rounded-full text-sm sm:text-base font-semibold transition ${isActive ? 'bg-white text-indigo-600 shadow' : 'text-slate-600 hover:bg-slate-300/50'}`}>
        {label}
    </button>
);


const StatCard: React.FC<{ title: string; value: string; period: string; icon: React.ReactNode }> = ({ title, value, period, icon }) => (
    <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center space-x-4">
        <div className="bg-slate-100 p-3 rounded-full">{icon}</div>
        <div>
            <h4 className="text-slate-500 font-medium">{title}</h4>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
            <p className="text-sm text-slate-400">{period}</p>
        </div>
    </div>
);

const StatCardTotal: React.FC<{ title: string; value: string; period: string; }> = ({ title, value, period }) => (
    <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg">
        <h4 className="font-medium opacity-80">{title}</h4>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm opacity-70">{period}</p>
    </div>
);

const ProjectionBreakdownCard: React.FC<{ title: string; totalLoss: number; parkingLoss: number; tplLoss: number }> = ({ title, totalLoss, parkingLoss, tplLoss }) => {
    const formatCurrency = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
    
    return (
        <div className="bg-slate-50 p-4 rounded-xl space-y-2">
            <h4 className="text-lg font-semibold text-slate-600">{title}</h4>
            <p className="text-3xl font-bold text-slate-800">{formatCurrency(totalLoss)}</p>
            <div className="text-sm text-slate-500 pt-1">
                <p>Sosta: {formatCurrency(parkingLoss)}</p>
                <p>TPL: {formatCurrency(tplLoss)}</p>
            </div>
        </div>
    );
};

export default SummaryPage;