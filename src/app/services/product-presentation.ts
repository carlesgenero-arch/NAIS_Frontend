import type { Product } from '../models/product.interface';

/** Presentation and nutrition not yet provided by the public API. Never defines availability or price. */
type Presentation = Pick<Product, 'nutrition' | 'format' | 'ingredients' | 'imageAlt' | 'fruitImage' | 'variant' | 'detailsPending' | 'isSeasonal' | 'isFeatured' | 'badge' | 'featureDescription' | 'featureImageAlt' | 'featureBackgroundImageUrl'>;
export const PRODUCT_PRESENTATION: Readonly<Record<string, Presentation>> = {
  "orange-spritz": {
    "nutrition": [
      {
        "label": "Valor energètic",
        "value": "98 kJ / 23 kcal"
      },
      {
        "label": "Greixos",
        "value": "0,0 g"
      },
      {
        "label": "dels quals saturats",
        "value": "0,0 g"
      },
      {
        "label": "Hidrats de carboni",
        "value": "5,2 g"
      },
      {
        "label": "dels quals sucres",
        "value": "4,8 g"
      },
      {
        "label": "Proteïnes",
        "value": "0,1 g"
      },
      {
        "label": "Sal",
        "value": "<0,01 g"
      }
    ],
    "format": "pack 16 llaunes x 250ml",
    "ingredients": "TARONJA, LLIMONA, GERDS, GENCIANA",
    "imageAlt": "NAIS Orange Spritz can with blue fruit artwork",
    "fruitImage": {
      "url": "images/info-card/orange.png",
      "alt": "Orange fruit on a blue background"
    },
    "variant": "citrus"
  },
  "passion-hugo": {
    "nutrition": [
      {
        "label": "Valor energètic",
        "value": "99 kJ / 23 kcal"
      },
      {
        "label": "Greixos",
        "value": "0,0 g"
      },
      {
        "label": "dels quals saturats",
        "value": "0,0 g"
      },
      {
        "label": "Hidrats de carboni",
        "value": "5,1 g"
      },
      {
        "label": "dels quals sucres",
        "value": "4,9 g"
      },
      {
        "label": "Proteïnes",
        "value": "0,1 g"
      },
      {
        "label": "Sal",
        "value": "<0,01 g"
      }
    ],
    "format": "pack 16 llaunes x 250ml",
    "ingredients": "LLIMONA, MENTA, FLOR DE SAÜC, POMA, FRUITA DE LA PASSIÓ",
    "imageAlt": "NAIS Passion Hugo can with green fruit artwork",
    "fruitImage": {
      "url": "images/info-card/lemon.jpg",
      "alt": "Lemon fruit on a green background"
    },
    "variant": "botanical"
  },
  "ginger-crush": {
    "nutrition": [
      {
        "label": "Valor energètic",
        "value": "102 kJ / 24 kcal"
      },
      {
        "label": "Greixos",
        "value": "0,0 g"
      },
      {
        "label": "dels quals saturats",
        "value": "0,0 g"
      },
      {
        "label": "Hidrats de carboni",
        "value": "5,3 g"
      },
      {
        "label": "dels quals sucres",
        "value": "5,1 g"
      },
      {
        "label": "Proteïnes",
        "value": "0,1 g"
      },
      {
        "label": "Sal",
        "value": "<0,01 g"
      }
    ],
    "format": "pack 16 llaunes x 250ml",
    "ingredients": "LLIMONA, POMA, GINGEBRE, MANGO",
    "imageAlt": "NAIS can with pink fruit artwork and a Ginger Crush label",
    "fruitImage": {
      "url": "images/info-card/mango.png",
      "alt": "Mango fruit on a pink background"
    },
    "variant": "ginger"
  },
  "tropical-hops": {
    "nutrition": [
      {
        "label": "Valor energètic",
        "value": "103 kJ / 24 kcal"
      },
      {
        "label": "Greixos",
        "value": "0,2 g"
      },
      {
        "label": "dels quals saturats",
        "value": "0,0 g"
      },
      {
        "label": "Hidrats de carboni",
        "value": "5,3 g"
      },
      {
        "label": "dels quals sucres",
        "value": "4,9 g"
      },
      {
        "label": "Proteïnes",
        "value": "0,2 g"
      },
      {
        "label": "Sal",
        "value": "<0,01 g"
      }
    ],
    "format": "pack 16 llaunes x 250 ml",
    "ingredients": "PINYA, RAÏM, MANGO, MANDARINA, CIVADA SENSE GLUTEN, LLIMONA, LLÚPOL CITRA",
    "imageAlt": "NAIS can with purple artwork and a tropical hops label",
    "fruitImage": {
      "url": "images/info-card/s_hop (2).jpg",
      "alt": "hop on a purple background"
    },
    "variant": "tropical"
  },
  "pack-variat": {
    "variant": "assorted",
    "format": "Pack variat de 4 sabors (16 x 250ml)",
    "imageAlt": "Pack variat de NAIS Drinks amb Orange Spritz, Passion Hugo, Ginger Crush i Tropical Hops",
    "detailsPending": true
  },
  "tropical-hops-harvest": {
    "nutrition": [
      {
        "label": "Valor energètic",
        "value": "103 kJ / 24 kcal"
      },
      {
        "label": "Greixos",
        "value": "0,2 g"
      },
      {
        "label": "dels quals saturats",
        "value": "0,0 g"
      },
      {
        "label": "Hidrats de carboni",
        "value": "5,3 g"
      },
      {
        "label": "dels quals sucres",
        "value": "4,9 g"
      },
      {
        "label": "Proteïnes",
        "value": "0,2 g"
      },
      {
        "label": "Sal",
        "value": "<0,01 g"
      }
    ],
    "format": "pack 16 llaunes x 250 ml",
    "ingredients": "TROPICAL HOPS + FRESH HOPS CHINOOK DELS CAMPS DE BIOLUPULUS-GIRONA",
    "imageAlt": "Llauna de Tropical Hops Harvest amb il·lustracions blaves i verdes de llúpol",
    "fruitImage": {
      "url": "images/info-card/s_hop (2).jpg",
      "alt": "hop on a purple background"
    },
    "variant": "tropical",
    "isSeasonal": true,
    "badge": "NOVA COLLITA",
    "featureDescription": "Tot el caràcter de la TROPICAL HOPS amb llúpol CHINOOK fresc. Visca el verd!",
    "featureBackgroundImageUrl": "images/products/hop2.jpg"
  }
};
export const PRODUCT_DISPLAY_ORDER: readonly string[] = ["orange-spritz","passion-hugo","ginger-crush","tropical-hops","pack-variat","tropical-hops-harvest"];
