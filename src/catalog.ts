import catalog from './catalog-data.json' with { type: 'json' }
export type Product = {
 id:string; name:string; price:string; url:string; imageUrl:string; asin:string; sku:string;
 inStock:boolean; automatic:boolean; audiences:string[]; approvedClaims:string[]; prohibitedClaims:string[]; brollQueries:string[]
}
export const PRODUCTS: Product[] = catalog.products
export function findProduct(id:string):Product {
 const aliases:Record<string,string>={'dog-urine-neutralizer-32oz':'NWS_014','hay-pasture-fertilizer-1gal':'NWS_021','soil-recovery-2-5gal':'NWS_022'}
 const product=PRODUCTS.find(p=>p.id===(aliases[id]||id))
 if(!product)throw new Error('Product is not in the current verified catalog; generate a new draft')
 return product
}
