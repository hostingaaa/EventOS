/**
 * Countries this org runs events in, each with its capital and second-most
 * prominent city (usually the largest non-capital city — or, when the
 * capital isn't the largest city in the country, the other major city
 * travelers would actually fly into). Used to drive the SOW Generator's
 * Country → City dropdowns; a third "Other" option lets an editor type a
 * city that isn't one of these two.
 */
export interface CountryCityEntry {
  country: string;
  capital: string;
  /** '' when the country has no meaningfully distinct second city (e.g. a city-state). */
  secondCity: string;
}

export const COUNTRY_CITIES: CountryCityEntry[] = [
  { country: 'Albania', capital: 'Tirana', secondCity: 'Durrës' },
  { country: 'Algeria', capital: 'Algiers', secondCity: 'Oran' },
  { country: 'Angola', capital: 'Luanda', secondCity: 'Huambo' },
  { country: 'Armenia', capital: 'Yerevan', secondCity: 'Gyumri' },
  { country: 'Austria', capital: 'Vienna', secondCity: 'Graz' },
  { country: 'Azerbaijan', capital: 'Baku', secondCity: 'Ganja' },
  { country: 'Bahrain', capital: 'Manama', secondCity: 'Riffa' },
  { country: 'Bangladesh', capital: 'Dhaka', secondCity: 'Chittagong' },
  { country: 'Belgium', capital: 'Brussels', secondCity: 'Antwerp' },
  { country: 'Bosnia and Herzegovina', capital: 'Sarajevo', secondCity: 'Banja Luka' },
  { country: 'Brunei', capital: 'Bandar Seri Begawan', secondCity: 'Kuala Belait' },
  { country: 'Bulgaria', capital: 'Sofia', secondCity: 'Plovdiv' },
  { country: 'Cambodia', capital: 'Phnom Penh', secondCity: 'Battambang' },
  { country: 'Croatia', capital: 'Zagreb', secondCity: 'Split' },
  { country: 'Czech Republic', capital: 'Prague', secondCity: 'Brno' },
  { country: 'Denmark', capital: 'Copenhagen', secondCity: 'Aarhus' },
  { country: 'Egypt', capital: 'Cairo', secondCity: 'Alexandria' },
  { country: 'Estonia', capital: 'Tallinn', secondCity: 'Tartu' },
  { country: 'Finland', capital: 'Helsinki', secondCity: 'Espoo' },
  { country: 'France', capital: 'Paris', secondCity: 'Marseille' },
  { country: 'Georgia', capital: 'Tbilisi', secondCity: 'Batumi' },
  { country: 'Germany', capital: 'Berlin', secondCity: 'Hamburg' },
  { country: 'Greece', capital: 'Athens', secondCity: 'Thessaloniki' },
  { country: 'Hong Kong', capital: 'Hong Kong', secondCity: 'Kowloon' },
  { country: 'Hungary', capital: 'Budapest', secondCity: 'Debrecen' },
  { country: 'India', capital: 'New Delhi', secondCity: 'Mumbai' },
  { country: 'Indonesia', capital: 'Jakarta', secondCity: 'Surabaya' },
  { country: 'Iraq', capital: 'Baghdad', secondCity: 'Basra' },
  { country: 'Italy', capital: 'Rome', secondCity: 'Milan' },
  { country: 'Jordan', capital: 'Amman', secondCity: 'Zarqa' },
  { country: 'Kazakhstan', capital: 'Astana', secondCity: 'Almaty' },
  { country: 'Kenya', capital: 'Nairobi', secondCity: 'Mombasa' },
  { country: 'Kuwait', capital: 'Kuwait City', secondCity: 'Al Ahmadi' },
  { country: 'Kyrgyzstan', capital: 'Bishkek', secondCity: 'Osh' },
  { country: 'Laos', capital: 'Vientiane', secondCity: 'Pakse' },
  { country: 'Latvia', capital: 'Riga', secondCity: 'Daugavpils' },
  { country: 'Lebanon', capital: 'Beirut', secondCity: 'Tripoli' },
  { country: 'Lithuania', capital: 'Vilnius', secondCity: 'Kaunas' },
  { country: 'Luxembourg', capital: 'Luxembourg City', secondCity: 'Esch-sur-Alzette' },
  { country: 'Malaysia', capital: 'Kuala Lumpur', secondCity: 'Johor Bahru' },
  { country: 'Maldives', capital: 'Malé', secondCity: 'Addu City' },
  { country: 'Moldova', capital: 'Chișinău', secondCity: 'Bălți' },
  { country: 'Mongolia', capital: 'Ulaanbaatar', secondCity: 'Erdenet' },
  { country: 'Montenegro', capital: 'Podgorica', secondCity: 'Nikšić' },
  { country: 'Morocco', capital: 'Rabat', secondCity: 'Casablanca' },
  { country: 'Myanmar', capital: 'Naypyidaw', secondCity: 'Yangon' },
  { country: 'Netherlands', capital: 'Amsterdam', secondCity: 'Rotterdam' },
  { country: 'Nigeria', capital: 'Abuja', secondCity: 'Lagos' },
  { country: 'North Macedonia', capital: 'Skopje', secondCity: 'Bitola' },
  { country: 'Norway', capital: 'Oslo', secondCity: 'Bergen' },
  { country: 'Oman', capital: 'Muscat', secondCity: 'Salalah' },
  { country: 'Pakistan', capital: 'Islamabad', secondCity: 'Karachi' },
  { country: 'Philippines', capital: 'Manila', secondCity: 'Quezon City' },
  { country: 'Poland', capital: 'Warsaw', secondCity: 'Kraków' },
  { country: 'Portugal', capital: 'Lisbon', secondCity: 'Porto' },
  { country: 'Qatar', capital: 'Doha', secondCity: 'Al Rayyan' },
  { country: 'Romania', capital: 'Bucharest', secondCity: 'Cluj-Napoca' },
  { country: 'Saudi Arabia', capital: 'Riyadh', secondCity: 'Jeddah' },
  { country: 'Serbia', capital: 'Belgrade', secondCity: 'Novi Sad' },
  { country: 'Singapore', capital: 'Singapore', secondCity: '' },
  { country: 'Slovakia', capital: 'Bratislava', secondCity: 'Košice' },
  { country: 'Slovenia', capital: 'Ljubljana', secondCity: 'Maribor' },
  { country: 'Spain', capital: 'Madrid', secondCity: 'Barcelona' },
  { country: 'Sri Lanka', capital: 'Colombo', secondCity: 'Kandy' },
  { country: 'Sweden', capital: 'Stockholm', secondCity: 'Gothenburg' },
  { country: 'Switzerland', capital: 'Bern', secondCity: 'Zürich' },
  { country: 'Tajikistan', capital: 'Dushanbe', secondCity: 'Khujand' },
  { country: 'Thailand', capital: 'Bangkok', secondCity: 'Chiang Mai' },
  { country: 'Timor-Leste', capital: 'Dili', secondCity: 'Baucau' },
  { country: 'Tunisia', capital: 'Tunis', secondCity: 'Sfax' },
  { country: 'Turkiye', capital: 'Ankara', secondCity: 'Istanbul' },
  { country: 'Turkmenistan', capital: 'Ashgabat', secondCity: 'Türkmenabat' },
  { country: 'United Arab Emirates', capital: 'Abu Dhabi', secondCity: 'Dubai' },
  { country: 'Uzbekistan', capital: 'Tashkent', secondCity: 'Samarkand' },
];

/** Sentinel value for the "type a different city" option in the city dropdown. */
export const OTHER_CITY = '__other__';

export function citiesForCountry(country: string): CountryCityEntry | undefined {
  return COUNTRY_CITIES.find((c) => c.country === country);
}

/**
 * Best-effort reverse lookup for a free-text "City, Country" string (e.g.
 * from SOW auto-parse) into a {country, city} pair from the supported list.
 * Falls back to putting the whole city text in the "Other" slot when the
 * country doesn't match, or leaves everything blank if nothing matches.
 */
export function matchCountryCity(raw: string): { country: string; city: string; cityOther: string } {
  const empty = { country: '', city: '', cityOther: '' };
  const trimmed = raw.trim();
  if (!trimmed) return empty;

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  const cityPart = parts.length > 1 ? parts.slice(0, -1).join(', ') : '';
  const countryPart = parts.length > 1 ? parts[parts.length - 1] : parts[0];

  const norm = (s: string) => s.trim().toLowerCase();
  let entry = COUNTRY_CITIES.find((c) => norm(c.country) === norm(countryPart));

  // No comma, or the last segment isn't a known country — try the whole
  // string as a city name against every country's capital/second city.
  if (!entry && !cityPart) {
    const byCity = COUNTRY_CITIES.find(
      (c) => norm(c.capital) === norm(trimmed) || (c.secondCity && norm(c.secondCity) === norm(trimmed)),
    );
    if (byCity) return { country: byCity.country, city: trimmed, cityOther: '' };
    return empty;
  }

  if (!entry) return empty;
  if (!cityPart) return { country: entry.country, city: '', cityOther: '' };

  if (norm(entry.capital) === norm(cityPart)) return { country: entry.country, city: entry.capital, cityOther: '' };
  if (entry.secondCity && norm(entry.secondCity) === norm(cityPart)) {
    return { country: entry.country, city: entry.secondCity, cityOther: '' };
  }
  return { country: entry.country, city: OTHER_CITY, cityOther: cityPart };
}
