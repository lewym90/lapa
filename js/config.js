export const VERSION = '1.16.0';
const q = new URLSearchParams(location.search);
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
// Adres serwera. Parametr ?api= działa tylko na localhost (do testów).
export const API = (isLocal && q.get('api')) || 'https://188-68-247-201.sslip.io/lapa';
// Wolontariusz zapisuje tylko własne zgłoszenia (to samo pilnuje serwer: VOL_WRITE w lapa-server.mjs).
export const VOL_WRITE = new Set(['deklaracje', 'zgloszenia', 'oferty', 'p_tel']);
export const SITE = 'https://www.schronisko-nowodwor.com.pl';
// Kolekcje zapisywane tylko w tym telefonie (nie synchronizowane)
export const LOCAL_ONLY = new Set(['moje_zadania']);
