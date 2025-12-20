export type Ga4ClientConfig = {
  clientName: string;
  accountId: string;
  aliases?: string[];
  searchTerm?: string;
  fallbackPropertyIds?: string[];
};

export const GA4_CLIENTS: Ga4ClientConfig[] = [
  { clientName: "Hannover Restaurante", accountId: "175492763", aliases: ["Hannover"], searchTerm: "Hannover" },
  { clientName: "Nanda Cora", accountId: "195680050", searchTerm: "Nanda", fallbackPropertyIds: ["properties/270511251"] },
  { clientName: "flacora", accountId: "195680050", aliases: ["Nanda Cora"], searchTerm: "Nanda", fallbackPropertyIds: ["properties/270511251"] },
  { clientName: "Sant'Alberti", accountId: "201201451", aliases: ["Santalberti"], searchTerm: "Santalberti" },
  { clientName: "Aviarte", accountId: "209051900", searchTerm: "Aviarte" },
  { clientName: "Lele da Cuca", accountId: "230500414", aliases: ["Lele da Cuca - Narah"], searchTerm: "Lele", fallbackPropertyIds: ["properties/317508848"] },
  { clientName: "Flavio Cora", accountId: "269849457", aliases: ["Flavio Cora"], searchTerm: "Flavio" },
  { clientName: "Comprazzo Backup", accountId: "273196606", aliases: ["Comprazzo Loja Online"], searchTerm: "Comprazzo" },
  { clientName: "Candela Fragrances Brasil", accountId: "283716904", searchTerm: "Candela" },
  { clientName: "Karyne Magalhaes", accountId: "284387276", searchTerm: "Karyne", fallbackPropertyIds: ["properties/416710996"] },
  { clientName: "MCC - NARAH", accountId: "296775732", aliases: ["Narah - Gestao"], searchTerm: "Narah" },
  { clientName: "Faculdade Uniao de Goyazes", accountId: "335379126", aliases: ["UniGoyazes"], searchTerm: "UniGoyazes" },
  { clientName: "Baby Raia", accountId: "345868791", aliases: ["Baby Raia | Kelly"], searchTerm: "Baby Raia" },
  { clientName: "EXC Foods - Solucoes para Panificacao", accountId: "346385721", aliases: ["EXC Foods"], searchTerm: "EXC" },
  { clientName: "Oxen Currais", accountId: "347352169", searchTerm: "Oxen" },
  { clientName: "Smart Cartorio Digital", accountId: "350756354", aliases: ["Smart Cartorio Digital"], searchTerm: "Smart" },
  { clientName: "New Hope Cabinets Painting", accountId: "360741773", aliases: ["NH Painting"], searchTerm: "newhope" },
  { clientName: "Dr. Luigi Seronni", accountId: "363302692", aliases: ["Dr Luigi - Site GA4"], searchTerm: "Dr Luigi" },
  { clientName: "LR abril atacadista", accountId: "364714383", searchTerm: "Rei dos Pulverizadores" },
  { clientName: "Goias Cortinas", accountId: "368634085", aliases: ["Goias Cortinas"], searchTerm: "Goias" },
  { clientName: "Avlon", accountId: "91045397", searchTerm: "Avlon" }
];
