/**
 * Compact emoji dataset organised by Discord-style categories.
 *
 * Each entry is a tuple: [emoji, shortcode]
 * Shortcodes follow Discord / GitHub conventions (no colons stored).
 */

export interface EmojiEntry {
  emoji: string;
  shortcode: string;
  category: string;
}

export const EMOJI_CATEGORIES = [
  { id: "frequentlyUsed", label: "Frequently Used", icon: "\uD83D\uDD54" },
  { id: "smileys", label: "Smileys & People", icon: "\uD83D\uDE00" },
  { id: "animals", label: "Animals & Nature", icon: "\uD83D\uDC3B" },
  { id: "food", label: "Food & Drink", icon: "\uD83C\uDF54" },
  { id: "activities", label: "Activities", icon: "\u26BD" },
  { id: "travel", label: "Travel & Places", icon: "\u2708\uFE0F" },
  { id: "objects", label: "Objects", icon: "\uD83D\uDCA1" },
  { id: "symbols", label: "Symbols", icon: "\u2764\uFE0F" },
  { id: "flags", label: "Flags", icon: "\uD83C\uDFF3\uFE0F" },
] as const;

type Pair = [string, string];

const smileys: Pair[] = [
  ["\uD83D\uDE00", "grinning"],
  ["\uD83D\uDE03", "smiley"],
  ["\uD83D\uDE04", "smile"],
  ["\uD83D\uDE01", "grin"],
  ["\uD83D\uDE06", "laughing"],
  ["\uD83D\uDE05", "sweat_smile"],
  ["\uD83E\uDD23", "rofl"],
  ["\uD83D\uDE02", "joy"],
  ["\uD83D\uDE42", "slightly_smiling_face"],
  ["\uD83D\uDE43", "upside_down_face"],
  ["\uD83D\uDE09", "wink"],
  ["\uD83D\uDE0A", "blush"],
  ["\uD83D\uDE07", "innocent"],
  ["\uD83E\uDD70", "smiling_face_with_hearts"],
  ["\uD83D\uDE0D", "heart_eyes"],
  ["\uD83E\uDD29", "star_struck"],
  ["\uD83D\uDE18", "kissing_heart"],
  ["\uD83D\uDE17", "kissing"],
  ["\uD83D\uDE1A", "kissing_closed_eyes"],
  ["\uD83D\uDE19", "kissing_smiling_eyes"],
  ["\uD83E\uDD72", "smiling_face_with_tear"],
  ["\uD83D\uDE0B", "yum"],
  ["\uD83D\uDE1B", "stuck_out_tongue"],
  ["\uD83D\uDE1C", "stuck_out_tongue_winking_eye"],
  ["\uD83E\uDD2A", "zany_face"],
  ["\uD83D\uDE1D", "stuck_out_tongue_closed_eyes"],
  ["\uD83E\uDD11", "money_mouth_face"],
  ["\uD83E\uDD17", "hugs"],
  ["\uD83E\uDD2D", "hand_over_mouth"],
  ["\uD83E\uDD2B", "shushing_face"],
  ["\uD83E\uDD14", "thinking"],
  ["\uD83E\uDD10", "zipper_mouth_face"],
  ["\uD83E\uDD28", "raised_eyebrow"],
  ["\uD83D\uDE10", "neutral_face"],
  ["\uD83D\uDE11", "expressionless"],
  ["\uD83D\uDE36", "no_mouth"],
  ["\uD83D\uDE0F", "smirk"],
  ["\uD83D\uDE12", "unamused"],
  ["\uD83D\uDE44", "roll_eyes"],
  ["\uD83D\uDE2C", "grimacing"],
  ["\uD83E\uDD25", "lying_face"],
  ["\uD83D\uDE0C", "relieved"],
  ["\uD83D\uDE14", "pensive"],
  ["\uD83D\uDE2A", "sleepy"],
  ["\uD83E\uDD24", "drooling_face"],
  ["\uD83D\uDE34", "sleeping"],
  ["\uD83D\uDE37", "mask"],
  ["\uD83E\uDD12", "face_with_thermometer"],
  ["\uD83E\uDD15", "head_bandage"],
  ["\uD83E\uDD22", "nauseated_face"],
  ["\uD83E\uDD2E", "vomiting"],
  ["\uD83E\uDD27", "sneezing_face"],
  ["\uD83E\uDD75", "hot_face"],
  ["\uD83E\uDD76", "cold_face"],
  ["\uD83E\uDD74", "woozy_face"],
  ["\uD83D\uDE35", "dizzy_face"],
  ["\uD83E\uDD2F", "exploding_head"],
  ["\uD83E\uDD20", "cowboy_hat_face"],
  ["\uD83E\uDD73", "partying_face"],
  ["\uD83E\uDD78", "disguised_face"],
  ["\uD83D\uDE0E", "sunglasses"],
  ["\uD83E\uDD13", "nerd_face"],
  ["\uD83E\uDDD0", "monocle_face"],
  ["\uD83D\uDE15", "confused"],
  ["\uD83D\uDE1F", "worried"],
  ["\uD83D\uDE41", "slightly_frowning_face"],
  ["\uD83D\uDE2E", "open_mouth"],
  ["\uD83D\uDE2F", "hushed"],
  ["\uD83D\uDE32", "astonished"],
  ["\uD83D\uDE33", "flushed"],
  ["\uD83E\uDD7A", "pleading_face"],
  ["\uD83D\uDE26", "frowning"],
  ["\uD83D\uDE27", "anguished"],
  ["\uD83D\uDE28", "fearful"],
  ["\uD83D\uDE30", "cold_sweat"],
  ["\uD83D\uDE25", "disappointed_relieved"],
  ["\uD83D\uDE22", "cry"],
  ["\uD83D\uDE2D", "sob"],
  ["\uD83D\uDE31", "scream"],
  ["\uD83D\uDE16", "confounded"],
  ["\uD83D\uDE23", "persevere"],
  ["\uD83D\uDE1E", "disappointed"],
  ["\uD83D\uDE13", "sweat"],
  ["\uD83D\uDE29", "weary"],
  ["\uD83D\uDE2B", "tired_face"],
  ["\uD83E\uDD71", "yawning_face"],
  ["\uD83D\uDE24", "triumph"],
  ["\uD83D\uDE21", "rage"],
  ["\uD83D\uDE20", "angry"],
  ["\uD83E\uDD2C", "cursing_face"],
  ["\uD83D\uDE08", "smiling_imp"],
  ["\uD83D\uDC7F", "imp"],
  ["\uD83D\uDC80", "skull"],
  ["\uD83D\uDCA9", "poop"],
  ["\uD83E\uDD21", "clown_face"],
  ["\uD83D\uDC7B", "ghost"],
  ["\uD83D\uDC7D", "alien"],
  ["\uD83E\uDD16", "robot"],
  ["\uD83D\uDE3A", "smiley_cat"],
  ["\uD83D\uDE38", "smile_cat"],
  ["\uD83D\uDE39", "joy_cat"],
  ["\uD83D\uDE3B", "heart_eyes_cat"],
  ["\uD83D\uDE3C", "smirk_cat"],
  ["\uD83D\uDE3D", "kissing_cat"],
  ["\uD83D\uDE40", "scream_cat"],
  ["\uD83D\uDE3F", "crying_cat_face"],
  ["\uD83D\uDE3E", "pouting_cat"],
  ["\uD83D\uDC4B", "wave"],
  ["\uD83E\uDD1A", "raised_back_of_hand"],
  ["\uD83D\uDD90\uFE0F", "hand_splayed"],
  ["\u270B", "raised_hand"],
  ["\uD83D\uDD96", "vulcan_salute"],
  ["\uD83D\uDC4C", "ok_hand"],
  ["\uD83E\uDD0C", "pinched_fingers"],
  ["\uD83E\uDD0F", "pinching_hand"],
  ["\u270C\uFE0F", "v"],
  ["\uD83E\uDD1E", "crossed_fingers"],
  ["\uD83E\uDD1F", "love_you_gesture"],
  ["\uD83E\uDD18", "metal"],
  ["\uD83D\uDC4D", "thumbsup"],
  ["\uD83D\uDC4E", "thumbsdown"],
  ["\u270A", "fist"],
  ["\uD83D\uDC4A", "punch"],
  ["\uD83E\uDD1B", "left_facing_fist"],
  ["\uD83E\uDD1C", "right_facing_fist"],
  ["\uD83D\uDC4F", "clap"],
  ["\uD83D\uDE4C", "raised_hands"],
  ["\uD83D\uDC50", "open_hands"],
  ["\uD83E\uDD32", "palms_up_together"],
  ["\uD83E\uDD1D", "handshake"],
  ["\uD83D\uDE4F", "pray"],
  ["\u270D\uFE0F", "writing_hand"],
  ["\uD83D\uDC85", "nail_care"],
  ["\uD83D\uDCAA", "muscle"],
  ["\uD83D\uDC40", "eyes"],
  ["\uD83D\uDC45", "tongue"],
  ["\uD83D\uDC44", "lips"],
];

const animals: Pair[] = [
  ["\uD83D\uDC36", "dog"],
  ["\uD83D\uDC31", "cat"],
  ["\uD83D\uDC2D", "mouse"],
  ["\uD83D\uDC39", "hamster"],
  ["\uD83D\uDC30", "rabbit"],
  ["\uD83E\uDD8A", "fox_face"],
  ["\uD83D\uDC3B", "bear"],
  ["\uD83D\uDC3C", "panda_face"],
  ["\uD83D\uDC28", "koala"],
  ["\uD83D\uDC2F", "tiger"],
  ["\uD83E\uDD81", "lion"],
  ["\uD83D\uDC2E", "cow"],
  ["\uD83D\uDC37", "pig"],
  ["\uD83D\uDC38", "frog"],
  ["\uD83D\uDC35", "monkey_face"],
  ["\uD83D\uDC12", "monkey"],
  ["\uD83D\uDC14", "chicken"],
  ["\uD83D\uDC27", "penguin"],
  ["\uD83D\uDC26", "bird"],
  ["\uD83E\uDD85", "eagle"],
  ["\uD83E\uDD86", "duck"],
  ["\uD83E\uDD89", "owl"],
  ["\uD83D\uDC1D", "bee"],
  ["\uD83D\uDC1B", "bug"],
  ["\uD83E\uDD8B", "butterfly"],
  ["\uD83D\uDC0C", "snail"],
  ["\uD83D\uDC1A", "shell"],
  ["\uD83D\uDC22", "turtle"],
  ["\uD83D\uDC0D", "snake"],
  ["\uD83E\uDD8E", "lizard"],
  ["\uD83E\uDD82", "scorpion"],
  ["\uD83D\uDC19", "octopus"],
  ["\uD83E\uDD90", "shrimp"],
  ["\uD83D\uDC20", "tropical_fish"],
  ["\uD83D\uDC1F", "fish"],
  ["\uD83D\uDC2C", "dolphin"],
  ["\uD83D\uDC33", "whale"],
  ["\uD83E\uDD88", "shark"],
  ["\uD83D\uDC3A", "wolf"],
  ["\uD83E\uDD84", "unicorn"],
  ["\uD83C\uDF37", "tulip"],
  ["\uD83C\uDF39", "rose"],
  ["\uD83C\uDF3B", "sunflower"],
  ["\uD83C\uDF3C", "blossom"],
  ["\uD83C\uDF3A", "hibiscus"],
  ["\uD83C\uDF32", "evergreen_tree"],
  ["\uD83C\uDF33", "deciduous_tree"],
  ["\uD83C\uDF34", "palm_tree"],
  ["\uD83C\uDF35", "cactus"],
  ["\uD83C\uDF3F", "herb"],
  ["\u2618\uFE0F", "shamrock"],
  ["\uD83C\uDF40", "four_leaf_clover"],
  ["\uD83C\uDF41", "maple_leaf"],
  ["\uD83C\uDF42", "fallen_leaf"],
  ["\uD83C\uDF43", "leaves"],
];

const food: Pair[] = [
  ["\uD83C\uDF4E", "apple"],
  ["\uD83C\uDF4A", "tangerine"],
  ["\uD83C\uDF4B", "lemon"],
  ["\uD83C\uDF4C", "banana"],
  ["\uD83C\uDF49", "watermelon"],
  ["\uD83C\uDF47", "grapes"],
  ["\uD83C\uDF53", "strawberry"],
  ["\uD83C\uDF51", "peach"],
  ["\uD83C\uDF52", "cherries"],
  ["\uD83E\uDD5D", "kiwi_fruit"],
  ["\uD83C\uDF45", "tomato"],
  ["\uD83E\uDD51", "avocado"],
  ["\uD83C\uDF46", "eggplant"],
  ["\uD83E\uDD54", "potato"],
  ["\uD83E\uDD55", "carrot"],
  ["\uD83C\uDF3D", "corn"],
  ["\uD83C\uDF36\uFE0F", "hot_pepper"],
  ["\uD83E\uDD52", "cucumber"],
  ["\uD83C\uDF5E", "bread"],
  ["\uD83E\uDD50", "croissant"],
  ["\uD83E\uDD56", "baguette_bread"],
  ["\uD83E\uDDC0", "cheese"],
  ["\uD83C\uDF56", "meat_on_bone"],
  ["\uD83C\uDF57", "poultry_leg"],
  ["\uD83E\uDD69", "cut_of_meat"],
  ["\uD83C\uDF54", "hamburger"],
  ["\uD83C\uDF5F", "fries"],
  ["\uD83C\uDF55", "pizza"],
  ["\uD83C\uDF2D", "hotdog"],
  ["\uD83E\uDD6A", "sandwich"],
  ["\uD83C\uDF2E", "taco"],
  ["\uD83C\uDF2F", "burrito"],
  ["\uD83E\uDD5A", "egg"],
  ["\uD83C\uDF73", "cooking"],
  ["\uD83C\uDF5C", "ramen"],
  ["\uD83C\uDF72", "stew"],
  ["\uD83C\uDF63", "sushi"],
  ["\uD83C\uDF71", "bento"],
  ["\uD83C\uDF58", "rice_cracker"],
  ["\uD83C\uDF59", "rice_ball"],
  ["\uD83C\uDF5A", "rice"],
  ["\uD83C\uDF5B", "curry"],
  ["\uD83C\uDF69", "doughnut"],
  ["\uD83C\uDF66", "icecream"],
  ["\uD83C\uDF70", "cake"],
  ["\uD83C\uDF82", "birthday"],
  ["\uD83C\uDF6B", "chocolate_bar"],
  ["\uD83C\uDF6C", "candy"],
  ["\uD83C\uDF6D", "lollipop"],
  ["\uD83C\uDF6F", "honey_pot"],
  ["\u2615", "coffee"],
  ["\uD83C\uDF75", "tea"],
  ["\uD83C\uDF7A", "beer"],
  ["\uD83C\uDF7B", "beers"],
  ["\uD83E\uDD42", "clinking_glasses"],
  ["\uD83C\uDF77", "wine_glass"],
  ["\uD83E\uDD43", "tumbler_glass"],
  ["\uD83C\uDF78", "cocktail"],
  ["\uD83E\uDDC3", "beverage_box"],
];

const activities: Pair[] = [
  ["\u26BD", "soccer"],
  ["\uD83C\uDFC0", "basketball"],
  ["\uD83C\uDFC8", "football"],
  ["\u26BE", "baseball"],
  ["\uD83E\uDD4E", "softball"],
  ["\uD83C\uDFBE", "tennis"],
  ["\uD83C\uDFD0", "volleyball"],
  ["\uD83C\uDFC9", "rugby_football"],
  ["\uD83C\uDFB1", "8ball"],
  ["\uD83C\uDFD3", "ping_pong"],
  ["\uD83C\uDFB8", "guitar"],
  ["\uD83C\uDFB5", "musical_note"],
  ["\uD83C\uDFB6", "notes"],
  ["\uD83C\uDFA4", "microphone"],
  ["\uD83C\uDFAC", "clapper"],
  ["\uD83C\uDFAE", "video_game"],
  ["\uD83C\uDFB2", "game_die"],
  ["\uD83C\uDFAF", "dart"],
  ["\uD83C\uDFC6", "trophy"],
  ["\uD83E\uDD47", "first_place_medal"],
  ["\uD83E\uDD48", "second_place_medal"],
  ["\uD83E\uDD49", "third_place_medal"],
  ["\uD83C\uDFC5", "medal"],
  ["\uD83C\uDFA8", "art"],
  ["\uD83C\uDFAD", "performing_arts"],
  ["\uD83C\uDFA3", "fishing_pole_and_fish"],
  ["\uD83E\uDD3A", "fencing"],
  ["\uD83C\uDFC4", "surfer"],
  ["\uD83C\uDFCA", "swimmer"],
  ["\uD83D\uDEB4", "bicyclist"],
];

const travel: Pair[] = [
  ["\uD83D\uDE97", "car"],
  ["\uD83D\uDE95", "taxi"],
  ["\uD83D\uDE8C", "bus"],
  ["\uD83D\uDE8E", "trolleybus"],
  ["\uD83D\uDE93", "police_car"],
  ["\uD83D\uDE91", "ambulance"],
  ["\uD83D\uDE92", "fire_engine"],
  ["\u2708\uFE0F", "airplane"],
  ["\uD83D\uDE80", "rocket"],
  ["\uD83D\uDEF8", "flying_saucer"],
  ["\uD83D\uDE82", "steam_locomotive"],
  ["\uD83D\uDE86", "train2"],
  ["\uD83C\uDFE0", "house"],
  ["\uD83C\uDFD4\uFE0F", "national_park"],
  ["\uD83C\uDFD6\uFE0F", "beach"],
  ["\uD83C\uDF05", "sunrise"],
  ["\uD83C\uDF04", "sunrise_over_mountains"],
  ["\uD83C\uDF03", "night_with_stars"],
  ["\uD83C\uDF06", "city_sunset"],
  ["\uD83C\uDF07", "city_sunrise"],
  ["\uD83C\uDF09", "bridge_at_night"],
  ["\u2600\uFE0F", "sunny"],
  ["\u2601\uFE0F", "cloud"],
  ["\u26C8\uFE0F", "cloud_with_lightning_and_rain"],
  ["\uD83C\uDF24\uFE0F", "sun_behind_small_cloud"],
  ["\uD83C\uDF19", "crescent_moon"],
  ["\u2B50", "star"],
  ["\uD83C\uDF1F", "star2"],
  ["\uD83C\uDF20", "stars"],
  ["\uD83C\uDF0D", "earth_africa"],
  ["\uD83C\uDF0E", "earth_americas"],
  ["\uD83C\uDF0F", "earth_asia"],
  ["\u26A1", "zap"],
  ["\uD83D\uDD25", "fire"],
  ["\uD83C\uDF0A", "ocean"],
  ["\u2744\uFE0F", "snowflake"],
  ["\u2603\uFE0F", "snowman"],
  ["\uD83C\uDF08", "rainbow"],
];

const objects: Pair[] = [
  ["\uD83D\uDCF1", "iphone"],
  ["\uD83D\uDCBB", "computer"],
  ["\uD83D\uDCBE", "floppy_disk"],
  ["\uD83D\uDCBF", "cd"],
  ["\uD83D\uDCF7", "camera"],
  ["\uD83D\uDCFA", "tv"],
  ["\uD83D\uDCFB", "radio"],
  ["\u231A", "watch"],
  ["\uD83D\uDD26", "flashlight"],
  ["\uD83D\uDCA1", "bulb"],
  ["\uD83D\uDD0B", "battery"],
  ["\uD83D\uDD0C", "electric_plug"],
  ["\uD83D\uDCDA", "books"],
  ["\uD83D\uDCD6", "book"],
  ["\uD83D\uDD17", "link"],
  ["\uD83D\uDCCE", "paperclip"],
  ["\u2702\uFE0F", "scissors"],
  ["\uD83D\uDCDD", "memo"],
  ["\u270F\uFE0F", "pencil2"],
  ["\uD83D\uDD12", "lock"],
  ["\uD83D\uDD13", "unlock"],
  ["\uD83D\uDD11", "key"],
  ["\uD83D\uDD28", "hammer"],
  ["\uD83D\uDEE1\uFE0F", "shield"],
  ["\uD83D\uDD27", "wrench"],
  ["\u2699\uFE0F", "gear"],
  ["\uD83D\uDCE6", "package"],
  ["\uD83D\uDCEE", "postbox"],
  ["\uD83D\uDCE8", "incoming_envelope"],
  ["\uD83D\uDCE9", "envelope_with_arrow"],
  ["\uD83C\uDF81", "gift"],
  ["\uD83C\uDFB0", "slot_machine"],
  ["\uD83D\uDCB0", "moneybag"],
  ["\uD83D\uDCB3", "credit_card"],
  ["\uD83D\uDC8E", "gem"],
];

const symbols: Pair[] = [
  ["\u2764\uFE0F", "heart"],
  ["\uD83E\uDDE1", "orange_heart"],
  ["\uD83D\uDC9B", "yellow_heart"],
  ["\uD83D\uDC9A", "green_heart"],
  ["\uD83D\uDC99", "blue_heart"],
  ["\uD83D\uDC9C", "purple_heart"],
  ["\uD83D\uDDA4", "black_heart"],
  ["\uD83E\uDD0D", "white_heart"],
  ["\uD83D\uDC94", "broken_heart"],
  ["\u2763\uFE0F", "heart_exclamation"],
  ["\uD83D\uDC95", "two_hearts"],
  ["\uD83D\uDC96", "sparkling_heart"],
  ["\uD83D\uDC97", "heartpulse"],
  ["\uD83D\uDC98", "cupid"],
  ["\uD83D\uDC9D", "gift_heart"],
  ["\uD83D\uDC9E", "revolving_hearts"],
  ["\uD83D\uDC9F", "heart_decoration"],
  ["\u2622\uFE0F", "radioactive"],
  ["\u2623\uFE0F", "biohazard"],
  ["\u262E\uFE0F", "peace_symbol"],
  ["\u2716\uFE0F", "heavy_multiplication_x"],
  ["\u2714\uFE0F", "heavy_check_mark"],
  ["\u274C", "x"],
  ["\u274E", "negative_squared_cross_mark"],
  ["\u2753", "question"],
  ["\u2757", "exclamation"],
  ["\u203C\uFE0F", "bangbang"],
  ["\u2049\uFE0F", "interrobang"],
  ["\uD83D\uDCAF", "100"],
  ["\uD83D\uDD1E", "underage"],
  ["\u267B\uFE0F", "recycle"],
  ["\u269B\uFE0F", "atom_symbol"],
  ["\uD83D\uDD34", "red_circle"],
  ["\uD83D\uDD35", "blue_circle"],
  ["\uD83D\uDFE2", "green_circle"],
  ["\uD83D\uDFE1", "yellow_circle"],
  ["\uD83D\uDFE0", "orange_circle"],
  ["\uD83D\uDFE3", "purple_circle"],
  ["\u26AA", "white_circle"],
  ["\u26AB", "black_circle"],
  ["\u2B06\uFE0F", "arrow_up"],
  ["\u2B07\uFE0F", "arrow_down"],
  ["\u27A1\uFE0F", "arrow_right"],
  ["\u2B05\uFE0F", "arrow_left"],
  ["\uD83D\uDD04", "arrows_counterclockwise"],
  ["\u2795", "heavy_plus_sign"],
  ["\u2796", "heavy_minus_sign"],
  ["\u00A9\uFE0F", "copyright"],
  ["\u00AE\uFE0F", "registered"],
  ["\u2122\uFE0F", "tm"],
];

const flags: Pair[] = [
  ["\uD83C\uDFF3\uFE0F", "white_flag"],
  ["\uD83C\uDFF4", "black_flag"],
  ["\uD83C\uDFC1", "checkered_flag"],
  ["\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08", "rainbow_flag"],
  ["\uD83C\uDDFA\uD83C\uDDF8", "us"],
  ["\uD83C\uDDEC\uD83C\uDDE7", "gb"],
  ["\uD83C\uDDE9\uD83C\uDDEA", "de"],
  ["\uD83C\uDDEB\uD83C\uDDF7", "fr"],
  ["\uD83C\uDDEA\uD83C\uDDF8", "es"],
  ["\uD83C\uDDEE\uD83C\uDDF9", "it"],
  ["\uD83C\uDDF7\uD83C\uDDFA", "ru"],
  ["\uD83C\uDDE8\uD83C\uDDF3", "cn"],
  ["\uD83C\uDDEF\uD83C\uDDF5", "jp"],
  ["\uD83C\uDDF0\uD83C\uDDF7", "kr"],
  ["\uD83C\uDDE7\uD83C\uDDF7", "brazil"],
  ["\uD83C\uDDE6\uD83C\uDDFA", "australia"],
  ["\uD83C\uDDE8\uD83C\uDDE6", "canada"],
  ["\uD83C\uDDEE\uD83C\uDDF3", "india"],
  ["\uD83C\uDDF2\uD83C\uDDFD", "mexico"],
];

const categoryMap: Record<string, Pair[]> = {
  smileys,
  animals,
  food,
  activities,
  travel,
  objects,
  symbols,
  flags,
};

function toPairs(pairs: Pair[], category: string): EmojiEntry[] {
  return pairs.map(([emoji, shortcode]) => ({ emoji, shortcode, category }));
}

let _allEmojis: EmojiEntry[] | null = null;

export function getAllEmojis(): EmojiEntry[] {
  if (_allEmojis) return _allEmojis;
  _allEmojis = [];
  for (const [catId, pairs] of Object.entries(categoryMap)) {
    _allEmojis.push(...toPairs(pairs, catId));
  }
  return _allEmojis;
}

export function getEmojisByCategory(categoryId: string): EmojiEntry[] {
  const pairs = categoryMap[categoryId];
  if (!pairs) return [];
  return toPairs(pairs, categoryId);
}

// ── Shortcode lookup (for autocomplete) ──

let _shortcodeIndex: Map<string, EmojiEntry> | null = null;

function getShortcodeIndex(): Map<string, EmojiEntry> {
  if (_shortcodeIndex) return _shortcodeIndex;
  _shortcodeIndex = new Map();
  for (const entry of getAllEmojis()) {
    _shortcodeIndex.set(entry.shortcode, entry);
  }
  return _shortcodeIndex;
}

export function resolveShortcode(shortcode: string): EmojiEntry | undefined {
  return getShortcodeIndex().get(shortcode);
}

export function searchEmojis(query: string, limit = 50): EmojiEntry[] {
  const q = query.toLowerCase();
  const all = getAllEmojis();
  const results: EmojiEntry[] = [];
  // Exact prefix matches first
  for (const entry of all) {
    if (entry.shortcode.startsWith(q)) results.push(entry);
    if (results.length >= limit) return results;
  }
  // Then substring matches
  for (const entry of all) {
    if (!entry.shortcode.startsWith(q) && entry.shortcode.includes(q)) {
      results.push(entry);
    }
    if (results.length >= limit) return results;
  }
  return results;
}

// ── Frequently Used (persisted in localStorage) ──

const FREQUENT_KEY = "bergamot_frequent_emojis";
const MAX_FREQUENT = 32;

export function getFrequentEmojis(): EmojiEntry[] {
  try {
    const stored = localStorage.getItem(FREQUENT_KEY);
    if (!stored) return [];
    const shortcodes: string[] = JSON.parse(stored);
    const index = getShortcodeIndex();
    return shortcodes
      .map((sc) => index.get(sc))
      .filter((e): e is EmojiEntry => e !== undefined);
  } catch {
    return [];
  }
}

export function recordEmojiUsage(shortcode: string): void {
  try {
    const stored = localStorage.getItem(FREQUENT_KEY);
    let shortcodes: string[] = stored ? JSON.parse(stored) : [];
    shortcodes = shortcodes.filter((sc) => sc !== shortcode);
    shortcodes.unshift(shortcode);
    if (shortcodes.length > MAX_FREQUENT) shortcodes.length = MAX_FREQUENT;
    localStorage.setItem(FREQUENT_KEY, JSON.stringify(shortcodes));
  } catch {
    // Ignore storage errors
  }
}
