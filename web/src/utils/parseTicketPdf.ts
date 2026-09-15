/**
 * Parses an airline e-ticket / itinerary PDF and extracts the traveler's
 * name plus the inbound and outbound legs to/from the project city.
 *
 * Different agencies and airlines export wildly different layouts, so this
 * tries a handful of known formats (in order) and falls back to a clear
 * error — prompting manual entry — when none match:
 *
 *   1. "National Travel"-style GDS itinerary (also covers similar agency
 *      itineraries): blocks of "<Airline> Flight Number <NNNN>
 *      Confirmation: <PNR> Departure: <day>, MM/DD/YYYY <h:mm AM/PM>
 *      Arrival: <day>, MM/DD/YYYY <h:mm AM/PM> ... Departure City: <city>
 *      (<CODE>) Arrival City: <city> (<CODE>)", with a
 *      "Passenger Names LASTNAME.../FIRSTNAME" header.
 *   2. Airline-issued "Electronic Ticket Receipt" (e.g. MIAT): a
 *      From/To/Flight/Departure/Arrival table — "Passenger: Lastname
 *      Firstname Mr (ADT)" plus rows like "<FROM> <TO> OM138 14:20
 *      14Sep2026 04:40 15Sep2026".
 *   3. CTM-style e-invoice itinerary (original format this parser
 *      supported): "DATE: ..." blocks with "Flight AIRLINE FLIGHTNO
 *      [Operated by AIRLINE]", "From CITY Departs HH:MMam/pm", "To CITY
 *      Arrives HH:MMam/pm".
 */
import { extractPdfText } from './pdfExtract';

export interface ParsedTicketResult {
  /** Display name: "Firstname Lastname" */
  firstName:        string;
  lastName:         string;
  /** ISO date "YYYY-MM-DD" or '' */
  arrivalDate:      string;
  /** e.g. "LUFTHANSA 8756" or "Turkish Airlines TK236" */
  arrivalFlight:    string;
  /** "HH:MM" 24-h */
  arrivalTime:      string;
  arrivalCity:      string;
  departureDate:    string;
  departureFlight:  string;
  departureTime:    string;
  departureCity:    string;
}

function emptyResult(firstName = '', lastName = ''): ParsedTicketResult {
  return {
    firstName, lastName,
    arrivalDate: '', arrivalFlight: '', arrivalTime: '', arrivalCity: '',
    departureDate: '', departureFlight: '', departureTime: '', departureCity: '',
  };
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
  Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function parseTime12(raw: string): string {
  // "6:20pm" → "18:20",  "3:55am" → "03:55",  "11:15am" → "11:15"
  const m = raw.replace(/\s/g, '').match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const mn = m[2];
  const ap = m[3].toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${pad2(h)}:${mn}`;
}

/** "09/16/2026" (MM/DD/YYYY) → "2026-09-16" */
function parseDateSlash(mm: string, dd: string, yyyy: string): string {
  return `${yyyy}-${pad2(parseInt(mm, 10))}-${pad2(parseInt(dd, 10))}`;
}

/** "14Sep2026" (DDMonYYYY) → "2026-09-14" */
function parseDateCompact(raw: string): string {
  const m = raw.trim().match(/^(\d{2})([A-Za-z]{3})(\d{4})$/);
  if (!m) return '';
  const month = MONTH_MAP[m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()];
  if (!month) return '';
  return `${m[3]}-${pad2(month)}-${m[1]}`;
}

/** Known airline name → { IATA code, display label }. Used only for formats
 * (like the National Travel itinerary) that print the airline's full name
 * next to a bare flight number, with no code anywhere on the ticket.
 * Unmapped airlines fall back to their title-cased name with no code. */
const AIRLINE_INFO: Record<string, { code: string; label: string }> = {
  'TURKISH AIRLINES':       { code: 'TK', label: 'Turkish Airlines' },
  'MIAT MONGOLIAN AIRLINES':{ code: 'OM', label: 'MIAT' },
  'LUFTHANSA':              { code: 'LH', label: 'Lufthansa' },
  'AIR FRANCE':             { code: 'AF', label: 'Air France' },
  'KLM':                    { code: 'KL', label: 'KLM' },
  'BRITISH AIRWAYS':        { code: 'BA', label: 'British Airways' },
  'EMIRATES':               { code: 'EK', label: 'Emirates' },
  'QATAR AIRWAYS':          { code: 'QR', label: 'Qatar Airways' },
  'ETIHAD AIRWAYS':         { code: 'EY', label: 'Etihad' },
  'SINGAPORE AIRLINES':     { code: 'SQ', label: 'Singapore Airlines' },
  'CATHAY PACIFIC':         { code: 'CX', label: 'Cathay Pacific' },
  'ALL NIPPON AIRWAYS':     { code: 'NH', label: 'ANA' },
  'JAPAN AIRLINES':         { code: 'JL', label: 'Japan Airlines' },
  'KOREAN AIR':             { code: 'KE', label: 'Korean Air' },
  'ASIANA AIRLINES':        { code: 'OZ', label: 'Asiana' },
  'UNITED AIRLINES':        { code: 'UA', label: 'United' },
  'AMERICAN AIRLINES':      { code: 'AA', label: 'American' },
  'DELTA AIR LINES':        { code: 'DL', label: 'Delta' },
  'AIR CANADA':             { code: 'AC', label: 'Air Canada' },
  'SWISS':                  { code: 'LX', label: 'Swiss' },
  'AUSTRIAN AIRLINES':      { code: 'OS', label: 'Austrian' },
  'FINNAIR':                { code: 'AY', label: 'Finnair' },
  'SAS':                    { code: 'SK', label: 'SAS' },
  'IBERIA':                 { code: 'IB', label: 'Iberia' },
  'ITA AIRWAYS':            { code: 'AZ', label: 'ITA Airways' },
  'AEROFLOT':               { code: 'SU', label: 'Aeroflot' },
  'CHINA SOUTHERN':         { code: 'CZ', label: 'China Southern' },
  'CHINA EASTERN':          { code: 'MU', label: 'China Eastern' },
  'AIR CHINA':              { code: 'CA', label: 'Air China' },
  'THAI AIRWAYS':           { code: 'TG', label: 'Thai Airways' },
  'MALAYSIA AIRLINES':      { code: 'MH', label: 'Malaysia Airlines' },
  'EVA AIR':                { code: 'BR', label: 'EVA Air' },
  'CHINA AIRLINES':         { code: 'CI', label: 'China Airlines' },
  'EGYPTAIR':               { code: 'MS', label: 'EgyptAir' },
  'ETHIOPIAN AIRLINES':     { code: 'ET', label: 'Ethiopian' },
  'AIR ASTANA':             { code: 'KC', label: 'Air Astana' },
  'UZBEKISTAN AIRWAYS':     { code: 'HY', label: 'Uzbekistan Airways' },
};

/** "Turkish Airlines" + "0236" → "Turkish Airlines TK236" (leading zeros
 * stripped; falls back to the raw airline name if it isn't in the map). */
function formatFlightFromName(airlineRaw: string, flightNoRaw: string): string {
  const info = AIRLINE_INFO[airlineRaw.trim().toUpperCase()];
  const num = String(parseInt(flightNoRaw, 10));
  if (info) return `${info.label} ${info.code}${num}`;
  return `${titleCase(airlineRaw)} ${num}`;
}

// ─── Format 1: National Travel / agency GDS itinerary ─────────────────────

const NATIONAL_TRAVEL_MARKER = /Flight Number\s+\d+\s+Confirmation\s*:/i;

function parseNationalTravel(text: string, projectCityUpper: string): ParsedTicketResult {
  const nameM = text.match(/Passenger Names?\s+([A-Z]+(?:\s[A-Z]+)*)\/([A-Z]+)/);
  const lastName  = nameM ? titleCase(nameM[1]) : '';
  const firstName = nameM ? titleCase(nameM[2]) : '';
  const result = emptyResult(firstName, lastName);

  // Airline name capped at 4 words so the lazy match can't run away across
  // unrelated preceding text when the nearest word boundary is far off
  // (e.g. the first "Flight Number" in the document, with a long clean
  // alphabetic run of body copy before it).
  const legRe = /([A-Za-z]+(?:[ .]+[A-Za-z]+){0,3})\s+Flight Number\s+(\d+)\s+Confirmation:\s*\S+\s+Departure:\s*[A-Za-z]{3},\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)\s+Arrival:\s*[A-Za-z]{3},\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M).*?Departure City:\s*([^()]+?)\s*\(([A-Z]{3})\)\s*Arrival City:\s*([^()]+?)\s*\(([A-Z]{3})\)/g;

  let m: RegExpExecArray | null;
  while ((m = legRe.exec(text))) {
    const [, airline, flightNo, depMM, depDD, depYYYY, depTimeRaw, arrMM, arrDD, arrYYYY, arrTimeRaw, depCity, depCode, arrCity, arrCode] = m;
    const flight = formatFlightFromName(airline, flightNo);

    if (!result.arrivalFlight && (arrCity.toUpperCase().includes(projectCityUpper) || arrCode === projectCityUpper)) {
      result.arrivalDate   = parseDateSlash(arrMM, arrDD, arrYYYY);
      result.arrivalTime   = parseTime12(arrTimeRaw);
      result.arrivalFlight = flight;
      result.arrivalCity   = arrCity.trim();
    }
    if (!result.departureFlight && (depCity.toUpperCase().includes(projectCityUpper) || depCode === projectCityUpper)) {
      result.departureDate   = parseDateSlash(depMM, depDD, depYYYY);
      result.departureTime   = parseTime12(depTimeRaw);
      result.departureFlight = flight;
      result.departureCity   = depCity.trim();
    }
  }
  return result;
}

// ─── Format 2: Airline "Electronic Ticket Receipt" (e.g. MIAT) ────────────

const ETICKET_RECEIPT_MARKER = /ELECTRONIC TICKET RECEIPT/i;

/** code (e.g. "OM") → display label (e.g. "MIAT"), derived from AIRLINE_INFO. */
const CODE_TO_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(AIRLINE_INFO).map((info) => [info.code, info.label]),
);

function parseElectronicTicketReceipt(text: string, projectCityUpper: string): ParsedTicketResult {
  const nameM = text.match(/Passenger:\s*([A-Za-z]+)\s+([A-Za-z]+)\s+(?:Mr|Mrs|Ms|Miss|Dr|Prof)\b/i);
  const lastName  = nameM ? titleCase(nameM[1]) : '';
  const firstName = nameM ? titleCase(nameM[2]) : '';
  const result = emptyResult(firstName, lastName);

  // Terminal callouts land in an unpredictable spot within a row (whichever
  // city happens to have one) — strip them so they don't get mistaken for
  // part of a city name.
  const cleaned = text.replace(/Terminal:\s*\d+/gi, ' ');

  // The PDF's horizontal-rule dividers between flight rows extract as a
  // literal "_" — split on those so each block holds exactly one row's
  // From/To city names with nothing bleeding in from the previous row.
  const blocks = cleaned.split('_');

  const legRe = /([A-Z]{1,2})(\d{2,4})\s+(\d{2}:\d{2})\s+(\d{2}[A-Za-z]{3}\d{4})\s+(\d{2}:\d{2})\s+(\d{2}[A-Za-z]{3}\d{4})/;

  for (const block of blocks) {
    const m = block.match(legRe);
    if (!m) continue;
    const [, codeLetters, codeNum, depTime, depDateRaw, arrTime, arrDateRaw] = m;
    const flightCode = codeLetters + codeNum;

    const opM = block.match(/Operated by:\s*([A-Z][A-Z .]+)/i);
    const label = (opM && AIRLINE_INFO[opM[1].trim().toUpperCase()]?.label) ?? CODE_TO_LABEL[codeLetters] ?? '';
    const flight = label ? `${label} ${flightCode}` : flightCode;

    // The From/To city names sit directly before the flight code in this
    // block, with no reliable separator between them — locate the project
    // city within that prefix: near the start → this leg departs the
    // project city; near the end (right before the flight code) → this
    // leg arrives in the project city.
    const cityBlob = block.slice(0, m.index).toUpperCase();
    const idx = cityBlob.lastIndexOf(projectCityUpper);
    if (idx < 0) continue;
    const isDeparture = idx < cityBlob.length / 2;

    if (isDeparture && !result.departureFlight) {
      result.departureDate   = parseDateCompact(depDateRaw);
      result.departureTime   = depTime;
      result.departureFlight = flight;
    } else if (!isDeparture && !result.arrivalFlight) {
      result.arrivalDate   = parseDateCompact(arrDateRaw);
      result.arrivalTime   = arrTime;
      result.arrivalFlight = flight;
    }
  }
  return result;
}

// ─── Format 3: CTM-style e-invoice itinerary (original supported format) ──

const CTM_MARKER = /DATE\s*:/i;

interface FlightSegment {
  dateLabel:    string;   // "Jun 03"
  airline:      string;   // "LUFTHANSA"
  flightNo:     string;   // "8756"
  fromCity:     string;   // "MUNICH, GERMANY"
  toCity:       string;   // "TBILISI, GEORGIA"
  departTime:   string;   // "22:00"
  arriveTime:   string;   // "03:55"
  plusOnDay:    boolean;  // "Arrives ... (+1 day)"
}

/** Extract year from "DD Mon YYYY" invoice date line, fallback to current year. */
function inferYear(text: string): number {
  const m = text.match(/INVOICE ISSUE DATE\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
         ?? text.match(/\b(20\d{2})\b/);
  if (m) return parseInt(m[m.length - 1], 10);
  return new Date().getFullYear();
}

/** Parse "Mon DD" with a given year into ISO "YYYY-MM-DD".
 *  Uses local date arithmetic — avoids toISOString() UTC shift
 *  (which would flip midnight to the previous day in UTC+N timezones). */
function parseSegmentDate(raw: string, year: number, plusDays = 0): string {
  const m = raw.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!m) return '';
  const month = MONTH_MAP[m[1]];
  if (!month) return '';
  // Use Date only for carry arithmetic (e.g. Jun 30 + 1 → Jul 01)
  const d = new Date(year, month - 1, parseInt(m[2], 10) + plusDays);
  const y  = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const dy = pad2(d.getDate());
  return `${y}-${mo}-${dy}`;
}

/**
 * Normalise airline name to operator: if "Operated by X" is present, use X.
 * Returns { airline, flightNo }.
 */
function parseFlightLine(raw: string): { airline: string; flightNo: string } {
  // "UNITED AIRLINES 8756 Operated by LUFTHANSA"
  // "LUFTHANSA 2559"
  const opMatch = raw.match(/Operated\s+by\s+([A-Z &]+\b\s*[A-Z]*)/i);
  const mainMatch = raw.match(/^Flight\s+(.*?)\s+(\d+)\s*(Operated.*)?$/i);
  if (!mainMatch) return { airline: '', flightNo: '' };
  const airline = opMatch
    ? opMatch[1].trim()
    : mainMatch[1].trim();
  return { airline, flightNo: mainMatch[2] };
}

function parseCtmSegments(text: string): FlightSegment[] {
  // Split on "DATE:" markers
  const chunks = text.split(/DATE\s*:/i).slice(1);
  const segments: FlightSegment[] = [];

  for (const chunk of chunks) {
    // Date label e.g. "Tue, Jun 02" → extract "Jun 02"
    const dateM = chunk.match(/[A-Za-z]{3},\s*([A-Za-z]{3}\s+\d{1,2})/);
    const dateLabel = dateM ? dateM[1] : '';

    // Flight line (may span a couple of tokens — look for pattern)
    const flightM = chunk.match(/Flight\s+([\w\s]+?\d+(?:\s+Operated\s+by\s+[\w\s]+)?)/i);
    if (!flightM) continue;
    const { airline, flightNo } = parseFlightLine('Flight ' + flightM[1]);

    // From / Departs
    const fromM  = chunk.match(/From\s+([\w\s,]+?)(?=\s*Departs|\s*To\b|\s*Departure)/i);
    const departM = chunk.match(/Departs\s+([\d:apmPMAM]+)/i);

    // To / Arrives
    const toM    = chunk.match(/To\s+([\w\s,]+?)(?=\s*Arrives|\s*Arrival|\s*Duration|\s*Departure)/i);
    const arriveM = chunk.match(/Arrives?\s+([\d:apmPMAM]+)/i);
    const plusOne = /\(\s*\+\s*1\s*day\s*\)/i.test(chunk);

    segments.push({
      dateLabel:  dateLabel,
      airline:    airline.toUpperCase(),
      flightNo,
      fromCity:   fromM   ? fromM[1].trim().toUpperCase()   : '',
      toCity:     toM     ? toM[1].trim().toUpperCase()     : '',
      departTime: departM ? parseTime12(departM[1]) : '',
      arriveTime: arriveM ? parseTime12(arriveM[1]) : '',
      plusOnDay:  plusOne,
    });
  }
  return segments;
}

function parseCtm(text: string, projectCityUpper: string): ParsedTicketResult {
  const year     = inferYear(text);
  const segments = parseCtmSegments(text);

  // Format: "LASTNAME/FIRSTNAME MIDDLENAME" or "LASTNAME/FIRSTNAME"
  const nameM = text.match(/([A-Z]+)\/([A-Z]+(?: [A-Z]+)?)/);
  let firstName = '';
  let lastName  = '';
  if (nameM) {
    const parts = nameM[2].split(' ');
    firstName = parts.map(titleCase).join(' ');
    lastName  = titleCase(nameM[1]);
  }
  const result = emptyResult(firstName, lastName);

  const arrSeg = segments.find((s) => s.toCity.includes(projectCityUpper));
  if (arrSeg) {
    const offset = arrSeg.plusOnDay ? 1 : 0;
    result.arrivalDate   = parseSegmentDate(arrSeg.dateLabel, year, offset);
    result.arrivalFlight = `${arrSeg.airline} ${arrSeg.flightNo}`;
    result.arrivalTime   = arrSeg.arriveTime;
    result.arrivalCity   = arrSeg.toCity;
  }

  const depSeg = segments.find((s) => s.fromCity.includes(projectCityUpper));
  if (depSeg) {
    result.departureDate   = parseSegmentDate(depSeg.dateLabel, year);
    result.departureFlight = `${depSeg.airline} ${depSeg.flightNo}`;
    result.departureTime   = depSeg.departTime;
    result.departureCity   = depSeg.fromCity;
  }

  return result;
}

// ─── Main entry point ──────────────────────────────────────────────────────

/**
 * Parse an e-ticket/itinerary PDF and extract the traveler's name plus the
 * legs into/out of the project city. Tries each known format in turn.
 * @param file       The PDF File to parse.
 * @param projectCity The project/event city (e.g. "Ulaanbaatar") to match legs.
 */
export async function parseTicketPdf(
  file:        File,
  projectCity: string,
): Promise<ParsedTicketResult> {
  const text = await extractPdfText(file);
  const cityUpper = projectCity.trim().toUpperCase();
  if (!cityUpper) {
    throw new Error('Enter the event city before uploading tickets, so arrival/departure legs can be identified.');
  }

  let result: ParsedTicketResult | null = null;

  if (NATIONAL_TRAVEL_MARKER.test(text)) {
    result = parseNationalTravel(text, cityUpper);
  } else if (ETICKET_RECEIPT_MARKER.test(text)) {
    result = parseElectronicTicketReceipt(text, cityUpper);
  } else if (CTM_MARKER.test(text) && /Operated by|Flight\s+[\w\s]+\d/i.test(text)) {
    result = parseCtm(text, cityUpper);
  }

  if (!result || (!result.firstName && !result.lastName && !result.arrivalFlight && !result.departureFlight)) {
    throw new Error('Unrecognized ticket format — please enter this traveler’s details manually.');
  }

  return result;
}
