import React, { useState } from 'react';
import { TravelMode, PaymentType, CostFrequency, InterviewData, Location } from '../types';

interface InterviewPageProps {
  addInterview: (interview: InterviewData) => Promise<void>;
}

const InterviewPage: React.FC<InterviewPageProps> = ({ addInterview }) => {
  const [location, setLocation] = useState<Location | null>(null);
  const [previousTravelMode, setPreviousTravelMode] = useState<TravelMode>(TravelMode.NONE);
  const [previousPaymentType, setPreviousPaymentType] = useState<PaymentType>(PaymentType.NONE);
  const [cost, setCost] = useState<string>('');
  const [costFrequency, setCostFrequency] = useState<CostFrequency>(CostFrequency.WEEKLY);
  const [usesParkAndRide, setUsesParkAndRide] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const normalizeCostToWeekly = (costValue: number, frequency: CostFrequency): number => {
    switch (frequency) {
      case CostFrequency.DAILY:
        return costValue * 5; // Assuming a 5-day week
      case CostFrequency.WEEKLY:
        return costValue;
      case CostFrequency.MONTHLY:
        return (costValue * 12) / 52;
      default:
        return 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!location) {
      setError('Selezionare una località.');
      return;
    }

    if (previousTravelMode === TravelMode.NONE) {
      setError('Selezionare una modalità di spostamento precedente.');
      return;
    }
    
    let weeklyCost = 0;
    if (previousTravelMode !== TravelMode.ALTRO) {
        const costValue = parseFloat(cost.replace(',', '.'));
        if (isNaN(costValue) || costValue < 0) {
          setError('Inserire un costo valido.');
          return;
        }
        
        if (previousPaymentType === PaymentType.NONE) {
            setError('Selezionare un tipo di pagamento.');
            return;
        }
        weeklyCost = normalizeCostToWeekly(costValue, costFrequency);
    }


    const newInterview: InterviewData = {
      id: new Date().toISOString() + Math.random(), // Add randomness to avoid collision
      location,
      previousTravelMode,
      previousPaymentType: previousTravelMode === TravelMode.ALTRO ? PaymentType.NONE : previousPaymentType,
      previousWeeklyCost: weeklyCost,
      usesParkAndRide,
      interviewDateTime: new Date().toISOString(),
    };
    
    setIsSaving(true);
    try {
        await addInterview(newInterview);
        setSuccess('Intervista aggiunta con successo!');
        
        // Reset form
        setLocation(null);
        setPreviousTravelMode(TravelMode.NONE);
        setPreviousPaymentType(PaymentType.NONE);
        setCost('');
        setCostFrequency(CostFrequency.WEEKLY);
        setUsesParkAndRide(true);

        setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
        setError(error instanceof Error ? error.message : "Salvataggio fallito. Riprova.");
    } finally {
        setIsSaving(false);
    }

  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl shadow-lg space-y-8">
        <h2 className="text-3xl font-bold text-slate-800 text-center">Modulo Intervista</h2>
        
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p>{error}</p></div>}
        {success && <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert"><p>{success}</p></div>}
        
        <fieldset className="space-y-4">
            <legend className="text-xl font-semibold text-slate-700 mb-2">1. Seleziona la località</legend>
            <div className="flex flex-col sm:flex-row gap-4">
                <RadioCard
                    id="darmipark"
                    name="location"
                    value={Location.DARMIPARK}
                    checked={location === Location.DARMIPARK}
                    onChange={(e) => setLocation(e.target.value as Location)}
                    label="Darmipark"
                    disabled={isSaving}
                />
                <RadioCard
                    id="palapark"
                    name="location"
                    value={Location.PALAPARK}
                    checked={location === Location.PALAPARK}
                    onChange={(e) => setLocation(e.target.value as Location)}
                    label="Palapark"
                    disabled={isSaving}
                />
            </div>
        </fieldset>
        
        <fieldset className="space-y-4">
          <legend className="text-xl font-semibold text-slate-700 mb-2">2. Prima del parcheggio, come ti spostavi?</legend>
          <div className="flex flex-col sm:flex-row gap-4">
            <RadioCard
              id="car"
              name="travelMode"
              value={TravelMode.CAR}
              checked={previousTravelMode === TravelMode.CAR}
              onChange={(e) => setPreviousTravelMode(e.target.value as TravelMode)}
              label="Auto Privata"
              disabled={isSaving}
            />
            <RadioCard
              id="tpl"
              name="travelMode"
              value={TravelMode.TPL}
              checked={previousTravelMode === TravelMode.TPL}
              onChange={(e) => setPreviousTravelMode(e.target.value as TravelMode)}
              label="Trasporto Pubblico (TPL)"
              disabled={isSaving}
            />
             <RadioCard
              id="other"
              name="travelMode"
              value={TravelMode.ALTRO}
              checked={previousTravelMode === TravelMode.ALTRO}
              onChange={(e) => setPreviousTravelMode(e.target.value as TravelMode)}
              label="Altro"
              disabled={isSaving}
            />
          </div>
        </fieldset>

        {previousTravelMode !== TravelMode.NONE && previousTravelMode !== TravelMode.ALTRO && (
          <>
            <fieldset className="space-y-4">
              <legend className="text-xl font-semibold text-slate-700 mb-2">3. Come pagavi per la {previousTravelMode === TravelMode.CAR ? 'sosta' : 'corsa'}?</legend>
              <div className="flex flex-col sm:flex-row gap-4">
                 <RadioCard
                    id="ticket"
                    name="paymentType"
                    value={PaymentType.TICKET}
                    checked={previousPaymentType === PaymentType.TICKET}
                    onChange={(e) => setPreviousPaymentType(e.target.value as PaymentType)}
                    label={previousTravelMode === TravelMode.CAR ? 'Ticket Parcheggio' : 'Biglietto Singolo'}
                    disabled={isSaving}
                />
                 <RadioCard
                    id="subscription"
                    name="paymentType"
                    value={PaymentType.SUBSCRIPTION}
                    checked={previousPaymentType === PaymentType.SUBSCRIPTION}
                    onChange={(e) => setPreviousPaymentType(e.target.value as PaymentType)}
                    label="Abbonamento"
                    disabled={isSaving}
                />
              </div>
            </fieldset>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="cost" className="block text-lg font-medium text-slate-600 mb-2">4. Costo (€)</label>
                <input
                  id="cost"
                  type="text"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="Es. 10,50"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-slate-200"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label htmlFor="frequency" className="block text-lg font-medium text-slate-600 mb-2">Frequenza del costo</label>
                <select
                  id="frequency"
                  value={costFrequency}
                  onChange={(e) => setCostFrequency(e.target.value as CostFrequency)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-slate-200"
                  disabled={isSaving}
                >
                  <option value={CostFrequency.DAILY}>Giornaliero</option>
                  <option value={CostFrequency.WEEKLY}>Settimanale</option>
                  <option value={CostFrequency.MONTHLY}>Mensile</option>
                </select>
              </div>
            </div>
          </>
        )}

        <fieldset className="space-y-2">
           <legend className="text-xl font-semibold text-slate-700 mb-2">5. Ora utilizzi il nuovo parcheggio d'interscambio?</legend>
           <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <input
                    id="usesParkAndRide"
                    type="checkbox"
                    checked={usesParkAndRide}
                    onChange={(e) => setUsesParkAndRide(e.target.checked)}
                    className="h-6 w-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:bg-slate-200"
                    disabled={isSaving}
                />
                <label htmlFor="usesParkAndRide" className="text-lg text-slate-700">Sì, utilizzo il parcheggio gratuito</label>
            </div>
        </fieldset>

        <div className="pt-4">
          <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105 disabled:bg-indigo-400 disabled:scale-100 disabled:cursor-not-allowed">
            {isSaving ? 'Salvataggio...' : 'Salva Intervista'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface RadioCardProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

const RadioCard: React.FC<RadioCardProps> = ({ id, label, disabled, ...props }) => {
    return (
        <label htmlFor={id} className={`flex-1 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
            <input type="radio" id={id} className="sr-only peer" disabled={disabled} {...props} />
            <div className={`w-full text-center p-4 rounded-lg border-2 border-slate-300 ${disabled ? '' : 'cursor-pointer'} peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-600 peer-checked:font-semibold transition`}>
                {label}
            </div>
        </label>
    );
};


export default InterviewPage;
