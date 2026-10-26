/**
 * "City now" for the event page — local weather and the USD exchange rate for an event's city.
 *
 * Fetched here rather than from the browser so the web app never depends on third-party CORS rules and
 * every user shares one cached copy: city lookups are cached 6 hours, weather 10 minutes, exchange
 * rates 1 hour. Free public APIs, no keys: Open-Meteo (geocoding + forecast) and open.er-api.com (FX).
 *
 * Always answers with whatever it could get — a failed weather or FX call leaves that part null (and
 * names it in `errors`) instead of failing the whole card.
 */

var CITY_LIVE_TTL_ = { geo: 21600, weather: 600, fx: 3600 };

/** ISO 3166-1 alpha-2 country code → ISO 4217 currency code. */
var CURRENCY_BY_COUNTRY_ = (function () {
  var raw =
    'AD:EUR,AE:AED,AF:AFN,AG:XCD,AI:XCD,AL:ALL,AM:AMD,AO:AOA,AR:ARS,AS:USD,AT:EUR,AU:AUD,AW:AWG,AX:EUR,AZ:AZN,' +
    'BA:BAM,BB:BBD,BD:BDT,BE:EUR,BF:XOF,BG:EUR,BH:BHD,BI:BIF,BJ:XOF,BL:EUR,BM:BMD,BN:BND,BO:BOB,BQ:USD,BR:BRL,BS:BSD,BT:BTN,BW:BWP,BY:BYN,BZ:BZD,' +
    'CA:CAD,CC:AUD,CD:CDF,CF:XAF,CG:XAF,CH:CHF,CI:XOF,CK:NZD,CL:CLP,CM:XAF,CN:CNY,CO:COP,CR:CRC,CU:CUP,CV:CVE,CW:ANG,CX:AUD,CY:EUR,CZ:CZK,' +
    'DE:EUR,DJ:DJF,DK:DKK,DM:XCD,DO:DOP,DZ:DZD,EC:USD,EE:EUR,EG:EGP,EH:MAD,ER:ERN,ES:EUR,ET:ETB,FI:EUR,FJ:FJD,FK:FKP,FM:USD,FO:DKK,FR:EUR,' +
    'GA:XAF,GB:GBP,GD:XCD,GE:GEL,GF:EUR,GG:GBP,GH:GHS,GI:GIP,GL:DKK,GM:GMD,GN:GNF,GP:EUR,GQ:XAF,GR:EUR,GT:GTQ,GU:USD,GW:XOF,GY:GYD,' +
    'HK:HKD,HN:HNL,HR:EUR,HT:HTG,HU:HUF,ID:IDR,IE:EUR,IL:ILS,IM:GBP,IN:INR,IQ:IQD,IR:IRR,IS:ISK,IT:EUR,JE:GBP,JM:JMD,JO:JOD,JP:JPY,' +
    'KE:KES,KG:KGS,KH:KHR,KI:AUD,KM:KMF,KN:XCD,KP:KPW,KR:KRW,KW:KWD,KY:KYD,KZ:KZT,LA:LAK,LB:LBP,LC:XCD,LI:CHF,LK:LKR,LR:LRD,LS:LSL,LT:EUR,LU:EUR,LV:EUR,LY:LYD,' +
    'MA:MAD,MC:EUR,MD:MDL,ME:EUR,MF:EUR,MG:MGA,MH:USD,MK:MKD,ML:XOF,MM:MMK,MN:MNT,MO:MOP,MP:USD,MQ:EUR,MR:MRU,MS:XCD,MT:EUR,MU:MUR,MV:MVR,MW:MWK,MX:MXN,MY:MYR,MZ:MZN,' +
    'NA:NAD,NC:XPF,NE:XOF,NF:AUD,NG:NGN,NI:NIO,NL:EUR,NO:NOK,NP:NPR,NR:AUD,NU:NZD,NZ:NZD,OM:OMR,PA:PAB,PE:PEN,PF:XPF,PG:PGK,PH:PHP,PK:PKR,PL:PLN,PM:EUR,PR:USD,PS:ILS,PT:EUR,PW:USD,PY:PYG,' +
    'QA:QAR,RE:EUR,RO:RON,RS:RSD,RU:RUB,RW:RWF,SA:SAR,SB:SBD,SC:SCR,SD:SDG,SE:SEK,SG:SGD,SH:SHP,SI:EUR,SK:EUR,SL:SLE,SM:EUR,SN:XOF,SO:SOS,SR:SRD,SS:SSP,ST:STN,SV:USD,SX:ANG,SY:SYP,SZ:SZL,' +
    'TC:USD,TD:XAF,TG:XOF,TH:THB,TJ:TJS,TK:NZD,TL:USD,TM:TMT,TN:TND,TO:TOP,TR:TRY,TT:TTD,TV:AUD,TW:TWD,TZ:TZS,UA:UAH,UG:UGX,US:USD,UY:UYU,UZ:UZS,' +
    'VA:EUR,VC:XCD,VE:VES,VG:USD,VI:USD,VN:VND,VU:VUV,WF:XPF,WS:WST,XK:EUR,YE:YER,YT:EUR,ZA:ZAR,ZM:ZMW,ZW:ZWL';
  var map = {};
  raw.split(',').forEach(function (pair) {
    var kv = pair.split(':');
    map[kv[0]] = kv[1];
  });
  return map;
})();

/** "Tashkent, Uzbekistan" → { city: 'Tashkent', country: 'Uzbekistan' }. A bare city has no country. */
function parseCityLocation_(location) {
  var parts = String(location || '')
    .split(',')
    .map(function (p) {
      return p.trim();
    })
    .filter(Boolean);
  if (!parts.length) return null;
  return { city: parts[0], country: parts.length > 1 ? parts[parts.length - 1] : '' };
}

/** Lower-cases and strips accents/punctuation so "Türkiye" matches "Turkiye". */
function normalizePlaceName_(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Prefers the geocoding hit in the named country (so "Tbilisi, Georgia" is never the US state), else the top hit. */
function pickGeoResult_(results, country) {
  if (!results || !results.length) return null;
  var want = normalizePlaceName_(country);
  if (want) {
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (normalizePlaceName_(r.country) === want || normalizePlaceName_(r.country_code) === want) return r;
    }
  }
  return results[0];
}

function cityCacheGet_(key) {
  try {
    var raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function cityCachePut_(key, value, ttl) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), ttl);
  } catch (e) {
    // The cache is an optimisation only.
  }
}

function fetchCityJson_(url) {
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  return JSON.parse(res.getContentText());
}

function geocodeCity_(city, country) {
  var key = 'geo:' + normalizePlaceName_(city) + '|' + normalizePlaceName_(country);
  var hit = cityCacheGet_(key);
  if (hit) return hit;

  var data = fetchCityJson_(
    'https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=' + encodeURIComponent(city)
  );
  var r = pickGeoResult_(data.results, country);
  if (!r) return null;

  var geo = {
    name: r.name || city,
    country: r.country || '',
    countryCode: r.country_code || '',
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone || '',
  };
  cityCachePut_(key, geo, CITY_LIVE_TTL_.geo);
  return geo;
}

function fetchCityWeather_(geo) {
  var key = 'wx:' + Number(geo.lat).toFixed(2) + ',' + Number(geo.lon).toFixed(2);
  var hit = cityCacheGet_(key);
  if (hit) return hit;

  var data = fetchCityJson_(
    'https://api.open-meteo.com/v1/forecast?latitude=' + geo.lat +
      '&longitude=' + geo.lon +
      '&current=temperature_2m,weather_code,wind_speed_10m&timezone=' + encodeURIComponent(geo.timezone || 'auto')
  );
  var c = data.current;
  if (!c) return null;

  var weather = { temp: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m };
  cityCachePut_(key, weather, CITY_LIVE_TTL_.weather);
  return weather;
}

function fetchUsdRates_() {
  var key = 'fx:usd';
  var hit = cityCacheGet_(key);
  if (hit) return hit;

  var data = fetchCityJson_('https://open.er-api.com/v6/latest/USD');
  if (data.result !== 'success' || !data.rates) return null;

  var fx = { rates: data.rates, updated: data.time_last_update_unix };
  cityCachePut_(key, fx, CITY_LIVE_TTL_.fx);
  return fx;
}

/**
 * @param {string} location  An event's Location cell, e.g. "Tashkent, Uzbekistan" or just "Tunis".
 * @returns {{city:string,country:string,timezone:string,currency:string,
 *   weather:?{temp:number,code:number,wind:number}, fx:?{rate:number,updated:number}, errors:string[]}}
 */
function getCityLive_(location) {
  var loc = parseCityLocation_(location);
  if (!loc) throw new Error('location required');

  var out = { city: loc.city, country: loc.country, timezone: '', currency: '', weather: null, fx: null, errors: [] };

  var geo = null;
  try {
    geo = geocodeCity_(loc.city, loc.country);
  } catch (e) {
    out.errors.push('geocode');
  }
  if (!geo) return out;

  out.city = geo.name || loc.city;
  out.country = geo.country || loc.country;
  out.timezone = geo.timezone;
  out.currency = CURRENCY_BY_COUNTRY_[geo.countryCode] || '';

  try {
    out.weather = fetchCityWeather_(geo);
  } catch (e) {
    out.errors.push('weather');
  }

  if (out.currency && out.currency !== 'USD') {
    try {
      var fx = fetchUsdRates_();
      var rate = fx && fx.rates ? fx.rates[out.currency] : null;
      if (rate) out.fx = { rate: rate, updated: fx.updated };
    } catch (e) {
      out.errors.push('fx');
    }
  }
  return out;
}
