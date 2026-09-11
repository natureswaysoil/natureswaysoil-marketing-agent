export type Product = {
  id: string
  name: string
  price: string
  url: string
  audiences: string[]
  approvedClaims: string[]
  prohibitedClaims: string[]
}

export const PRODUCTS: Product[] = [
  {
    id: 'dog-urine-neutralizer-32oz',
    name: "Nature's Way Soil Dog Urine Neutralizer & Lawn Revitalizer, 32 oz",
    price: '$29.99',
    url: 'https://natureswaysoil.com',
    audiences: ['dog owners', 'homeowners', 'property managers'],
    approvedClaims: ['Helps control outdoor pet odors', 'Supports healthier-looking grass', 'Treats up to approximately 5,000 square feet when used as directed', 'Safe around children, pets, and beneficial insects when used as directed'],
    prohibitedClaims: ['repairs every urine burn', 'guaranteed cure', 'non-toxic when swallowed']
  },
  {
    id: 'hay-pasture-fertilizer-1gal',
    name: "Nature's Way Soil Hay, Pasture & Lawn Fertilizer, 1 gallon",
    price: '$39.99',
    url: 'https://natureswaysoil.com',
    audiences: ['small farms', 'horse owners', 'pasture managers'],
    approvedClaims: ['Concentrated liquid fertilizer for hay, pasture, and lawns', 'One gallon treats up to five acres when used as directed', 'Made fresh weekly'],
    prohibitedClaims: ['guaranteed yield increase', 'replaces soil testing', 'certified organic unless the specific registration supports it']
  },
  {
    id: 'liquid-biochar-1gal',
    name: "Nature's Way Soil Liquid Biochar with Kelp, Humic & Fulvic Acid, 1 gallon",
    price: '$89.99',
    url: 'https://natureswaysoil.com',
    audiences: ['gardeners', 'lawn-care customers', 'small farms'],
    approvedClaims: ['Supports soil conditioning', 'Contains liquid biochar, kelp, humic acid, and fulvic acid', 'Designed to support water and nutrient management'],
    prohibitedClaims: ['permanently fixes soil', 'eliminates fertilizer needs', 'carbon-credit eligible']
  },
  {
    id: 'soil-recovery-2-5gal',
    name: "Nature's Way Soil Premium Hay, Pasture & Lawn Recovery System, 2.5 gallon",
    price: '$199.99',
    url: 'https://natureswaysoil.com',
    audiences: ['pasture owners', 'small farms', 'grounds managers'],
    approvedClaims: ['Designed for stressed hay, pasture, and lawn areas', 'Treats approximately two to five acres when used as directed', 'Combines plant nutrients with soil-supporting ingredients'],
    prohibitedClaims: ['revives dead grass', 'drought proof', 'guaranteed recovery']
  }
]

export function findProduct(id: string): Product {
  const product = PRODUCTS.find(item => item.id === id)
  if (!product) throw new Error(`Unknown product: ${id}`)
  return product
}
