import { CA } from '../i18n/ca';
import type { Product } from '../models/product.interface';

/** Presentation and nutrition not yet provided by the public API. Never defines availability or price. */
type Presentation = Pick<Product, 'nutrition' | 'format' | 'ingredients' | 'imageAlt' | 'fruitImage' | 'variant' | 'detailsPending' | 'isSeasonal' | 'isFeatured' | 'badge' | 'featureDescription' | 'featureImageAlt' | 'featureBackgroundImageUrl'>;
export const PRODUCT_PRESENTATION: Readonly<Record<string, Presentation>> = {
  "orange-spritz": {
    "nutrition": [
      {
        "label": CA['ui.valor_energetic'],
        "value": "98 kJ / 23 kcal"
      },
      {
        "label": CA['ui.greixos'],
        "value": "0,0 g"
      },
      {
        "label": CA['ui.dels_quals_saturats'],
        "value": "0,0 g"
      },
      {
        "label": CA['ui.hidrats_de_carboni'],
        "value": "5,2 g"
      },
      {
        "label": CA['ui.dels_quals_sucres'],
        "value": "4,8 g"
      },
      {
        "label": CA['ui.proteines'],
        "value": "0,1 g"
      },
      {
        "label": CA['ui.sal'],
        "value": "<0,01 g"
      }
    ],
    "format": CA['ui.pack_16_llaunes_x_250ml'],
    "ingredients": CA['product.orangeSpritz.ingredients'],
    "imageAlt": CA['ui.nais_orange_spritz_can_with_blue_fruit_artwork'],
    "fruitImage": {
      "url": "images/info-card/orange.png",
      "alt": CA['ui.orange_fruit_on_a_blue_background']
    },
    "variant": "citrus"
  },
  "passion-hugo": {
    "nutrition": [
      {
        "label": CA['ui.valor_energetic'],
        "value": "99 kJ / 23 kcal"
      },
      {
        "label": CA['ui.greixos'],
        "value": "0,0 g"
      },
      {
        "label": CA['ui.dels_quals_saturats'],
        "value": "0,0 g"
      },
      {
        "label": CA['ui.hidrats_de_carboni'],
        "value": "5,1 g"
      },
      {
        "label": CA['ui.dels_quals_sucres'],
        "value": "4,9 g"
      },
      {
        "label": CA['ui.proteines'],
        "value": "0,1 g"
      },
      {
        "label": CA['ui.sal'],
        "value": "<0,01 g"
      }
    ],
    "format": CA['ui.pack_16_llaunes_x_250ml'],
    "ingredients": CA['ui.llimona_menta_flor_de_sauc_poma_fruita_de_la_passio'],
    "imageAlt": CA['ui.nais_passion_hugo_can_with_green_fruit_artwork'],
    "fruitImage": {
      "url": "images/info-card/lemon.jpg",
      "alt": CA['ui.lemon_fruit_on_a_green_background']
    },
    "variant": "botanical"
  },
  "ginger-crush": {
    "nutrition": [
      {
        "label": CA['ui.valor_energetic'],
        "value": "102 kJ / 24 kcal"
      },
      {
        "label": CA['ui.greixos'],
        "value": "0,0 g"
      },
      {
        "label": CA['ui.dels_quals_saturats'],
        "value": "0,0 g"
      },
      {
        "label": CA['ui.hidrats_de_carboni'],
        "value": "5,3 g"
      },
      {
        "label": CA['ui.dels_quals_sucres'],
        "value": "5,1 g"
      },
      {
        "label": CA['ui.proteines'],
        "value": "0,1 g"
      },
      {
        "label": CA['ui.sal'],
        "value": "<0,01 g"
      }
    ],
    "format": CA['ui.pack_16_llaunes_x_250ml'],
    "ingredients": CA['ui.llimona_poma_gingebre_mango'],
    "imageAlt": CA['ui.nais_can_with_pink_fruit_artwork_and_a_ginger_crush_label'],
    "fruitImage": {
      "url": "images/info-card/mango.png",
      "alt": CA['ui.mango_fruit_on_a_pink_background']
    },
    "variant": "ginger"
  },
  "tropical-hops": {
    "nutrition": [
      {
        "label": CA['ui.valor_energetic'],
        "value": "103 kJ / 24 kcal"
      },
      {
        "label": CA['ui.greixos'],
        "value": "0,2 g"
      },
      {
        "label": CA['ui.dels_quals_saturats'],
        "value": "0,0 g"
      },
      {
        "label": CA['ui.hidrats_de_carboni'],
        "value": "5,3 g"
      },
      {
        "label": CA['ui.dels_quals_sucres'],
        "value": "4,9 g"
      },
      {
        "label": CA['ui.proteines'],
        "value": "0,2 g"
      },
      {
        "label": CA['ui.sal'],
        "value": "<0,01 g"
      }
    ],
    "format": CA['ui.pack_16_llaunes_x_250_ml'],
    "ingredients": CA['ui.pinya_raim_mango_mandarina_civada_sense_gluten_llimona_llupol_citra'],
    "imageAlt": CA['ui.nais_can_with_purple_artwork_and_a_tropical_hops_label'],
    "fruitImage": {
      "url": "images/info-card/s_hop (2).jpg",
      "alt": CA['ui.hop_on_a_purple_background']
    },
    "variant": "tropical"
  },
  "pack-variat": {
    "variant": "assorted",
    "format": CA['ui.pack_variat_de_4_sabors_16_x_250ml'],
    "imageAlt": CA['ui.pack_variat_de_nais_drinks_amb_orange_spritz_passion_hugo_ginger_crush_i_tropica'],
    "detailsPending": true
  },
  "tropical-hops-harvest": {
    "nutrition": [
      {
        "label": CA['ui.valor_energetic'],
        "value": "103 kJ / 24 kcal"
      },
      {
        "label": CA['ui.greixos'],
        "value": "0,2 g"
      },
      {
        "label": CA['ui.dels_quals_saturats'],
        "value": "0,0 g"
      },
      {
        "label": CA['ui.hidrats_de_carboni'],
        "value": "5,3 g"
      },
      {
        "label": CA['ui.dels_quals_sucres'],
        "value": "4,9 g"
      },
      {
        "label": CA['ui.proteines'],
        "value": "0,2 g"
      },
      {
        "label": CA['ui.sal'],
        "value": "<0,01 g"
      }
    ],
    "format": CA['ui.pack_16_llaunes_x_250_ml'],
    "ingredients": CA['ui.tropical_hops_fresh_hops_chinook_dels_camps_de_biolupulus_girona'],
    "imageAlt": CA['ui.llauna_de_tropical_hops_harvest_amb_illustracions_blaves_i_verdes_de_llupol'],
    "fruitImage": {
      "url": "images/info-card/s_hop (2).jpg",
      "alt": CA['ui.hop_on_a_purple_background']
    },
    "variant": "tropical",
    "isSeasonal": true,
    "badge": CA['ui.nova_collita'],
    "featureDescription": CA['ui.tot_el_caracter_de_la_tropical_hops_amb_llupol_chinook_fresc_visca_el_verd'],
    "featureBackgroundImageUrl": "images/products/hop2.jpg"
  }
};
export const PRODUCT_DISPLAY_ORDER: readonly string[] = ["orange-spritz","passion-hugo","ginger-crush","tropical-hops","pack-variat","tropical-hops-harvest"];
