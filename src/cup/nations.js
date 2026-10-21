// The 48 national teams of the cup, picked by World Cup history (titles, finals, appearances)
// and current level, with a World-Cup-like spread per confederation: 16 Europe,
// 8 South America, 6 North/Central America, 9 Africa, 8 Asia, 1 Oceania.
// Kits use the same patterns as the clubs (see src/league/teams.js); `checks` is
// Croatia's checkerboard. The away kit is the home one with the colours swapped unless
// it's given. strength (0..1) drives the bots and the simulated matches.

const RAW = [
  // South America
  ['argentina', 'Argentina', 'ARGENTINA', 0.96, 'stripes', '#6cc4ee', '#ffffff', { pattern: 'trim', colors: ['#1b2a5c', '#6cc4ee'] }],
  ['brasil', 'Brasil', 'BRASIL', 0.95, 'trim', '#ffdf00', '#009c3b', { pattern: 'trim', colors: ['#1d4fa8', '#ffdf00'] }],
  ['uruguay', 'Uruguay', 'URUGUAY', 0.8, 'trim', '#5cb8e6', '#ffffff'],
  ['colombia', 'Colombia', 'COLOMBIA', 0.74, 'trim', '#fcd116', '#003893'],
  ['ecuador', 'Ecuador', 'ECUADOR', 0.66, 'trim', '#ffdd00', '#034ea2', { pattern: 'trim', colors: ['#034ea2', '#ffdd00'] }],
  ['paraguay', 'Paraguay', 'PARAGUAY', 0.6, 'stripes', '#d52b1e', '#ffffff'],
  ['chile', 'Chile', 'CHILE', 0.6, 'trim', '#d52b1e', '#0039a6'],
  ['peru', 'Perú', 'PERÚ', 0.56, 'sash', '#ffffff', '#d91023', { pattern: 'sash', colors: ['#d91023', '#ffffff'] }],
  // Europe
  ['francia', 'Francia', 'FRANCIA', 0.94, 'trim', '#1c2a5a', '#e2001a', { pattern: 'trim', colors: ['#ffffff', '#1c2a5a'] }],
  ['alemania', 'Alemania', 'ALEMANIA', 0.9, 'band', '#ffffff', '#1d1d1d', { pattern: 'trim', colors: ['#1d1d1d', '#e30613'] }],
  ['espana', 'España', 'ESPAÑA', 0.91, 'trim', '#c8102e', '#ffc400', { pattern: 'trim', colors: ['#ffffff', '#c8102e'] }],
  ['inglaterra', 'Inglaterra', 'INGLATERRA', 0.88, 'trim', '#ffffff', '#1d2a5c', { pattern: 'trim', colors: ['#c8102e', '#ffffff'] }],
  ['italia', 'Italia', 'ITALIA', 0.86, 'trim', '#1f5fbf', '#ffffff'],
  ['portugal', 'Portugal', 'PORTUGAL', 0.86, 'trim', '#c8102e', '#046a38'],
  ['paisesbajos', 'Países Bajos', 'P. BAJOS', 0.85, 'trim', '#ff6c00', '#1d1d1d', { pattern: 'trim', colors: ['#1d2a5c', '#ff6c00'] }],
  ['belgica', 'Bélgica', 'BÉLGICA', 0.8, 'trim', '#c8102e', '#1d1d1d', { pattern: 'trim', colors: ['#ffffff', '#c8102e'] }],
  ['croacia', 'Croacia', 'CROACIA', 0.82, 'checks', '#ffffff', '#e30613', { pattern: 'trim', colors: ['#1d2a5c', '#ffffff'] }],
  ['suiza', 'Suiza', 'SUIZA', 0.68, 'trim', '#d52b1e', '#ffffff'],
  ['dinamarca', 'Dinamarca', 'DINAMARCA', 0.68, 'trim', '#c8102e', '#ffffff'],
  ['austria', 'Austria', 'AUSTRIA', 0.64, 'band', '#ed2939', '#ffffff'],
  ['polonia', 'Polonia', 'POLONIA', 0.62, 'band', '#ffffff', '#dc143c'],
  ['serbia', 'Serbia', 'SERBIA', 0.6, 'trim', '#c6363c', '#0c4076'],
  ['suecia', 'Suecia', 'SUECIA', 0.66, 'trim', '#fecc00', '#006aa7'],
  ['turquia', 'Turquía', 'TURQUÍA', 0.62, 'trim', '#e30a17', '#ffffff'],
  // North and Central America
  ['mexico', 'México', 'MÉXICO', 0.7, 'trim', '#006847', '#ce1126'],
  ['eeuu', 'Estados Unidos', 'EE. UU.', 0.68, 'trim', '#ffffff', '#1d2a5c', { pattern: 'trim', colors: ['#1d2a5c', '#c8102e'] }],
  ['canada', 'Canadá', 'CANADÁ', 0.56, 'trim', '#d80621', '#ffffff'],
  ['costarica', 'Costa Rica', 'COSTA RICA', 0.52, 'trim', '#ce1126', '#002b7f'],
  ['panama', 'Panamá', 'PANAMÁ', 0.44, 'trim', '#da121a', '#ffffff'],
  ['jamaica', 'Jamaica', 'JAMAICA', 0.4, 'trim', '#fed100', '#009b3a'],
  // Africa
  ['marruecos', 'Marruecos', 'MARRUECOS', 0.74, 'trim', '#c1272d', '#006233'],
  ['senegal', 'Senegal', 'SENEGAL', 0.66, 'trim', '#ffffff', '#00853f'],
  ['nigeria', 'Nigeria', 'NIGERIA', 0.6, 'trim', '#008751', '#ffffff'],
  ['camerun', 'Camerún', 'CAMERÚN', 0.56, 'trim', '#007a5e', '#ce1126'],
  ['egipto', 'Egipto', 'EGIPTO', 0.54, 'trim', '#c8102e', '#ffffff'],
  ['ghana', 'Ghana', 'GHANA', 0.54, 'trim', '#ffffff', '#1d1d1d'],
  ['argelia', 'Argelia', 'ARGELIA', 0.52, 'trim', '#ffffff', '#006233'],
  ['costamarfil', 'Costa de Marfil', 'C. DE MARFIL', 0.58, 'trim', '#ff8200', '#009e60'],
  ['tunez', 'Túnez', 'TÚNEZ', 0.48, 'trim', '#e70013', '#ffffff'],
  // Asia
  ['japon', 'Japón', 'JAPÓN', 0.7, 'trim', '#1b3f9c', '#ffffff'],
  ['corea', 'Corea del Sur', 'COREA', 0.64, 'trim', '#cd2e3a', '#1d1d1d'],
  ['iran', 'Irán', 'IRÁN', 0.56, 'trim', '#ffffff', '#da0000'],
  ['australia', 'Australia', 'AUSTRALIA', 0.56, 'trim', '#ffcd00', '#00843d'],
  ['arabia', 'Arabia Saudita', 'ARABIA', 0.48, 'trim', '#ffffff', '#006c35'],
  ['qatar', 'Qatar', 'QATAR', 0.42, 'trim', '#8a1538', '#ffffff'],
  ['irak', 'Irak', 'IRAK', 0.4, 'trim', '#007a3d', '#ffffff'],
  ['uzbekistan', 'Uzbekistán', 'UZBEKISTÁN', 0.4, 'trim', '#ffffff', '#1eb53a'],
  // Oceania
  ['nzelanda', 'Nueva Zelanda', 'N. ZELANDA', 0.34, 'trim', '#ffffff', '#1d1d1d'],
];

export const NATIONS = RAW.map(([id, name, short, strength, pattern, c1, c2, away]) => ({
  id, name, short, strength,
  home: { pattern, colors: [c1, c2] },
  away: away ?? { pattern: 'trim', colors: [c2, c1] },
})).sort((a, b) => b.strength - a.strength);

export const NATION_BY_ID = Object.fromEntries(NATIONS.map((n) => [n.id, n]));
