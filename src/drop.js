// ============================================================================
//  EDIÇÃO ATUAL — tudo o que muda de uma camisa para a outra fica aqui.
//  Para lançar a próxima edição: troque os arquivos da arte, rode `npm run assets`
//  e atualize os textos abaixo.
// ============================================================================

export const drop = {
  brand: "Mantus Christi",
  edition: "Edição de lançamento",
  name: "Sucessão Apostólica",
  tagline: "De Pedro a Leão XIV. Dois mil anos numa só linha.",
  color: "Vinho",

  // Compra ---------------------------------------------------------------
  // price: deixe null para esconder o preço (ex.: "R$ 149,90")
  price: null,
  sizes: ["P", "M", "G", "GG"],
  // WhatsApp (só números, com DDI 55 + DDD): o botão abre uma conversa já com a camisa
  // e o tamanho escolhido (se a pessoa escolheu um).
  whatsapp: "5583999615537",
  // Caso contrário, o botão leva para este link (loja, Instagram, formulário...).
  buyUrl: "",
  instagram: "",

  // Cores da camisa no 3D (tecido) — baseadas no mockup
  fabric: "#4a2530",
};

// Os dez medalhões das costas, na ordem da arte (da esquerda para a direita, linha a linha).
export const popes = [
  {
    latin: "PETRVS",
    name: "São Pedro",
    number: 1,
    years: "† c. 64–67",
    quote: "Tu és Pedro, e sobre esta pedra edificarei a minha Igreja.",
    source: "Mt 16,18",
    text: "Pescador da Galileia, chamado por Cristo para ser pedra. Morreu mártir em Roma, sob Nero, e foi sepultado na colina do Vaticano.",
  },
  {
    latin: "LINVS",
    name: "São Lino",
    number: 2,
    years: "c. 67–76",
    quote: "Os apóstolos confiaram a Lino o encargo do episcopado.",
    source: "Santo Irineu, Contra as Heresias III",
    text: "O primeiro sucessor de Pedro em Roma. São Paulo o menciona na sua última carta, entre os irmãos que mandam saudações (2Tm 4,21).",
  },
  {
    latin: "LEO I",
    name: "São Leão Magno",
    number: 45,
    years: "440–461",
    quote: "Pedro falou pela boca de Leão!",
    source: "Concílio de Calcedônia, 451",
    text: "Doutor da Igreja. Em 452 saiu ao encontro de Átila e o convenceu a deixar a Itália.",
  },
  {
    latin: "GREGORIVS I",
    name: "São Gregório Magno",
    number: 64,
    years: "590–604",
    quote: "Servo dos servos de Deus.",
    source: "título que ele próprio adotou",
    text: "Doutor da Igreja: enviou missionários à Inglaterra e dá nome ao canto gregoriano. A pomba no ombro é o Espírito Santo que lhe inspirava os escritos.",
  },
  {
    latin: "VRBANVS II",
    name: "Beato Urbano II",
    number: 159,
    years: "1088–1099",
    quote: "Deus vult! — Deus o quer!",
    source: "a multidão em Clermont, 1095",
    text: "Monge de Cluny, convocou a Primeira Cruzada e reformou a disciplina da Igreja no fim do século XI.",
  },
  {
    latin: "PIVS V",
    name: "São Pio V",
    number: 225,
    years: "1566–1572",
    quote: "Agora não é hora de negócios: demos graças a Deus pela vitória.",
    source: "segundo a tradição, 7 de outubro de 1571",
    text: "Dominicano, aplicou a reforma do Concílio de Trento e promulgou o Missal Romano de 1570. Pediu o Rosário pela vitória em Lepanto.",
  },
  {
    latin: "IOANNES PAVLVS II",
    name: "São João Paulo II",
    number: 264,
    years: "1978–2005",
    quote: "Não tenhais medo! Abri as portas a Cristo!",
    source: "homilia de início do pontificado, 1978",
    text: "O papa polonês que levou o Evangelho a 129 países em 104 viagens apostólicas. Canonizado em 2014.",
  },
  {
    latin: "BENEDICTVS XVI",
    name: "Bento XVI",
    number: 265,
    years: "2005–2013",
    quote: "Cooperatores Veritatis — cooperadores da Verdade.",
    source: "seu lema, de 3Jo 8",
    text: "Teólogo da fé e da razão, guardião da liturgia. Renunciou em 2013 e passou seus últimos anos em oração no Vaticano.",
  },
  {
    latin: "FRANCISCVS",
    name: "Francisco",
    number: 266,
    years: "2013–2025",
    quote: "Miserando atque eligendo — olhou-o com misericórdia e o escolheu.",
    source: "seu lema, de São Beda",
    text: "O primeiro papa das Américas e o primeiro jesuíta. Morreu na segunda-feira da Páscoa de 2025.",
  },
  {
    latin: "LEO XIV",
    name: "Leão XIV",
    number: 267,
    years: "desde 2025",
    quote: "A paz esteja com todos vós!",
    source: "suas primeiras palavras, 8 de maio de 2025",
    text: "Agostiniano, missionário no Peru. Lema: In Illo uno unum — “No Único, somos um”. O sucessor de hoje.",
  },
];

// As quatro notas da Igreja, estampadas na frente (Credo Niceno-Constantinopolitano).
export const creed = [
  { word: "UNA", gloss: "Um só Senhor, uma só fé, um só batismo.", source: "Ef 4,5" },
  { word: "SANTA", gloss: "Cristo amou a Igreja e se entregou por ela, para santificá-la.", source: "Ef 5,25-26" },
  { word: "CATÓLICA", gloss: "Do grego katholikós: segundo o todo. Universal — para todos os povos.", source: "Mt 28,19", gold: true },
  { word: "APOSTÓLICA", gloss: "Edificada sobre o fundamento dos apóstolos, tendo Cristo por pedra angular.", source: "Ef 2,20" },
];

export function toRoman(n) {
  const map = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

export function buyLink(size) {
  const msg = `Olá! Quero a camisa ${drop.name} (${drop.edition.toLowerCase()})${size ? ` no tamanho ${size}` : ""}.`;
  if (drop.whatsapp) return `https://wa.me/${drop.whatsapp}?text=${encodeURIComponent(msg)}`;
  return drop.buyUrl || "";
}
