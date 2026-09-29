import type { Product } from '../components/ProductCard';
import type { ClosetId } from './types';

export const mockProducts: Partial<Record<ClosetId, Product[]>> = {
    'spring-capsule-2026': [
        {
            id: 'p1',
            name: 'Suede Bomber Jacket',
            brand: 'EVALESS',
            price: 35.99,
            image: '/images/Closets/Spring_2026_wardrobe/Jackets/Suede_bomber_jacket.jpg',
            affiliateLink: 'https://amzn.to/3PSbVmb'
        },
        {
            id: 'p2',
            name: 'Faux Leather Jacket',
            brand: 'AUTOMET',
            price: 47.99,
            originalPrice: 59.99,
            image: '/images/Closets/Spring_2026_wardrobe/Jackets/black_leather_jacket.jpg',
            affiliateLink: 'https://amzn.to/4tyYEO1'
        },
        {
            id: 'p3',
            name: 'Crop Pea Coat',
            brand: 'CHARTOU',
            price: 45.88,
            originalPrice: 54.88,
            image: '/images/Closets/Spring_2026_wardrobe/Jackets/pea_coat.jpg',
            affiliateLink: 'https://amzn.to/4mf9B4P'
        },
        {
            id: 'p4',
            name: 'Batwing Poncho Coat',
            brand: 'OPCAKM',
            price: 49.99,
            originalPrice: 53.99,
            image: '/images/Closets/Spring_2026_wardrobe/Jackets/poncho_pea_coat.jpg',
            affiliateLink: 'https://amzn.to/47Eu50W'
        },
        {
            id: 'p5',
            name: 'Breasted Trench Coat',
            brand: 'LONDON FOG',
            price: 114.95,
            image: '/images/Closets/Spring_2026_wardrobe/Jackets/long_fog_coat.jpg',
            affiliateLink: 'https://amzn.to/4mc6udX'
        },
        {
            id: 'p6',
            name: 'Denim Jacket',
            brand: 'Steve Madden',
            price: 106.58,
            image: '/images/Closets/Spring_2026_wardrobe/Jackets/denim_jacket.jpg',
            affiliateLink: 'https://amzn.to/4c1yFJf'
        },
        {
            id: 'p7',
            name: 'King Sweater',
            brand: 'Aelfric Eden',
            price: 54.99,
            image: '/images/Closets/Spring_2026_wardrobe/Sweaters/vintage_knit.jpg',
            affiliateLink: 'https://amzn.to/4mbui1v'
        },
        {
            id: 'p8',
            name: 'Button Up Cardigan',
            brand: 'BLANKNYC',
            price: 168.00,
            image: '/images/Closets/Spring_2026_wardrobe/Sweaters/cardigan.jpg',
            affiliateLink: 'https://amzn.to/4mbuiyx'
        },
        {
            id: 'p9',
            name: 'Wide Leg Sweatpants',
            brand: 'LOMON',
            price: 35.99,
            image: '/images/Closets/Spring_2026_wardrobe/Pants/baggy_white_sweatpant.jpg',
            affiliateLink: 'https://amzn.to/3NXRCTR'
        },
        {
            id: 'p10',
            name: 'High Waisted Boyfriend Jeans',
            brand: 'Mars Power',
            price: 32.38,
            originalPrice: 37.98,
            image: '/images/Closets/Spring_2026_wardrobe/Pants/straight_leg_jeans.jpg',
            affiliateLink: 'https://amzn.to/4cva1jd'
        },
        {
            id: 'p11',
            name: 'Editor Flare Pants',
            brand: 'EXPRESS',
            price: 88.00,
            image: '/images/Closets/Spring_2026_wardrobe/Pants/trousers.jpg',
            affiliateLink: 'https://amzn.to/4caI7Zy'
        },
        {
            id: 'p12',
            name: 'Wide Leg Slacks',
            brand: 'Heathyoga',
            price: 35.99,
            originalPrice: 38.99,
            image: '/images/Closets/Spring_2026_wardrobe/Pants/white_slacks.jpg',
            affiliateLink: 'https://amzn.to/4c9oMIa'
        },
        {
            id: 'p13',
            name: 'Cardigan Sweater',
            brand: 'LILLUSORY',
            price: 30.99,
            image: '/images/Closets/Spring_2026_wardrobe/Tops/cropped_cardigan.jpg',
            affiliateLink: 'https://amzn.to/4v8PGbK'
        },
        {
            id: 'p14',
            name: 'Denim T-Shirt',
            brand: 'Yimoon',
            price: 27.99,
            image: '/images/Closets/Spring_2026_wardrobe/Tops/denim_shirt.jpg',
            affiliateLink: 'https://amzn.to/41OZavg'
        },
        {
            id: 'p15',
            name: 'Button Down Shirt',
            brand: 'siliteelon',
            price: 24.99,
            image: '/images/Closets/Spring_2026_wardrobe/Tops/button_down_shirt.jpg',
            affiliateLink: 'https://amzn.to/4e9EaXo'
        },
        {
            id: 'p16',
            name: '3-Pack Cotton T-Shirts Basics',
            brand: 'Huukeay',
            price: 36.99,
            image: '/images/Closets/Spring_2026_wardrobe/Tops/cotton_tees.jpg',
            affiliateLink: 'https://amzn.to/3OhZCiy'
        },
        {
            id: 'p17',
            name: 'Sundress',
            brand: 'Parthea',
            price: 63.99,
            image: '/images/Closets/Spring_2026_wardrobe/Dresses/sundress.jpg',
            affiliateLink: 'https://amzn.to/4e3BOJI'
        },
        {
            id: 'p18',
            name: 'Flared Maxi Skirt',
            brand: 'NASHALYLY',
            price: 35.99,
            image: '/images/Closets/Spring_2026_wardrobe/Dresses/maxi_skirt.jpg',
            affiliateLink: 'https://amzn.to/4e0tTNd'
        },
        {
            id: 'p19',
            name: 'Denim Hat',
            brand: 'Tommy Hilfiger',
            price: 15.11,
            originalPrice: 19.99,
            image: '/images/Closets/Spring_2026_wardrobe/Accessories/denim_hat.jpg',
            affiliateLink: 'https://amzn.to/41ewpYU'
        },
        {
            id: 'p20',
            name: 'Square Sunglasses',
            brand: 'Michael Kors',
            price: 59.95,
            image: '/images/Closets/Spring_2026_wardrobe/Accessories/sunglasses.jpg',
            affiliateLink: 'https://amzn.to/4mdSO1V'
        },
        {
            id: 'p21',
            name: 'Versace VE4361 53',
            brand: 'Versace',
            price: 125.00,
            image: '/images/Closets/Spring_2026_wardrobe/Accessories/versace_sunglasses.jpg',
            affiliateLink: 'https://amzn.to/4sbzeEP'
        },
        {
            id: 'p22',
            name: 'Cultured Pearl Drop Earrings',
            brand: 'Ross-Simons',
            price: 175.50,
            image: '/images/Closets/Spring_2026_wardrobe/Accessories/pearl_drop_earrings.jpg',
            affiliateLink: 'https://amzn.to/41NdUL7'
        },
        {
            id: 'p23',
            name: 'Infinity Pearl Earrings',
            brand: 'Veshon',
            price: 65.99,
            image: '/images/Closets/Spring_2026_wardrobe/Accessories/infinity_pearl_earrings.jpg',
            affiliateLink: 'https://amzn.to/3O8v3M5'
        },
        {
            id: 'p24',
            name: '327 Sneaker',
            brand: 'New Balance',
            price: 104.95,
            image: '/images/Closets/Spring_2026_wardrobe/Shoes/newbalance_sneakers.jpg',
            affiliateLink: 'https://amzn.to/4e3BScq'
        },
        {
            id: 'p25',
            name: 'Ballet Flats',
            brand: 'Yellhum',
            price: 54.99,
            image: '/images/Closets/Spring_2026_wardrobe/Shoes/ballet_flats.jpg',
            affiliateLink: 'https://amzn.to/4cfrfRw'
        },
        {
            id: 'p26',
            name: 'Penny Loafers',
            brand: 'Cvistpieo',
            price: 33.29,
            image: '/images/Closets/Spring_2026_wardrobe/Shoes/loafers.jpg',
            affiliateLink: 'https://amzn.to/47JzHqz'
        },
        {
            id: 'p27',
            name: 'Low Block Heel Closed Square Toe',
            brand: 'Mary Jane',
            price: 29.99,
            image: '/images/Closets/Spring_2026_wardrobe/Shoes/heels.jpg',
            affiliateLink: 'https://amzn.to/4bR8XXH'
        },
        {
            id: 'p28',
            name: 'Presley Sandals',
            brand: 'Sam Edelman',
            price: 139.99,
            image: '/images/Closets/Spring_2026_wardrobe/Shoes/presley_sandals.jpg',
            affiliateLink: 'https://amzn.to/4c4F8Sf'
        },
        {
            id: 'p29',
            name: 'Hadyn',
            brand: 'Steve Madden',
            price: 49.99,
            image: '/images/Closets/Spring_2026_wardrobe/Shoes/sandals.jpg',
            affiliateLink: 'https://amzn.to/4meprwy'
        },
        
    ],
    'quiet-luxury': [
        {
            id: 'q1',
            name: 'Cropped Tweed Jacket',
            brand: 'M.Infisavo',
            price: 84.95,
            image: '/images/Closets/Quiet_luxury/Jackets/tweed_jacket.jpg', 
            affiliateLink: 'https://amzn.to/3O1lbE0'
        },
        {
            id: 'q2',
            name: 'Short Peacoat Overcoat',
            brand: 'UANEO',
            price: 45.99,
            image: '/images/Closets/Quiet_luxury/Jackets/peacoat_overcoat.jpg', 
            affiliateLink: 'https://amzn.to/47Ijy4M'
        },
        {
            id: 'q3',
            name: 'Double Button Peacoat',
            brand: 'Michael Kors',
            price: 79.60,
            image: '/images/Closets/Quiet_luxury/Jackets/double_button_peacoat.jpg',
            affiliateLink: 'https://amzn.to/4sjMNT1'
        },
        {
            id: 'q4',
            name: 'Wool Crop Peacoat',
            brand: 'CHARTOU',
            price: 45.88,
            image: '/images/Closets/Quiet_luxury/Jackets/Wool_crop_peacoat.jpg', 
            affiliateLink: 'https://amzn.to/4se4y5S'
        },
        {
            id: 'q5',
            name: 'Half Zip Oversized Sweatshirt',
            brand: 'PRETTYGARDEN',
            price: 38.99,
            image: '/images/Closets/Quiet_luxury/Sweaters/quarter_zip.jpg', 
            affiliateLink: 'https://amzn.to/4vgAx8s'
        },
        {
            id: 'q6',
            name: 'Pullover Quarter Zip',
            brand: 'Arach&Cloz',
            price: 34.99,
            image: '/images/Closets/Quiet_luxury/Sweaters/wool_quarter_zip.jpg', 
            affiliateLink: 'https://amzn.to/4vu47Yj'
        },
        {
            id: 'q7',
            name: 'Classic Turtleneck',
            brand: 'Pendleton',
            price: 119.00,
            image: '/images/Closets/Quiet_luxury/Sweaters/turtleneck.jpg', 
            affiliateLink: 'https://amzn.to/4sjzK3D'
        },
        {
            id: 'q8',
            name: 'Wrap Cardigan',
            brand: 'SweatyRocks',
            price: 40.99,
            image: '/images/Closets/Quiet_luxury/Sweaters/cardigan.jpg', 
            affiliateLink: 'https://amzn.to/4mdVEE7'
        },
        {
            id: 'q9',
            name: '3-pack Mock Turtleneck',
            brand: 'Oakgarden',
            price: 48.99,
            image: '/images/Closets/Quiet_luxury/Tops/3_pack_turtleneck.jpg', 
            affiliateLink: 'https://amzn.to/41MWqhU'
        },
        {
            id: 'q10',
            name: 'Mock Neck Sleeveless Blouse',
            brand: 'BLENCOT',
            price: 14.99,
            image: '/images/Closets/Quiet_luxury/Tops/tank_top.jpg', 
            affiliateLink: 'https://amzn.to/3Om1JBW'
        },
        {
            id: 'q11',
            name: 'Seamless Long Sleeve',
            brand: 'Arach&Cloz',
            price: 26.99,
            image: '/images/Closets/Quiet_luxury/Tops/layered_top.jpg', 
            affiliateLink: 'https://amzn.to/4sdsyWQ'
        },
        {
            id: 'q12',
            name: 'High Waist Pleated Trousers',
            brand: 'PRETTYGARDEN',
            price: 39.99,
            image: '/images/Closets/Quiet_luxury/Pants/Wide_white_slacks.jpg', 
            affiliateLink: 'https://amzn.to/41iT7yX'
        },
        {
            id: 'q13',
            name: 'Wide Leg Dress Pants',
            brand: 'BTFBM',
            price: 38.99,
            image: '/images/Closets/Quiet_luxury/Pants/wide_dress_pants.jpg', 
            affiliateLink: 'https://amzn.to/3O5XABV'
        },
        {
            id: 'q14',
            name: 'Ribcage Full Length Jeans',
            brand: "Levi's",
            price: 78.40,
            originalPrice: 110.00,
            image: '/images/Closets/Quiet_luxury/Pants/blue_jeans.jpg', 
            affiliateLink: 'https://amzn.to/4dvjZD7'
        },
        {
            id: 'q15',
            name: 'Wide Leg Flowy Palazzo Pant',
            brand: "KIRUNDO",
            price: 35.99,
            originalPrice: 38.99,
            image: '/images/Closets/Quiet_luxury/Pants/black_dress_pants.jpg', 
            affiliateLink: 'https://amzn.to/4sR5gXP'
        },
        {
            id: 'q16',
            name: 'Hazel Pointed Toe Pump',
            brand: "Sam Edelman",
            price: 150.00,
            image: '/images/Closets/Quiet_luxury/Shoes/pointed_toe_heels.jpg', 
            affiliateLink: 'https://amzn.to/4ttCPiK'
        },
        {
            id: 'q17',
            name: 'Kate Runner',
            brand: "Kate Spade",
            price: 198.00,
            image: '/images/Closets/Quiet_luxury/Shoes/kate_spade_sneakers.jpg', 
            affiliateLink: 'https://amzn.to/4tokQtV'
        },
        {
            id: 'q18',
            name: 'Leather Boots',
            brand: "ECCO",
            price: 194.10,
            image: '/images/Closets/Quiet_luxury/Shoes/luxury_boots.jpg', 
            affiliateLink: 'https://amzn.to/4c9rSfg'
        },
        {
            id: 'q19',
            name: 'Larina Pump',
            brand: "Steve Madden",
            price: 119.00,
            image: '/images/Closets/Quiet_luxury/Shoes/lace_pump_heels.jpg', 
            affiliateLink: 'https://amzn.to/4sjz7aq'
        },
        {
            id: 'q20',
            name: 'Brooklyn Shoulder Bag',
            brand: "Coach",
            price: 295.00,
            image: '/images/Closets/Quiet_luxury/Accessories/coach_bag.jpg', 
            affiliateLink: 'https://www.amazon.com/Coach-Courage-Shoulder-28-Black/dp/B0FHC1SFMJ/ref=sr_1_2?crid=M8XAEW3YXNNQ&dib=eyJ2IjoiMSJ9.Yd0lPEYNHVfbN8wPztNCTUbfpe__YwttTprAvD-L8OgKaDebxMmxySIihoornyc7ocrDMoOhFrcO3iJTO6Ug0CdSYg4ets-Z0OWDTG71ZH0h9nKUinXIA82-hcBpuJvPuKegwpyfHKQ53gvHpzyInOtMRVdeQKz7MQhNgUEjIKRGAAQMq7FgH0o-Bjj5kKOmulnEWVZ9iPIJchRQWPMNxWb-I92YB5-mTmWp1x1rAltIev_ao_2e25odi27ZMqDyzCJttSydYFvCyUAlnyTq7pwPNrxaqYySJNlRcDKICyo.os5YqKL96SwVxfNhhWT12zanLyTH_MUjuPTZ_iMUfRA&dib_tag=se&keywords=womens%2Bleather%2Bhandbag&qid=1771987177&refinements=p_36%3A18500-&rnid=2661611011&sprefix=womens%2Bleather%2Bhandb%2Caps%2C215&sr=8-2&th=1&psc=1'
        },
        {
            id: 'q21',
            name: 'Cashmere Scarf',
            brand: "EVSEG",
            price: 129.00,
            image: '/images/Closets/Quiet_luxury/Accessories/Cashmere_scarf.jpg', 
            affiliateLink: 'https://amzn.to/48dq57E'
        },
    ],
    'seoul-street': [
        {
            id: 's1',
            name: 'Faux Leather Track Jacket',
            brand: 'Fullneat',
            price: 50.99,
            image: '/images/Closets/Seoul_Street/Jackets/leather_track_jacket.jpg',
            affiliateLink: 'https://amzn.to/4slDkdL'
        },
        {
            id: 's2',
            name: 'Vintage Leather Cropped Jacket',
            brand: 'Aelfric Eden',
            price: 89.95,
            image: '/images/Closets/Seoul_Street/Jackets/leather_cropped_jacket.jpg',
            affiliateLink: 'https://amzn.to/4e0x8UT'
        },
        {
            id: 's3',
            name: 'Striped Shuolder Top',
            brand: 'EMMIOL',
            price: 14.99,
            image: '/images/Closets/Seoul_Street/Tops/off_shoulder_top.jpg',
            affiliateLink: 'https://amzn.to/4tu67xN'
        },
        {
            id: 's4',
            name: 'Zip Up Crop Jacket',
            brand: 'LOFAAC',
            price: 27.99,
            image: '/images/Closets/Seoul_Street/Tops/zip_up_hoodie.jpg',
            affiliateLink: 'https://amzn.to/4sR2fXw'
        },
        {
            id: 's5',
            name: 'Knit Off Shoulder Top',
            brand: 'CIDER',
            price: 18.99,
            image: '/images/Closets/Seoul_Street/Tops/off_the_shoulder_sweater.jpg',
            affiliateLink: 'https://amzn.to/4sUOffC'
        },
        {
            id: 's6',
            name: 'Oversized Graphic Tee',
            brand: 'Kelxjia',
            price: 14.99,
            image: '/images/Closets/Seoul_Street/Tops/baggy_t_shirt.jpg',
            affiliateLink: 'https://amzn.to/47FTzuJ'
        },
        {
            id: 's7',
            name: 'Vintage Baggy Tee',
            brand: 'Ponitrack',
            price: 22.99,
            image: '/images/Closets/Seoul_Street/Tops/white_baggy_shirt.jpg',
            affiliateLink: 'https://amzn.to/4tO83S3'
        },
        {
            id: 's8',
            name: 'Basic Tight Tee',
            brand: 'Abardsion',
            price: 8.54,
            image: '/images/Closets/Seoul_Street/Tops/tight_t_shirt.jpg',
            affiliateLink: 'https://amzn.to/4tlzlyO'
        },
        {
            id: 's9',
            name: 'Baggy Track Pants',
            brand: 'EMMIOL',
            price: 35.99,
            image: '/images/Closets/Seoul_Street/Pants/baggy_track_pants.jpg',
            affiliateLink: 'https://amzn.to/4szaAhX'
        },
        {
            id: 's10',
            name: 'Vintage Baggy Jeans',
            brand: 'EMMIOL',
            price: 36.79,
            image: '/images/Closets/Seoul_Street/Pants/baggy_jeans.jpg',
            affiliateLink: 'https://amzn.to/48vhf5g'
        },
        {
            id: 's11',
            name: 'Graffiti Baggy Jeans',
            brand: 'Qualitup',
            price: 35.99,
            image: '/images/Closets/Seoul_Street/Pants/y2k_star_pants.jpg',
            affiliateLink: 'https://amzn.to/41jtn5w'
        },
        {
            id: 's12',
            name: 'Bow Knot Mini Skirt',
            brand: 'MAKEMECHIC',
            price: 34.99,
            image: '/images/Closets/Seoul_Street/Dresses/ribbon_skirt.jpg',
            affiliateLink: 'https://amzn.to/4dv24fQ'
        },
        {
            id: 's13',
            name: 'Striped Mini Skirt',
            brand: 'MAKEMECHIC',
            price: 32.99,
            image: '/images/Closets/Seoul_Street/Dresses/striped_skirt.jpg',
            affiliateLink: 'https://amzn.to/4crI7W8'
        },
        {
            id: 's14',
            name: 'Vintage Denim Cap',
            brand: 'Nanwansu',
            price: 13.99,
            image: '/images/Closets/Seoul_Street/Accessories/ripped_hat.jpg',
            affiliateLink: 'https://amzn.to/4vcduLU'
        },
        {
            id: 's15',
            name: 'Necklace Star Pendant',
            brand: 'Buyongwant',
            price: 9.99,
            image: '/images/Closets/Seoul_Street/Accessories/y2k_necklace.jpg',
            affiliateLink: 'https://amzn.to/3O6Ig8i'
        },
        {
            id: 's16',
            name: 'Denim Shoulder Bag',
            brand: 'YeFine',
            price: 35.14,
            image: '/images/Closets/Seoul_Street/Accessories/denim_purse_bag.jpg',
            affiliateLink: 'https://amzn.to/4toetH6'
        },
        {
            id: 's17',
            name: 'Small Underarm bag',
            brand: 'YIKOEE',
            price: 24.99,
            originalPrice: 26.99,
            image: '/images/Closets/Seoul_Street/Accessories/shoulder_bag.jpg',
            affiliateLink: 'https://amzn.to/4sTLPh6'
        },
        {
            id: 's18',
            name: '530 Running Shoes',
            brand: 'New Balance',
            price: 101.95,
            originalPrice: 110.50,
            image: '/images/Closets/Seoul_Street/Shoes/new_balance_sneakers.jpg',
            affiliateLink: 'https://amzn.to/4mcbu1Z'
        },
        {
            id: 's19',
            name: 'Chunky Penny Loafers',
            brand: 'DREAM PAIRS',
            price: 34.39,
            originalPrice: 42.99,
            image: '/images/Closets/Seoul_Street/Shoes/loafers.jpg',
            affiliateLink: 'https://amzn.to/4mc7Hlu'
        },
        {
            id: 's20',
            name: 'Omega Trainer Sneaker',
            brand: 'Converse',
            price: 75.00,
            image: '/images/Closets/Seoul_Street/Shoes/converse_sneakers.jpg',
            affiliateLink: 'https://amzn.to/4vhOsv4'
        }
    ],
    'y2k-vintage': [
        {
            id: 'y1', 
            name: 'Fairy Grunge Vintage Top',
            brand: 'GGOOB',
            price: 16.99,
            originalPrice: 19.99,
            image: '/images/Closets/y2k_vintage/Tops/wide_v-neck.jpg',
            affiliateLink: 'https://amzn.to/4tqzaCd'
        },
        {
            id: 'y2', 
            name: 'Vintage Graphic Tee',
            brand: 'GGOOB',
            price: 14.99,
            image: '/images/Closets/y2k_vintage/Tops/vintage_graphic_blouse.jpg',
            affiliateLink: 'https://amzn.to/4mbxN89'
        },
        {
            id: 'y3', 
            name: 'Graphic Baby Tee',
            brand: 'MANGMAO',
            price: 14.99,
            image: '/images/Closets/y2k_vintage/Tops/shirt_with_top.jpg',
            affiliateLink: 'https://amzn.to/4cqofTp'
        },
        {
            id: 'y4', 
            name: 'Sleeveless Floral Tank',
            brand: 'SUEER',
            price: 14.99,
            image: '/images/Closets/y2k_vintage/Tops/pink_top.jpg',
            affiliateLink: 'https://amzn.to/4sOl0Lf'
        },
        {
            id: 'y5', 
            name: 'Coquette Vintage Graphic Tee',
            brand: 'RICHTRUE',
            price: 14.99,
            image: '/images/Closets/y2k_vintage/Tops/frilly_blouse.jpg',
            affiliateLink: 'https://amzn.to/4dAcbAd'
        },
        {
            id: 'y6', 
            name: 'Off Shoulder Cinched Top',
            brand: 'Verdusa',
            price: 28.99,
            image: '/images/Closets/y2k_vintage/Tops/spaghetti_strap_top.jpg',
            affiliateLink: 'https://amzn.to/4m9uhLD'
        },
        {
            id: 'y7', 
            name: 'Fur Vintage Zip Up',
            brand: 'RICHTRUE',
            price: 43.99,
            image: '/images/Closets/y2k_vintage/Sweaters/zip_up_fur_hoodiejpg.jpg',
            affiliateLink: 'https://amzn.to/4cqoldJ'
        },
        {
            id: 'y8', 
            name: 'Vintage Slim Fit Coat',
            brand: 'JEFQJDJ',
            price: 52.99,
            image: '/images/Closets/y2k_vintage/Sweaters/fuzzy_knit_cardigan.jpg',
            affiliateLink: 'https://amzn.to/4sbCAYr'
        },
        {
            id: 'y9', 
            name: 'Leather Jacket',
            brand: 'Decrum',
            price: 187.00,
            image: '/images/Closets/y2k_vintage/Sweaters/leather_jacket.jpg',
            affiliateLink: 'https://amzn.to/4c8vHBu'
        },
        {
            id: 'y10', 
            name: 'Vintage Grunge Cardigan',
            brand: 'Vhitler',
            price: 27.99,
            image: '/images/Closets/y2k_vintage/Sweaters/vintage_cardigan.jpg',
            affiliateLink: 'https://amzn.to/4cpPQ78'
        },
        {
            id: 'y11', 
            name: 'Knit Vintage Cardigan',
            brand: 'Xiulaiyi',
            price: 24.99,
            image: '/images/Closets/y2k_vintage/Sweaters/y2k_vintage_cardigan.jpg',
            affiliateLink: 'https://amzn.to/4c1QiXW'
        },
        {
            id: 'y12', 
            name: 'Low Rise Micro Jean',
            brand: 'Verdusa',
            price: 35.99,
            image: '/images/Closets/y2k_vintage/Pants/micro_jean_shorts.jpg',
            affiliateLink: 'https://amzn.to/4dAcfzX'
        },
        {
            id: 'y13', 
            name: 'Low Rise Flare Jeans',
            brand: 'Justalwart',
            price: 35.90,
            image: '/images/Closets/y2k_vintage/Pants/low_waisted_jeans.jpg',
            affiliateLink: 'https://amzn.to/4e3Lynh'
        },
        {
            id: 'y14', 
            name: 'Vintage Low Rise Baggy Jeans',
            brand: 'Djeanxa',
            price: 35.99,
            image: '/images/Closets/y2k_vintage/Pants/low_rise_flare_jeans.jpg',
            affiliateLink: 'https://amzn.to/4dNM2Ov'
        },
        {
            id: 'y15', 
            name: 'Bottom Stretchy Flare Jeans',
            brand: 'EMMIOL',
            price: 39.99,
            image: '/images/Closets/y2k_vintage/Pants/graphic_low_waisted_jeans.jpg',
            affiliateLink: 'https://amzn.to/4cbM9Rp'
        },
        {
            id: 'y16', 
            name: 'Rhinestone Flare Pants',
            brand: 'Bosloga',
            price: 31.99,
            image: '/images/Closets/y2k_vintage/Pants/drawstring_sweatpants.jpg',
            affiliateLink: 'https://amzn.to/41P3oTE'
        },
        {
            id: 'y17', 
            name: 'Lace Up Mini Skirt',
            brand: 'WDIRARA',
            price: 35.99,
            image: '/images/Closets/y2k_vintage/Dresses/denim_mini_skirt.jpg',
            affiliateLink: 'https://amzn.to/41iTNV1'
        },
        {
            id: 'y18', 
            name: 'Sequin Mini Skirt',
            brand: 'Floerns',
            price: 24.99,
            image: '/images/Closets/y2k_vintage/Dresses/floral_skirt.jpg',
            affiliateLink: 'https://amzn.to/4tyzGhQ'
        },
        {
            id: 'y19', 
            name: 'Low Rise Pleated Skirt',
            brand: 'Floerns',
            price: 37.99,
            image: '/images/Closets/y2k_vintage/Dresses/brown_belt_skirt.jpg',
            affiliateLink: 'https://amzn.to/4se5iYI'
        },
        {
            id: 'y20', 
            name: 'Coquette Maxi Skirt',
            brand: 'SOLILOQUY',
            price: 19.99,
            image: '/images/Closets/y2k_vintage/Dresses/maxi_skirt.jpg',
            affiliateLink: 'https://amzn.to/3NNToXE'
        },
        {
            id: 'y21', 
            name: 'Ruffle Tiered Mini Dress',
            brand: 'Verdusa',
            price: 39.99,
            image: '/images/Closets/y2k_vintage/Dresses/blue_full_dress.jpg',
            affiliateLink: 'https://amzn.to/41SetmQ'
        },
        {
            id: 'y22', 
            name: 'Leopard Print Backkless Mesh Dress',
            brand: 'WDIRARA',
            price: 38.99,
            image: '/images/Closets/y2k_vintage/Dresses/red_full_dress.jpg',
            affiliateLink: 'https://amzn.to/47IkdDi'
        },
        {
            id: 'y23', 
            name: 'Hobo Shoulder Bag',
            brand: 'FQELJ',
            price: 19.99,
            image: '/images/Closets/y2k_vintage/Accessories/leather_bag.jpg',
            affiliateLink: 'https://amzn.to/3Om23R9'
        },
        {
            id: 'y24', 
            name: 'Leather Shoulder Purse',
            brand: 'Angel Kiss',
            price: 39.99,
            image: '/images/Closets/y2k_vintage/Accessories/large_denim_bag.jpg',
            affiliateLink: 'https://amzn.to/3Q46dO1'
        },
        {
            id: 'y25', 
            name: 'Hair Clip',
            brand: 'Camila Paris',
            price: 9.99,
            image: '/images/Closets/y2k_vintage/Accessories/hair_clip.jpg',
            affiliateLink: 'https://amzn.to/3O8yPVL'
        },
        {
            id: 'y26', 
            name: 'Margot Heeled Sandals',
            brand: 'Coach',
            price: 175.00,
            image: '/images/Closets/y2k_vintage/Shoes/sandal_heels.jpg',
            affiliateLink: 'https://www.amazon.com/Coach-Womens-Margot-Burnished-9-5/dp/B0DJCGR5MN/ref=sr_1_14?crid=2FQ50JKL58X0Z&dib=eyJ2IjoiMSJ9.bNPodSLYYvIHbO2lcLF3_K5gaqwsY6S0DmdpNkWzWbaKOGWyWpDs9uFX-y_qpoOuNxySfvPKztOLCzQC2IvdhCo_GpjiIKZkN3yfrEFF_D362UI3xgVlaJqVZAhxeMvn3ywDm2joUIRWUv7K9Skhntvz43nrNd0Sm4Zmax8Nq64nXNdiHxYS6URXRfc9XbF97PcJFKCieOkRkDvMJadG6w.pKrf3trLH0B8X9C68NmTjAZkrPB8G7b9BgbiYXgW0Pk&dib_tag=se&keywords=y2k%2Bvintage%2Bheels%2Bcoach&qid=1772760046&sprefix=y2k%2Bvintage%2Bheels%2Bcoach%2Caps%2C158&sr=8-14&th=1&psc=1'
        },
        {
            id: 'y27', 
            name: 'Leather Block Heel Sandals',
            brand: 'Coach',
            price: 118.02,
            image: '/images/Closets/y2k_vintage/Shoes/leather_sandal_heels.jpg',
            affiliateLink: 'https://www.amazon.com/COACH-Sculpted-Leather-Sandals-Medium/dp/B0F4HDS4XZ/ref=sr_1_9?crid=2FQ50JKL58X0Z&dib=eyJ2IjoiMSJ9.bNPodSLYYvIHbO2lcLF3_K5gaqwsY6S0DmdpNkWzWbaKOGWyWpDs9uFX-y_qpoOuNxySfvPKztOLCzQC2IvdhCo_GpjiIKZkN3yfrEFF_D362UI3xgVlaJqVZAhxeMvn3ywDm2joUIRWUv7K9Skhntvz43nrNd0Sm4Zmax8Nq64nXNdiHxYS6URXRfc9XbF97PcJFKCieOkRkDvMJadG6w.pKrf3trLH0B8X9C68NmTjAZkrPB8G7b9BgbiYXgW0Pk&dib_tag=se&keywords=y2k%2Bvintage%2Bheels%2Bcoach&qid=1772760069&sprefix=y2k%2Bvintage%2Bheels%2Bcoach%2Caps%2C158&sr=8-9&th=1&psc=1'
        },
        {
            id: 'y28', 
            name: 'Crystal Signature Jacquard Sandal',
            brand: 'Coach',
            price: 225.00,
            image: '/images/Closets/y2k_vintage/Shoes/plaid_tall_heels.jpg',
            affiliateLink: 'https://www.amazon.com/Crystal-Signature-Jacquard-Platform-Sandal/dp/B0F9NR1Y52/ref=sr_1_7?crid=2FQ50JKL58X0Z&dib=eyJ2IjoiMSJ9.bNPodSLYYvIHbO2lcLF3_K5gaqwsY6S0DmdpNkWzWbaKOGWyWpDs9uFX-y_qpoOuNxySfvPKztOLCzQC2IvdhCo_GpjiIKZkN3yfrEFF_D362UI3xgVlaJqVZAhxeMvn3ywDm2joUIRWUv7K9Skhntvz43nrNd0Sm4Zmax8Nq64nXNdiHxYS6URXRfc9XbF97PcJFKCieOkRkDvMJadG6w.pKrf3trLH0B8X9C68NmTjAZkrPB8G7b9BgbiYXgW0Pk&dib_tag=se&keywords=y2k%2Bvintage%2Bheels%2Bcoach&qid=1772760069&sprefix=y2k%2Bvintage%2Bheels%2Bcoach%2Caps%2C158&sr=8-7&th=1&psc=1'
        },
        {
            id: 'y29', 
            name: 'Margot Slingbacks',
            brand: 'Coach',
            price: 225.00,
            image: '/images/Closets/y2k_vintage/Shoes/pointy_plaid_heels.jpg',
            affiliateLink: 'https://www.amazon.com/COACH-Slingback-Signature-Jacquard-Burnished/dp/B0FHJ6X5SS/ref=sr_1_4?crid=2FQ50JKL58X0Z&dib=eyJ2IjoiMSJ9.bNPodSLYYvIHbO2lcLF3_K5gaqwsY6S0DmdpNkWzWbaKOGWyWpDs9uFX-y_qpoOuNxySfvPKztOLCzQC2IvdhCo_GpjiIKZkN3yfrEFF_D362UI3xgVlaJqVZAhxeMvn3ywDm2joUIRWUv7K9Skhntvz43nrNd0Sm4Zmax8Nq64nXNdiHxYS6URXRfc9XbF97PcJFKCieOkRkDvMJadG6w.pKrf3trLH0B8X9C68NmTjAZkrPB8G7b9BgbiYXgW0Pk&dib_tag=se&keywords=y2k%2Bvintage%2Bheels%2Bcoach&qid=1772760069&sprefix=y2k%2Bvintage%2Bheels%2Bcoach%2Caps%2C158&sr=8-4&th=1&psc=1'
        },
        {
            id: 'y30', 
            name: 'Mid Calf Lace Up Boots',
            brand: 'Saralris',
            price: 49.99,
            image: '/images/Closets/y2k_vintage/Shoes/high_leather_boots.jpg',
            affiliateLink: 'https://amzn.to/4cqHE6I'
        },
        {
            id: 'y31', 
            name: 'Buckle Grommet Flat Sandals',
            brand: 'Verdusa',
            price: 19.99,
            image: '/images/Closets/y2k_vintage/Shoes/sandals.jpg',
            affiliateLink: 'https://amzn.to/41P3z1g'
        },
    ],
    'desk-to-dusk': [
        {
            id: 'd1',
            name: 'Babydoll Cap Sleeve Blouse',
            brand: 'Cicy Bell',
            price: 19.99,
            image: '/images/Closets/desk-to-dusk/Tops/babydoll_blouse.jpg',
            affiliateLink: 'https://amzn.to/4sjxFF8'
        },
        {
            id: 'd2',
            name: 'Mock Neck Blouse',
            brand: 'Milumia',
            price: 17.99,
            image: '/images/Closets/desk-to-dusk/Tops/mock_neck_blouse.jpg',
            affiliateLink: 'https://amzn.to/4vbar6L'
        },
        {
            id: 'd3',
            name: 'Classic Button Down Shirt',
            brand: 'Gleeivy',
            price: 17.99,
            image: '/images/Closets/desk-to-dusk/Tops/black_button_down_shirt.jpg',
            affiliateLink: 'https://amzn.to/3QlV23i'
        },
        {
            id: 'd4',
            name: 'Striped Button Down Shirt',
            brand: 'COUXILY',
            price: 24.99,
            image: '/images/Closets/desk-to-dusk/Tops/striped_button_down_shirt.jpg',
            affiliateLink: 'https://amzn.to/4mdYx80'
        },
        {
            id: 'd5',
            name: 'Cotton Dress Shirt',
            brand: 'Mutitop',
            price: 17.09,
            image: '/images/Closets/desk-to-dusk/Tops/cotton_dress_shirt.jpg',
            affiliateLink: 'https://amzn.to/4bUjS2M'
        },
        {
            id: 'd6',
            name: 'Knit Cardigan',
            brand: 'Blanstore',
            price: 39.99,
            image: '/images/Closets/desk-to-dusk/Jackets/crewneck_button_down.jpg',
            affiliateLink: 'https://amzn.to/4c2oUsN'
        },
        {
            id: 'd7',
            name: 'Plaid Lightweight Blazer',
            brand: 'Mina Self',
            price: 52.99,
            image: '/images/Closets/desk-to-dusk/Jackets/plaid_houndstooth_blazer.jpg',
            affiliateLink: 'https://amzn.to/4bRczJf'
        },
        {
            id: 'd8',
            name: 'Button Down Mock Neck Cardigan',
            brand: 'Cicy Bell',
            price: 37.99,
            image: '/images/Closets/desk-to-dusk/Jackets/mock_neck_button_down.jpg',
            affiliateLink: 'https://amzn.to/3NZgZoi'
        },
        {
            id: 'd9',
            name: 'Low Rise Dress Pants',
            brand: 'GORGLITTER',
            price: 35.99,
            image: '/images/Closets/desk-to-dusk/Pants/low_rise_dress_pants.jpg',
            affiliateLink: 'https://amzn.to/4sNzFq9'
        },
        {
            id: 'd10',
            name: 'Wide Leg Long Palazzo Pants',
            brand: 'Tronjori',
            price: 33.99,
            image: '/images/Closets/desk-to-dusk/Pants/wide_leg_palazzo_pants.jpg',
            affiliateLink: 'https://amzn.to/4sfGcJe'
        },
        {
            id: 'd11',
            name: 'Wide Leg Dress Pants',
            brand: 'ELLEVEN',
            price: 31.99,
            image: '/images/Closets/desk-to-dusk/Pants/grey_wide_leg_dress_pants.jpg',
            affiliateLink: 'https://amzn.to/4mc8OkV'
        },
        {
            id: 'd12',
            name: 'Poined Toe Pumps',
            brand: 'Mostrin',
            price: 39.99,
            image: '/images/Closets/desk-to-dusk/Shoes/kitten_heels.jpg',
            affiliateLink: 'https://amzn.to/4crIEHC'
        },
        {
            id: 'd13',
            name: 'Margot Sandal',
            brand: 'Coach',
            price: 175.00,
            image: '/images/Closets/desk-to-dusk/Shoes/coach_margot_sandal.jpg',
            affiliateLink: 'https://www.amazon.com/COACH-Margot-Signature-Canvas-Sandal/dp/B0FWTXQP26/ref=sr_1_30?crid=2GEGR1KG6RU86&dib=eyJ2IjoiMSJ9.zX9Xb46bf4v1GEkV7UzQhGxEQ7rAMmbvhXBMPQMLRrW94pymCUGENANPHeauzx2XKKRMDlsjVLH8x8Tf2InRsoFL-7lJrm3t_plk2Ao6j2R-XK4ZFxGZZReN4l1J713n7U4wNhjBcmS66LDzV8A0_TCPyMfVQhjb0p1QsrmeEYNFTIt8errtBkSGcNm6eLWlvpGKokooaW4Ehj-6UkXoalOVuF0V0CeAeT1l8dGZBP4ICC5Lp2ziINgTs7IA4sJV21TvPllDb1L5An0lAkWq0kdtaXQ7h6OAvSGeSGUTWE8.tWBd3fy2oz4PibPw9KalXXdk4HoUxz2HZzmJl1-WOo8&dib_tag=se&keywords=kitten%2Bheels&qid=1772078730&sprefix=kitten%2Bheels%2Caps%2C179&sr=8-30&th=1&psc=1',
        },
        {
            id: 'd14',
            name: 'Kitten Heel Ankle Boots',
            brand: 'Coutgo',
            price: 39.99,
            image: '/images/Closets/desk-to-dusk/Shoes/ankle_boots_kitten_heel.jpg',
            affiliateLink: 'https://amzn.to/3PPnwCw'
        },
        {
            id: 'd15',
            name: 'Leather Belt',
            brand: 'TRIWORKS',
            price: 14.99,
            image: '/images/Closets/desk-to-dusk/Accessories/leather_belt.jpg',
            affiliateLink: 'https://amzn.to/4caMioc'
        },
        {
            id: 'd16',
            name: 'Gold Earrings',
            brand: 'TRIWORKS',
            price: 13.95,
            image: '/images/Closets/desk-to-dusk/Accessories/gold_earrings.jpg',
            affiliateLink: 'https://amzn.to/4dvaC6w'
        }
    ]
};

// Fallback for closets without specific mock data
export const defaultMockProducts: Product[] = [
    {
        id: 'd1',
        name: 'Classic White Tee',
        brand: 'Everlane',
        price: 30.00,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1000&auto=format&fit=crop',
        affiliateLink: 'https://amazon.com'
    },
    {
        id: 'd2',
        name: 'Straight Leg Jeans',
        brand: 'Levi\'s',
        price: 98.00,
        image: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?q=80&w=1000&auto=format&fit=crop',
        affiliateLink: 'https://amazon.com'
    },
    {
        id: 'd3',
        name: 'Wool Blend Coat',
        brand: 'Theory',
        price: 395.00,
        originalPrice: 595.00,
        image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?q=80&w=1000&auto=format&fit=crop',
        affiliateLink: 'https://amazon.com'
    },
    {
        id: 'd4',
        name: 'Classic White Tee',
        brand: 'Everlane',
        price: 30.00,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1000&auto=format&fit=crop',
        affiliateLink: 'https://amazon.com'
    },
    {
        id: 'd5',
        name: 'Straight Leg Jeans',
        brand: 'Levi\'s',
        price: 98.00,
        image: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?q=80&w=1000&auto=format&fit=crop',
        affiliateLink: 'https://amazon.com'
    },
    {
        id: 'd6',
        name: 'Wool Blend Coat',
        brand: 'Theory',
        price: 395.00,
        originalPrice: 595.00,
        image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?q=80&w=1000&auto=format&fit=crop',
        affiliateLink: 'https://amazon.com'
    }
];
