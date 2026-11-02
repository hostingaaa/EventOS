/**
 * City and country from an event's Location cell. Most locations read "City, Country", but older rows hold just
 * a city ("Tunis"), so a short table of the cities events are run in fills in the country for those; anything
 * it doesn't know lands under "Unknown" rather than being mistaken for a country.
 */
const CITY_COUNTRY: Record<string, string> = {
  tunis: 'Tunisia', algiers: 'Algeria', cairo: 'Egypt', casablanca: 'Morocco', rabat: 'Morocco',
  almaty: 'Kazakhstan', astana: 'Kazakhstan', tashkent: 'Uzbekistan', samarkand: 'Uzbekistan',
  bishkek: 'Kyrgyzstan', dushanbe: 'Tajikistan', ashgabat: 'Turkmenistan', ulaanbaatar: 'Mongolia',
  tbilisi: 'Georgia', yerevan: 'Armenia', baku: 'Azerbaijan', istanbul: 'Türkiye', ankara: 'Türkiye',
  stockholm: 'Sweden', vienna: 'Austria', belgrade: 'Serbia', bangkok: 'Thailand', manila: 'Philippines',
  colombo: 'Sri Lanka', dubai: 'United Arab Emirates', 'abu dhabi': 'United Arab Emirates', doha: 'Qatar',
  amman: 'Jordan', riyadh: 'Saudi Arabia', kyiv: 'Ukraine', warsaw: 'Poland', budapest: 'Hungary',
  prague: 'Czechia', sofia: 'Bulgaria', bucharest: 'Romania', tirana: 'Albania', sarajevo: 'Bosnia and Herzegovina',
};

const COUNTRY_ALIASES: Record<string, string> = {
  turkiye: 'Türkiye', 'türkiye': 'Türkiye', turkey: 'Türkiye', 'republic of türkiye': 'Türkiye',
  uae: 'United Arab Emirates', usa: 'United States', uk: 'United Kingdom',
};

export const UNKNOWN_COUNTRY = 'Unknown';

export function cityOfLocation(location: string): string {
  return (location || '').split(',')[0].trim();
}

export function countryOfLocation(location: string): string {
  const parts = (location || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return UNKNOWN_COUNTRY;
  if (parts.length > 1) {
    const raw = parts[parts.length - 1];
    return COUNTRY_ALIASES[raw.toLowerCase()] ?? raw;
  }
  return CITY_COUNTRY[parts[0].toLowerCase()] ?? UNKNOWN_COUNTRY;
}
