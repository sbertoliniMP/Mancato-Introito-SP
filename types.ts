export enum Location {
  DARMIPARK = 'Darmipark',
  PALAPARK = 'Palapark',
}

export enum TravelMode {
  NONE = 'NONE',
  CAR = 'AUTO',
  TPL = 'TPL',
  ALTRO = 'ALTRO',
}

export enum PaymentType {
  NONE = 'NONE',
  TICKET = 'TICKET',
  SUBSCRIPTION = 'ABBONAMENTO',
}

export enum CostFrequency {
  DAILY = 'GIORNALIERO',
  WEEKLY = 'SETTIMANALE',
  MONTHLY = 'MENSILE',
}

export interface InterviewData {
  id: string;
  location: Location;
  previousTravelMode: TravelMode;
  previousPaymentType: PaymentType;
  previousWeeklyCost: number;
  usesParkAndRide: boolean;
  interviewDateTime: string;
}