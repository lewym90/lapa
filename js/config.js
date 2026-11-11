export const VERSION = '1.1.0';
const q = new URLSearchParams(location.search);
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
// Adres serwera. Parametr ?api= działa tylko na localhost (do testów).
export const API = (isLocal && q.get('api')) || 'https://188-68-247-201.sslip.io/lapa';
export const COORD_IDLE_MS = 60 * 60 * 1000; // blokada danych osobowych po godzinie bez aktywności
export const SITE = 'https://www.schronisko-nowodwor.com.pl';
// Kolekcje zapisywane tylko w tym telefonie (nie synchronizowane)
export const LOCAL_ONLY = new Set(['moje_zadania']);
