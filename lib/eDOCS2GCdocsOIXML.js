/*jslint node: true */

'use strict';

/*	
	This script runs with nodejs, and load a text file (formatted as a JSON file) which
	contains a list of document metadatas from RDIMS, parse it and adds more content such
	as existing GCdocs users, real file names for the new files to be
	either created as new documents or adding a new version of the document in GCdocs,
	and create an object importer XML file using proper nodes to be processed by 
	the GCdocs object importer module.
*/

/*
	Author: Alexandre PIERRE (consultant@pierrekiroule.com) - Pierrekiroule Consulting Inc.
	Date of creation : July 2018
	Last revision: November 30th, 2018
*/

/* 
Description of the program:
open the source files, created from SQL query exports and already formated as JSON data:
- EKME_XXXX-XX-XX_extract_XXXX.json contains all EKME metadata extracted from the database for all documents and their versions we need to import.
The file name contains the cut off date (last edit version) of the batch, and the batch number (in case multiple batch needs to run for this date)
	structure:
	{"destinationFolder":"Enterprise:::",  ==> GCdocs destination folder - must be a valid path / folder
	"extension":"DOCX", ==> for the file name (probably not used except for the node type if applicable (URL, Alias, Folder?))
	"title":"Recommendation for Minister: West Coast Reduction Ltd", ==> Document title. Concatenate with Document Number.
	"doctype":"DOCS", ==> add case if we have a folder? in any cases, add this to a "EKME Document Type" attribute
	"description":"",  ==> descrition. If empty, add "imported from EKME".
	"modifiedby":"MADOREM", ==> "EKME Modified by" attribute
	"docnumber":"3900312", ==> "EKME Document Number" attribute
	"author":"MADOREM", ==> Created by
	"created":"20180411", ==> Created date
	"modified":"20180411", ==> modified date
	"version":"1"}, ==> used to create or add versions.
- ListOfAllUsersAndGroups.json contains the list of all existing users and groups in GCdocs, in order to check if EKME users exists in GCdocs.
- ListOfHighACLGroupsEKME.json contains all groups with full access to the document for each documents in EKME.
Notes:
- when formating of the JSON file, be carefull with the existing double quote and escape them like this: \" (should be managed in the SQL query).
- the entire set of data should be wrapped around [] to make an array
Todo:
+ must cleanup GCdocs destination folder if necessary. the GCdocsdestination must exist
  (unless folder creation is turned on in the OI options) and can't contain multiple ":"
- must find best strategy for destination folders: file plan, OPI, groups, etc...
+ create lookup for users to check if they exist in GCdocs, and if not assign default user which exist.
+ assign ACL tags to groups with elevated privileges
- check if groups for ACL exist in GCdocs.
+ check if advanced versions are used in EKME (they are) and how to apply them to GCdocs if necessary
- create report of all migrated documents (with doc numbers and new open link?)
+ run query to update email subtypes after import...
*/

// pre-requisites:
// run all SQL queries to get the source files:
//   - filesListJSON: contains a list of all RDIMS files with path.
//   - ListOfAllUsersAndGroups: contains the list of all GCdocs users and groups (query on GCDOCS)
//   - EKME_XXX-XX-XX_extract_XXX.json: contains the list of all documents and versions we need to import

// main loop through all the documents lines, creating each lines of the XML object importer file
/* to do:
- location mapping: when file plan exist, need mapping to proper folder in GCdocs. When OPI exist, need mapping to their legacy bucket. When nothing exists, map to generic legacy bucket.
+ file name: need to lookup the existence of the file (need a list of all files, strip their extension and compare list with current potential value).
+ Extensions: need to store the list of files with their extension to append the proper extension.
+ ACL
+ min version function
+ do not write into xml when file not found, but into separate log instead
- French language?
- additional information in the EKME category?
- more testing and performance improvements:
---> July 26, 2018: changed searches in user & group list, as well as in file list,
	 and for the 2100 documents samples went from 197 second to 1 second process.
*/

// start timestamp used to calculate the time spent processing.
// initialize variables to count processed files
const timestart = Date.now();
var totalfileNotFound = 0;
var totalfilesProcessed = 0;

// iteration number:
// Used to load and write files with new names: change this when the source name change
const iterationRun = '001';
const cuttOffDate = '2002-11-30';

// Constants declarations:
const langCodeEn = "en_CA";
const langCodeFr = "fr_CA";

// Include xml and file system libraries to build the xml import files:
var builder = require('xmlbuilder');
var fs = require('graceful-fs'); 

// use the document number <-> file name conversion library and document lists
var edocs = require('./edocsconvert.js').edocs;

// loading the main JSON list of documents to import (result of RDIMS SQL extraction):
var JSONSourceFileName = "./../source/EKME_" + cuttOffDate + "_extract_" + iterationRun + ".json";
var documentsJSON = require(JSONSourceFileName);

// loading the JSON list of EKME files and extensions (created with filestoreCode.js):
var filesListJSON = require('./../source/filesListAll.json');
// sorting list of files on name, in order to improve performances with binary search:
// using lower cases to compare as some file names have either upper or lower cases but
// calculated file names are always lower case.
filesListJSON.sort(function(a,b) {
	if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
    if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
    return 0;
});
const FListLen = filesListJSON.length;

// loading the JSON list of GCdocs users and groups (from GCdocs sql + report):
var GCdocsUGJSON = require('./../source/allGcdocsUsers.json');
// sorting list of users on name, in order to improve performances with binary search:
// using lower case to compare as some names can use upper or lower cases
GCdocsUGJSON.sort(function(a, b) { // Case-insensitive sort
    if(a.username.toLowerCase() < b.username.toLowerCase()) return -1;
    if(a.username.toLowerCase() > b.username.toLowerCase()) return 1;
    return 0;
});
const UGlen = GCdocsUGJSON.length;

// console.log('Length of user and group file: ' + UGlen);

// Special list of document numbers that do not need to be imported 
// (i.e. they have already been imported)
var doNotimportList = []; //[209, 211, 217, 218, 219, 220, 221, 222, 223, 260, 262, 264, 266, 268, 271, 275, 278, 282, 284, 286, 296, 298, 300, 302, 304, 2080, 2081, 2082, 2083, 2084, 2085, 2086, 2087, 2088, 2089, 2090, 2091, 2092, 2093, 2094, 2095, 2096, 2097, 2098, 2099, 2100, 2101, 2102, 2103, 2104, 2105, 2106, 2107, 2108, 2109, 2110, 2111, 2112, 2113, 2114, 2115, 2116, 2117, 2118, 2119, 2120, 2121, 2122, 2123, 2125, 2126, 2127, 2129, 2130, 2131, 2132, 2133, 2134, 2135, 2136, 2137, 2138, 2139, 2140, 2141, 2142, 2143, 2144, 2145, 2146, 2147, 2148, 2149, 2150, 2151, 2152, 2153, 2154, 2155, 2156, 2157, 2158, 2159, 2160, 2161, 2162, 2164, 2165, 2166, 2167, 2168, 2169, 2170, 2172, 2173, 2174, 2175, 2176, 2177, 2178, 2179, 2180, 2181, 2182, 2183, 2184, 2185, 2186, 2187, 2188, 2189, 2190, 2191, 2192, 2193, 2194, 2197, 2198, 2199, 2200, 2201, 2202, 2203, 2204, 2205, 2206, 2207, 2208, 2209, 2210, 2211, 2212, 2213, 2214, 2215, 2216, 2217, 2218, 2219, 2221, 2222, 2223, 2225, 2226, 2227, 2228, 2229, 2230, 2231, 2232, 2233, 2234, 2235, 2236, 2237, 2238, 2240, 2241, 2242, 2243, 2244, 2245, 2246, 2247, 2248, 2249, 2250, 2251, 2252, 2253, 2254, 2255, 2256, 2257, 2258, 2259, 2260, 2261, 2262, 2263, 2264, 2265, 2266, 2267, 2268, 2269, 2270, 2271, 2272, 2273, 2274, 2275, 2276, 2277, 2278, 2279, 2280, 2281, 2282, 2283, 2285, 2288, 2289, 2290, 2291, 2292, 2293, 2295, 2296, 2297, 2298, 2299, 2300, 2301, 2302, 2303, 2304, 2305, 2306, 2307, 2308, 2309, 2310, 2311, 2312, 2313, 2314, 2315, 2316, 2318, 2319, 2320, 2321, 2322, 2325, 2326, 2327, 2328, 2329, 2330, 2331, 2332, 2333, 2334, 2335, 2336, 2337, 2338, 2339, 2340, 2341, 2342, 2343, 2344, 2345, 2346, 2347, 2348, 2349, 2350, 2351, 2352, 2353, 2354, 2355, 2356, 2357, 2358, 2359, 2360, 2362, 2363, 2366, 2367, 2368, 2370, 2371, 2372, 2373, 2374, 2375, 2376, 2377, 2378, 2379, 2380, 2381, 2382, 2383, 2384, 2385, 2386, 2387, 2388, 2389, 2390, 2391, 2392, 2393, 2394, 2395, 2396, 2397, 2398, 2399, 2400, 2401, 2402, 2403, 2404, 2405, 2406, 2407, 2408, 2409, 2410, 2412, 2413, 2414, 2415, 2416, 2417, 2419, 2420, 2422, 2423, 2425, 2426, 2427, 2428, 2429, 2430, 2431, 2432, 2433, 2434, 2435, 2436, 2437, 2438, 2439, 2440, 2441, 2442, 2443, 2444, 2445, 2446, 2447, 2448, 2449, 2450, 2451, 2452, 2453, 2454, 2455, 2456, 2457, 2458, 2459, 2460, 2461, 2462, 2463, 2464, 2465, 2466, 2467, 2468, 2469, 2470, 2471, 2472, 2473, 2474, 2475, 2476, 2477, 2478, 2479, 2480, 2481, 2482, 2483, 2484, 2485, 2486, 2487, 2488, 2489, 2490, 2491, 2492, 2493, 2494, 2495, 2496, 2497, 2498, 2499, 2500, 2501, 2502, 2503, 2504, 2505, 2506, 2507, 2508, 2509, 2510, 2511, 2512, 2513, 2514, 2515, 2516, 2517, 2518, 2519, 2520, 2521, 2523, 2524, 2525, 2526, 2527, 2528, 2529, 2531, 2532, 2533, 2534, 2535, 2536, 2537, 2538, 2539, 2540, 2541, 2542, 2543, 2544, 2545, 2546, 2547, 2550, 2552, 2553, 2554, 2555, 2556, 2557, 2558, 2559, 2560, 2561, 2562, 2563, 2564, 2565, 2566, 2567, 2568, 2569, 2570, 2571, 2572, 2573, 2574, 2575, 2576, 2577, 2578, 2579, 2580, 2581, 2582, 2583, 2584, 2585, 2586, 2588, 2589, 2590, 2591, 2592, 2593, 2594, 2595, 2596, 2597, 2598, 2599, 2600, 2601, 2602, 2603, 2604, 2605, 2606, 2607, 2608, 2610, 2611, 2612, 2613, 2614, 2615, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634, 2635, 2636, 2637, 2638, 2639, 2640, 2641, 2642, 2643, 2644, 2645, 2646, 2647, 2648, 2649, 2650, 2651, 2652, 2653, 2654, 2655, 2656, 2657, 2658, 2659, 2660, 2661, 2662, 2663, 2664, 2665, 2666, 2667, 2668, 2669, 2670, 2671, 2672, 2673, 2674, 2675, 2676, 2677, 2678, 2679, 2680, 2681, 2682, 2683, 2684, 2685, 2686, 2687, 2688, 2689, 2690, 2691, 2692, 2693, 2694, 2695, 2696, 2697, 2698, 2699, 2700, 2701, 2702, 2703, 2704, 2705, 2706, 2707, 2708, 2709, 2710, 2711, 2712, 2713, 2714, 2715, 2716, 2717, 2718, 2719, 2720, 2721, 2722, 2723, 2724, 2725, 2726, 2727, 2728, 2729, 2730, 2731, 2732, 2733, 2734, 2735, 2736, 2737, 2738, 2739, 2740, 2741, 2742, 2743, 2744, 2745, 2746, 2747, 2748, 2749, 2750, 2751, 2752, 2753, 2754, 2755, 2756, 2757, 2758, 2759, 2760, 2761, 2763, 2764, 2765, 2766, 2767, 2768, 2769, 2770, 2771, 2772, 2773, 2774, 2775, 2776, 2777, 2778, 2779, 2780, 2781, 2782, 2783, 2784, 2785, 2786, 2787, 2788, 2789, 2790, 2791, 2792, 2793, 2794, 2795, 2796, 2797, 2798, 2799, 2800, 2801, 2802, 2803, 2804, 2805, 2806, 2807, 2808, 2809, 2810, 2811, 2812, 2813, 2814, 2815, 2816, 2817, 2818, 2819, 2820, 2821, 2822, 2823, 2824, 2825, 2826, 2827, 2828, 2829, 2830, 2831, 2832, 2833, 2834, 2835, 2836, 2837, 2838, 2839, 2840, 2841, 2842, 2843, 2844, 2845, 2846, 2847, 2848, 2849, 2850, 2851, 2852, 2853, 2854, 2855, 2856, 2857, 2858, 2859, 2860, 2861, 2862, 2863, 2864, 2865, 2866, 2867, 2868, 2869, 2870, 2871, 2872, 2873, 2874, 2875, 2876, 2877, 2878, 2879, 2880, 2881, 2882, 2883, 2884, 2885, 2886, 2887, 2888, 2889, 2890, 2891, 2892, 2893, 2894, 2895, 2896, 2897, 2898, 2899, 2900, 2901, 2903, 2904, 2905, 2906, 2907, 2908, 2909, 2910, 2911, 2912, 2913, 2914, 2915, 2916, 2917, 2918, 2919, 2920, 2921, 2922, 2923, 2924, 2925, 2926, 2927, 2928, 2929, 2930, 2931, 2932, 2933, 2934, 2935, 2936, 2937, 2938, 2939, 2940, 2941, 2942, 2943, 2944, 2945, 2946, 2947, 2948, 2949, 2950, 2951, 2952, 2953, 2954, 2955, 2956, 2957, 2958, 2959, 2960, 2961, 2962, 2963, 2964, 2965, 2966, 2967, 2968, 2969, 2970, 2971, 2973, 2974, 2975, 2976, 2977, 2978, 2979, 2980, 2981, 2982, 2983, 2984, 2985, 2986, 2987, 2988, 2989, 2990, 2991, 2992, 2993, 2994, 2995, 2996, 2997, 2998, 2999, 3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3015, 3016, 3017, 3018, 3019, 3020, 3021, 3022, 3023, 3024, 3025, 3026, 3027, 3028, 3029, 3030, 3031, 3032, 3033, 3034, 3035, 3036, 3037, 3038, 3039, 3040, 3041, 3042, 3043, 3044, 3045, 3046, 3047, 3048, 3049, 3050, 3051, 3052, 3053, 3054, 3055, 3056, 3057, 3058, 3059, 3060, 3061, 3062, 3063, 3064, 3065, 3066, 3067, 3068, 3069, 3070, 3071, 3072, 3073, 3074, 3075, 3076, 3077, 3078, 3079, 3080, 3081, 3082, 3083, 3084, 3085, 3086, 3087, 3088, 3089, 3090, 3091, 3092, 3093, 3094, 3096, 3097, 3098, 3099, 3100, 3101, 3102, 3103, 3104, 3105, 3106, 3107, 3108, 3109, 3110, 3111, 3112, 3113, 3114, 3115, 3116, 3117, 3118, 3119, 3120, 3121, 3122, 3123, 3124, 3125, 3126, 3127, 3128, 3129, 3130, 3131, 3132, 3133, 3134, 3135, 3136, 3137, 3138, 3139, 3140, 3141, 3142, 3143, 3144, 3145, 3146, 3147, 3148, 3149, 3150, 3151, 3152, 3153, 3154, 3155, 3156, 3157, 3158, 3159, 3160, 3161, 3162, 3163, 3164, 3165, 3166, 3167, 3168, 3169, 3170, 3171, 3172, 3173, 3174, 3175, 3176, 3177, 3178, 3179, 3180, 3181, 3182, 3183, 3184, 3185, 3186, 3187, 3188, 3189, 3190, 3191, 3192, 3193, 3194, 3195, 3196, 3197, 3198, 3199, 3200, 3201, 3202, 3203, 3204, 3205, 3206, 3207, 3208, 3209, 3210, 3211, 3212, 3213, 3214, 3215, 3216, 3217, 3218, 3219, 3220, 3221, 3222, 3223, 3224, 3225, 3226, 3227, 3228, 3229, 3230, 3231, 3232, 3233, 3234, 3235, 3236, 3237, 3238, 3239, 3240, 3241, 3242, 3243, 3244, 3245, 3246, 3247, 3248, 3249, 3250, 3251, 3252, 3253, 3254, 3255, 3256, 3257, 3258, 3259, 3260, 3261, 3262, 3263, 3264, 3265, 3266, 3267, 3268, 3269, 3270, 3271, 3272, 3273, 3274, 3275, 3276, 3277, 3278, 3279, 3280, 3281, 3282, 3283, 3284, 3285, 3286, 3287, 3288, 3289, 3290, 3291, 3292, 3293, 3294, 3295, 3296, 3297, 3298, 3299, 3300, 3301, 3302, 3303, 3304, 3305, 3306, 3307, 3308, 3309, 3310, 3311, 3312, 3313, 3314, 3316, 3317, 3318, 3319, 3320, 3321, 3323, 3324, 3325, 3326, 3327, 3328, 3329, 3330, 3331, 3332, 3333, 3334, 3335, 3336, 3337, 3338, 3340, 3341, 3342, 3343, 3344, 3345, 3346, 3347, 3348, 3349, 3350, 3351, 3352, 3353, 3354, 3355, 3356, 3357, 3358, 3359, 3360, 3361, 3362, 3363, 3364, 3365, 3366, 3367, 3368, 3369, 3370, 3371, 3372, 3373, 3374, 3375, 3376, 3377, 3378, 3379, 3380, 3381, 3382, 3383, 3384, 3385, 3386, 3387, 3388, 3389, 3390, 3391, 3392, 3393, 3394, 3395, 3396, 3397, 3398, 3399, 3400, 3401, 3402, 3403, 3404, 3405, 3406, 3407, 3408, 3409, 3410, 3411, 3412, 3413, 3414, 3415, 3416, 3417, 3418, 3419, 3420, 3421, 3422, 3423, 3424, 3425, 3426, 3427, 3428, 3429, 3430, 3431, 3432, 3433, 3434, 3435, 3436, 3437, 3438, 3439, 3440, 3441, 3442, 3443, 3444, 3445, 3446, 3447, 3448, 3449, 3450, 3451, 3452, 3453, 3454, 3455, 3456, 3457, 3458, 3459, 3460, 3461, 3462, 3463, 3464, 3466, 3467, 3468, 3469, 3470, 3471, 3472, 3473, 3474, 3475, 3476, 3477, 3478, 3479, 3480, 3481, 3482, 3483, 3484, 3485, 3486, 3487, 3488, 3489, 3490, 3491, 3492, 3493, 3494, 3495, 3496, 3497, 3498, 3499, 3500, 3501, 3502, 3503, 3504, 3505, 3506, 3507, 3508, 3509, 3510, 3511, 3512, 3513, 3514, 3515, 3516, 3517, 3518, 3519, 3520, 3521, 3522, 3523, 3524, 3525, 3526, 3527, 3528, 3529, 3530, 3531, 3532, 3533, 3534, 3535, 3536, 3537, 3538, 3539, 3540, 3541, 3542, 3543, 3544, 3545, 3546, 3547, 3548, 3549, 3550, 3551, 3552, 3553, 3554, 3555, 3556, 3557, 3558, 3559, 3560, 3561, 3562, 3563, 3564, 3565, 3566, 3567, 3568, 3569, 3570, 3571, 3572, 3573, 3574, 3575, 3576, 3577, 3578, 3579, 3580, 3581, 3582, 3583, 3584, 3585, 3586, 3587, 3588, 3589, 3590, 3591, 3592, 3593, 3594, 3595, 3596, 3597, 3598, 3599, 3600, 3601, 3602, 3603, 3604, 3605, 3606, 3607, 3608, 3609, 3610, 3611, 3612, 3613, 3614, 3615, 3616, 3617, 3618, 3619, 3620, 3621, 3622, 3623, 3624, 3625, 3626, 3627, 3628, 3629, 3630, 3631, 3632, 3633, 3634, 3635, 3636, 3637, 3638, 3639, 3640, 3641, 3642, 3643, 3644, 3645, 3646, 3647, 3648, 3649, 3650, 3651, 3652, 3653, 3654, 3655, 3656, 3657, 3658, 3659, 3660, 3661, 3662, 3663, 3664, 3665, 3666, 3667, 3668, 3669, 3670, 3671, 3672, 3673, 3674, 3675, 3676, 3677, 3678, 3679, 3680, 3681, 3682, 3683, 3684, 3685, 3686, 3687, 3688, 3689, 3690, 3691, 3692, 3693, 3694, 3695, 3696, 3697, 3698, 3699, 3700, 3701, 3702, 3703, 3705, 3706, 3707, 3708, 3709, 3710, 3711, 3712, 3713, 3714, 3715, 3716, 3717, 3718, 3719, 3720, 3721, 3722, 3723, 3724, 3725, 3726, 3727, 3728, 3729, 3730, 3731, 3732, 3733, 3734, 3735, 3736, 3737, 3738, 3739, 3740, 3741, 3742, 3743, 3744, 3745, 3746, 3747, 3748, 3749, 3750, 3751, 3752, 3753, 3754, 3755, 3756, 3757, 3758, 3759, 3760, 3761, 3762, 3764, 3765, 3766, 3767, 3768, 3769, 3770, 3771, 3772, 3773, 3774, 3775, 3776, 3777, 3778, 3779, 3780, 3781, 3782, 3783, 3784, 3785, 3786, 3787, 3788, 3789, 3790, 3791, 3792, 3793, 3794, 3795, 3796, 3797, 3798, 3799, 3800, 3801, 3802, 3803, 3804, 3805, 3806, 3807, 3808, 3809, 3810, 3811, 3812, 3813, 3814, 3815, 3816, 3817, 3818, 3819, 3820, 3821, 3822, 3823, 3824, 3825, 3826, 3827, 3828, 3829, 3830, 3831, 3832, 3833, 3834, 3835, 3836, 3837, 3838, 3839, 3840, 3841, 3842, 3843, 3844, 3845, 3846, 3848, 3849, 3850, 3851, 3852, 3853, 3854, 3855, 3856, 3857, 3858, 3859, 3860, 3861, 3862, 3863, 3864, 3865, 3866, 3867, 3868, 3869, 3870, 3871, 3872, 3873, 3874, 3875, 3876, 3877, 3878, 3879, 3880, 3881, 3882, 3883, 3884, 3885, 3886, 3887, 3888, 3889, 3890, 3891, 3892, 3893, 3894, 3895, 3896, 3897, 3898, 3899, 3900, 3901, 3902, 3903, 3904, 3905, 3906, 3907, 3908, 3909, 3910, 3911, 3912, 3913, 3914, 3915, 3916, 3917, 3918, 3919, 3920, 3921, 3922, 3923, 3924, 3925, 3926, 3927, 3928, 3929, 3930, 3931, 3932, 3934, 3935, 3936, 3937, 3938, 3939, 3940, 3941, 3942, 3943, 3944, 3945, 3946, 3947, 3948, 3949, 3950, 3951, 3952, 3953, 3954, 3955, 3956, 3957, 3958, 3959, 3960, 3961, 3962, 3963, 3964, 3965, 3966, 3967, 3968, 3969, 3970, 3971, 3972, 3973, 3974, 3975, 3976, 3977, 3978, 3979, 3980, 3981, 3982, 3983, 3984, 3985, 3986, 3987, 3988, 3989, 3990, 3991, 3992, 3993, 3994, 3995, 3996, 3997, 3998, 3999, 4000, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4010, 4011, 4012, 4013, 4014, 4015, 4016, 4017, 4018, 4019, 4020, 4021, 4022, 4023, 4024, 4025, 4026, 4027, 4028, 4029, 4030, 4031, 4032, 4033, 4034, 4036, 4037, 4038, 4039, 4040, 4041, 4042, 4043, 4044, 4045, 4046, 4047, 4048, 4049, 4050, 4051, 4052, 4053, 4054, 4055, 4056, 4057, 4058, 4059, 4060, 4061, 4062, 4063, 4064, 4065, 4066, 4067, 4068, 4069, 4070, 4071, 4072, 4073, 4074, 4075, 4076, 4077, 4078, 4079, 4080, 4081, 4082, 4083, 4084, 4085, 4086, 4087, 4088, 4089, 4090, 4091, 4092, 4093, 4094, 4095, 4096, 4097, 4098, 4099, 4100, 4101, 4102, 4103, 4104, 4105, 4106, 4107, 4108, 4109, 4110, 4111, 4112, 4113, 4114, 4115, 4116, 4117, 4118, 4119, 4120, 4121, 4122, 4123, 4124, 4125, 4126, 4127, 4128, 4129, 4130, 4131, 4132, 4133, 4134, 4135, 4136, 4137, 4138, 4139, 4140, 4141, 4142, 4143, 4144, 4145, 4146, 4147, 4148, 4149, 4150, 4151, 4152, 4153, 4154, 4155, 4156, 4157, 4158, 4159, 4160, 4161, 4162, 4163, 4164, 4165, 4166, 4167, 4168, 4169, 4170, 4171, 4172, 4173, 4174, 4175, 4176, 4177, 4178, 4179, 4180, 4181, 4182, 4183, 4184, 4185, 4186, 4187, 4188, 4189, 4190, 4191, 4192, 4193, 4194, 4195, 4196, 4197, 4198, 4199, 4200, 4201, 4202, 4203, 4204, 4205, 4206, 4207, 4208, 4209, 4210, 4211, 4212, 4213, 4214, 4215, 4216, 4217, 4218, 4219, 4221, 4222, 4223, 4224, 4225, 4226, 4227, 4228, 4229, 4230, 4231, 4232, 4233, 4234, 4235, 4236, 4237, 4238, 4239, 4240, 4241, 4242, 4243, 4244, 4245, 4246, 4247, 4248, 4249, 4250, 4251, 4252, 4253, 4254, 4255, 4256, 4257, 4258, 4259, 4260, 4261, 4262, 4263, 4264, 4265, 4266, 4267, 4268, 4269, 4270, 4271, 4272, 4273, 4274, 4275, 4276, 4277, 4278, 4279, 4280, 4281, 4282, 4283, 4284, 4285, 4286, 4287, 4288, 4289, 4290, 4291, 4292, 4293, 4294, 4295, 4296, 4297, 4298, 4299, 4300, 4301, 4302, 4303, 4304, 4305, 4306, 4307, 4308, 4309, 4310, 4311, 4312, 4313, 4314, 4315, 4316, 4317, 4318, 4319, 4320, 4321, 4322, 4323, 4324, 4325, 4326, 4327, 4328, 4329, 4330, 4331, 4332, 4333, 4334, 4335, 4336, 4337, 4338, 4339, 4340, 4341, 4342, 4343, 4344, 4345, 4346, 4347, 4348, 4349, 4350, 4351, 4352, 4353, 4354, 4355, 4356, 4357, 4358, 4359, 4360, 4361, 4362, 4363, 4364, 4365, 4366, 4367, 4368, 4369, 4370, 4371, 4372, 4373, 4374, 4375, 4376, 4377, 4378, 4379, 4380, 4381, 4382, 4383, 4384, 4385, 4386, 4387, 4388, 4389, 4390, 4391, 4392, 4393, 4394, 4395, 4396, 4397, 4398, 4399, 4401, 4402, 4403, 4404, 4406, 4407, 4408, 4409, 4410, 4411, 4412, 4413, 4414, 4415, 4416, 4417, 4418, 4419, 4420, 4421, 4422, 4424, 4425, 4426, 4427, 4428, 4429, 4430, 4431, 4432, 4433, 4434, 4435, 4436, 4437, 4438, 4439, 4440, 4441, 4442, 4443, 4444, 4445, 4446, 4447, 4448, 4449, 4450, 4451, 4452, 4453, 4454, 4455, 4456, 4457, 4458, 4459, 4460, 4461, 4462, 4463, 4464, 4465, 4466, 4467, 4468, 4469, 4470, 4471, 4472, 4473, 4474, 4475, 4476, 4477, 4478, 4479, 4480, 4481, 4482, 4483, 4484, 4485, 4486, 4487, 4488, 4489, 4490, 4491, 4492, 4493, 4494, 4495, 4496, 4497, 4498, 4499, 4500, 4501, 4502, 4503, 4504, 4505, 4506, 4507, 4508, 4509, 4510, 4511, 4512, 4513, 4514, 4515, 4516, 4517, 4518, 4519, 4520, 4521, 4522, 4523, 4524, 4525, 4526, 4527, 4530, 4531, 4532, 4533, 4534, 4535, 4536, 4537, 4538, 4539, 4540, 4541, 4542, 4543, 4544, 4545, 4546, 4547, 4548, 4549, 4550, 4551, 4552, 4553, 4554, 4555, 4556, 4557, 4558, 4559, 4560, 4561, 4562, 4563, 4564, 4565, 4566, 4567, 4568, 4569, 4570, 4571, 4572, 4573, 4574, 4575, 4576, 4577, 4578, 4579, 4580, 4581, 4582, 4583, 4584, 4585, 4586, 4587, 4588, 4589, 4590, 4592, 4593, 4594, 4596, 4597, 4598, 4599, 4600, 4601, 4602, 4603, 4604, 4605, 4606, 4607, 4608, 4609, 4610, 4611, 4612, 4613, 4614, 4615, 4616, 4617, 4618, 4619, 4620, 4621, 4622, 4623, 4624, 4625, 4626, 4628, 4629, 4630, 4631, 4632, 4633, 4634, 4635, 4636, 4637, 4638, 4639, 4640, 4641, 4642, 4643, 4644, 4645, 4646, 4647, 4648, 4649, 4650, 4652, 4653, 4654, 4655, 4656, 4657, 4658, 4659, 4660, 4661, 4662, 4663, 4664, 4665, 4666, 4667, 4668, 4669, 4670, 4671, 4672, 4673, 4674, 4675, 4676, 4677, 4678, 4679, 4680, 4681, 4683, 4684, 4685, 4686, 4687, 4688, 4689, 4690, 4691, 4692, 4693, 4694, 4695, 4696, 4697, 4698, 4699, 4700, 4701, 4702, 4703, 4704, 4705, 4706, 4707, 4708, 4709, 4710, 4711, 4712, 4713, 4714, 4715, 4716, 4717, 4718, 4719, 4720, 4721, 4722, 4723, 4724, 4725, 4726, 4727, 4728, 4729, 4730, 4731, 4732, 4733, 4734, 4735, 4736, 4737, 4738, 4739, 4740, 4741, 4742, 4743, 4744, 4745, 4746, 4747, 4748, 4749, 4750, 4751, 4752, 4753, 4754, 4755, 4756, 4757, 4758, 4759, 4760, 4761, 4762, 4763, 4764, 4765, 4766, 4767, 4768, 4769, 4771, 4772, 4773, 4774, 4775, 4776, 4777, 4778, 4779, 4780, 4781, 4782, 4783, 4784, 4785, 4786, 4787, 4788, 4789, 4790, 4791, 4792, 4793, 4794, 4795, 4796, 4797, 4798, 4799, 4800, 4801, 4802, 4803, 4805, 4806, 4807, 4808, 4809, 4810, 4811, 4812, 4813, 4814, 4815, 4816, 4817, 4818, 4819, 4820, 4821, 4823, 4824, 4825, 4826, 4827, 4828, 4829, 4830, 4831, 4832, 4833, 4834, 4835, 4836, 4837, 4838, 4839, 4840, 4841, 4842, 4843, 4844, 4845, 4846, 4847, 4848, 4849, 4850, 4851, 4852, 4853, 4854, 4855, 4856, 4857, 4858, 4859, 4860, 4861, 4862, 4863, 4864, 4865, 4866, 4867, 4868, 4869, 4870, 4871, 4872, 4873, 4874, 4875, 4876, 4877, 4878, 4879, 4880, 4881, 4882, 4883, 4884, 4885, 4886, 4887, 4888, 4889, 4890, 4891, 4892, 4893, 4894, 4895, 4896, 4897, 4898, 4899, 4900, 4901, 4902, 4903, 4904, 4905, 4906, 4907, 4908, 4909, 4910, 4911, 4912, 4913, 4914, 4915, 4916, 4917, 4918, 4919, 4920, 4921, 4922, 4923, 4924, 4925, 4926, 4927, 4928, 4929, 4930, 4931, 4932, 4933, 4934, 4935, 4936, 4937, 4938, 4939, 4940, 4941, 4942, 4943, 4944, 4945, 4946, 4947, 4948, 4949, 4950, 4951, 4952, 4953, 4954, 4955, 4956, 4957, 4958, 4959, 4960, 4961, 4962, 4964, 4965, 4966, 4967, 4968, 4969, 4970, 4971, 4972, 4973, 4974, 4975, 4976, 4977, 4978, 4979, 4980, 4981, 4982, 4983, 4984, 4985, 4986, 4987, 4988, 4989, 4990, 4991, 4992, 4993, 4994, 4995, 4996, 4997, 4998, 4999, 5000, 5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010, 5011, 5012, 5013, 5014, 5015, 5016, 5017, 5018, 5019, 5020, 5021, 5022, 5023, 5024, 5025, 5026, 5027, 5028, 5029, 5030, 5031, 5032, 5033, 5034, 5035, 5036, 5037, 5038, 5039, 5040, 5041, 5042, 5043, 5044, 5045, 5046, 5047, 5048, 5049, 5050, 5051, 5052, 5053, 5054, 5056, 5057, 5058, 5059, 5060, 5061, 5062, 5063, 5064, 5065, 5066, 5067, 5068, 5069, 5070, 5071, 5072, 5073, 5074, 5075, 5076, 5077, 5078, 5079, 5080, 5081, 5082, 5083, 5084, 5085, 5086, 5087, 5088, 5089, 5090, 5091, 5092, 5093, 5094, 5095, 5096, 5098, 5099, 5100, 5101, 5104, 5105, 5106, 5107, 5108, 5109, 5110, 5111, 5112, 5113, 5114, 5115, 5116, 5117, 5118, 5119, 5120, 5121, 5122, 5123, 5124, 5125, 5126, 5127, 5128, 5129, 5130, 5131, 5132, 5133, 5134, 5135, 5136, 5137, 5138, 5139, 5140, 5141, 5142, 5143, 5144, 5145, 5146, 5147, 5148, 5149, 5150, 5151, 5152, 5153, 5154, 5155, 5156, 5157, 5158, 5159, 5160, 5161, 5162, 5163, 5164, 5165, 5166, 5167, 5168, 5169, 5170, 5171, 5172, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 5181, 5182, 5183, 5184, 5185, 5186, 5188, 5189, 5190, 5191, 5192, 5193, 5194, 5195, 5196, 5197, 5198, 5199, 5200, 5201, 5202, 5203, 5204, 5205, 5206, 5207, 5208, 5209, 5210, 5211, 5212, 5213, 5214, 5215, 5216, 5217, 5218, 5219, 5220, 5221, 5222, 5223, 5224, 5225, 5226, 5227, 5228, 5229, 5230, 5231, 5232, 5233, 5234, 5235, 5236, 5237, 5238, 5239, 5240, 5241, 5242, 5243, 5244, 5245, 5246, 5247, 5248, 5249, 5250, 5251, 5252, 5253, 5254, 5255, 5256, 5257, 5258, 5259, 5260, 5261, 5262, 5263, 5264, 5265, 5266, 5267, 5268, 5269, 5270, 5271, 5272, 5273, 5274, 5275, 5276, 5277, 5278, 5279, 5280, 5281, 5282, 5283, 5284, 5285, 5286, 5287, 5288, 5289, 5290, 5291, 5292, 5293, 5294, 5295, 5296, 5297, 5298, 5299, 5300, 5301, 5302, 5303, 5304, 5305, 5306, 5307, 5308, 5309, 5310, 5311, 5312, 5313, 5314, 5315, 5316, 5317, 5318, 5319, 5320, 5321, 5322, 5323, 5324, 5325, 5326, 5327, 5328, 5329, 5330, 5331, 5332, 5333, 5334, 5336, 5337, 5338, 5339, 5340, 5341, 5342, 5343, 5344, 5345, 5347, 5348, 5349, 5350, 5351, 5352, 5354, 5355, 5356, 5357, 5358, 5359, 5360, 5361, 5362, 5363, 5364, 5365, 5366, 5367, 5368, 5369, 5370, 5371, 5372, 5373, 5374, 5375, 5376, 5377, 5378, 5379, 5380, 5381, 5382, 5383, 5384, 5385, 5386, 5387, 5388, 5389, 5390, 5391, 5392, 5393, 5394, 5395, 5396, 5397, 5398, 5399, 5400, 5401, 5402, 5403, 5404, 5405, 5406, 5407, 5408, 5409, 5410, 5411, 5412, 5413, 5414, 5415, 5416, 5417, 5418, 5419, 5420, 5421, 5422, 5423, 5424, 5425, 5426, 5427, 5428, 5429, 5430, 5431, 5432, 5433, 5434, 5435, 5436, 5437, 5438, 5439, 5440, 5441, 5442, 5443, 5444, 5445, 5446, 5447, 5448, 5449, 5451, 5453, 5454, 5455, 5456, 5457, 5458, 5459, 5460, 5461, 5462, 5463, 5464, 5465, 5466, 5467, 5468, 5469, 5470, 5471, 5472, 5473, 5474, 5475, 5476, 5477, 5478, 5479, 5480, 5481, 5482, 5483, 5484, 5485, 5486, 5487, 5488, 5489, 5490, 5491, 5492, 5493, 5494, 5495, 5496, 5497, 5498, 5499, 5500, 5501, 5502, 5503, 5504, 5505, 5506, 5507, 5508, 5509, 5510, 5511, 5512, 5513, 5514, 5515, 5516, 5517, 5518, 5519, 5520, 5521, 5522, 5523, 5524, 5525, 5526, 5527, 5528, 5529, 5530, 5531, 5532, 5533, 5534, 5535, 5536, 5537, 5538, 5539, 5540, 5541, 5542, 5544, 5545, 5546, 5547, 5548, 5549, 5550, 5551, 5552, 5553, 5554, 5555, 5556, 5557, 5558, 5559, 5560, 5561, 5562, 5563, 5564, 5565, 5566, 5567, 5568, 5569, 5570, 5571, 5572, 5573, 5574, 5575, 5576, 5577, 5578, 5579, 5580, 5581, 5582, 5583, 5584, 5585, 5586, 5587, 5588, 5589, 5590, 5591, 5592, 5593, 5594, 5595, 5596, 5597, 5598, 5599, 5600, 5601, 5602, 5603, 5604, 5605, 5606, 5607, 5608, 5609, 5610, 5611, 5612, 5614, 5615, 5616, 5617, 5618, 5619, 5620, 5621, 5622, 5623, 5624, 5625, 5626, 5627, 5628, 5629, 5630, 5631, 5632, 5634, 5635, 5636, 5637, 5638, 5639, 5640, 5643, 5644, 5645, 5646, 5647, 5648, 5649, 5650, 5651, 5652, 5653, 5654, 5655, 5656, 5657, 5658, 5659, 5660, 5661, 5662, 5663, 5664, 5665, 5666, 5667, 5668, 5669, 5670, 5671, 5672, 5673, 5674, 5675, 5676, 5677, 5678, 5679, 5680, 5681, 5682, 5683, 5684, 5685, 5686, 5687, 5688, 5689, 5690, 5691, 5692, 5693, 5694, 5695, 5696, 5697, 5698, 5699, 5700, 5701, 5702, 5703, 5704, 5705, 5706, 5707, 5708, 5709, 5710, 5711, 5712, 5713, 5714, 5715, 5716, 5717, 5718, 5719, 5720, 5721, 5722, 5723, 5724, 5725, 5726, 5727, 5728, 5729, 5730, 5731, 5732, 5733, 5734, 5735, 5736, 5737, 5738, 5739, 5740, 5741, 5742, 5743, 5744, 5745, 5746, 5747, 5748, 5750, 5751, 5752, 5753, 5754, 5755, 5756, 5757, 5758, 5759, 5760, 5761, 5762, 5763, 5764, 5765, 5766, 5767, 5768, 5769, 5770, 5771, 5772, 5773, 5774, 5775, 5776, 5777, 5778, 5779, 5780, 5781, 5782, 5783, 5784, 5785, 5786, 5787, 5788, 5789, 5790, 5791, 5792, 5793, 5794, 5795, 5796, 5797, 5798, 5799, 5800, 5801, 5802, 5803, 5804, 5805, 5806, 5807, 5808, 5809, 5810, 5811, 5812, 5813, 5814, 5815, 5816, 5817, 5818, 5819, 5820, 5821, 5822, 5823, 5824, 5825, 5826, 5827, 5828, 5829, 5830, 5831, 5832, 5833, 5834, 5835, 5836, 5837, 5838, 5839, 5840, 5841, 5842, 5843, 5844, 5845, 5846, 5847, 5848, 5849, 5850, 5851, 5852, 5853, 5854, 5855, 5856, 5857, 5858, 5859, 5860, 5861, 5862, 5863, 5864, 5865, 5866, 5867, 5868, 5869, 5870, 5871, 5872, 5873, 5874, 5875, 5876, 5877, 5878, 5879, 5880, 5881, 5882, 5883, 5884, 5885, 5886, 5887, 5888, 5889, 5890, 5891, 5892, 5893, 5894, 5895, 5896, 5897, 5898, 5899, 5900, 5901, 5902, 5903, 5904, 5905, 5906, 5907, 5908, 5909, 5910, 5911, 5912, 5913, 5914, 5915, 5916, 5917, 5918, 5919, 5920, 5921, 5922, 5923, 5924, 5925, 5926, 5927, 5928, 5929, 5930, 5931, 5932, 5933, 5935, 5936, 5937, 5938, 5939, 5940, 5941, 5942, 5943, 5944, 5945, 5946, 5947, 5948, 5949, 5950, 5951, 5952, 5954, 5955, 5956, 5957, 5958, 5959, 5960, 5961, 5962, 5963, 5964, 5965, 5966, 5967, 5968, 5969, 5970, 5971, 5972, 5973, 5974, 5975, 5976, 5977, 5978, 5979, 5980, 5981, 5982, 5984, 5985, 5986, 5987, 5988, 5989, 5990, 5992, 5993, 5995, 5996, 5997, 5998, 5999, 6000, 6002, 6003, 6004, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012, 6013, 6014, 6015, 6016, 6017, 6018, 6019, 6020, 6021, 6022, 6023, 6024, 6025, 6026, 6027, 6028, 6029, 6030, 6031, 6032, 6033, 6034, 6035, 6036, 6037, 6038]
var notImported = 0;
// declare the empty list of objects for which a file is not found:
var fileNotFound = [];

// declare an xml variable to build the xml import file, with the main <import> tag:
var xmlObjectImporter = builder.create('import', {
	version: '1.0', 
	encoding: 'UTF-8', 
	standalone: true
}, {
	headless: false, 
	stringify: {}
});

// start writing in the error files log:
var ErrorFileName = "./destination/fileNotFound_" + cuttOffDate + "_" + iterationRun + ".txt";
fs.writeFile(ErrorFileName, 'List of doc numbers with missing files: \r\n', function(err) {
	if(err) {
		return console.log(err);
	}
});

// this object is declared to contain each xml import nodes before building the xml file:
var xmlObjectElement = {};

// this array is declared to contain all prepared documents/nodes
// for the creation of the xml file:
var allDocumentsList = [];

// *******************************
// ******** My functions *********
// *******************************
// (list of useful functions used in other functions):

// function to count the number of specified letter found in a string:
function NumberOfLetterInString(dname, dletter) {
    var nletter = 0;
    for (var i=0; i < dname.length; i++) {
    		if (dname[i] == dletter) {
    			nletter += 1;
    		}
    	}
    return nletter;	
}

// function returning the positions of each specified letter in a string, and last position is length of string:
function PositionsOfLetterInString(dname, dletter) {
    var sPos = [];
    // console.log('Debug dname, dletter :' + dname +  ' - ' + dletter);
    for(var i=0; i < dname.length; i++) {
        if (dname[i] == dletter) {
        	 sPos.push(i);
        }
    } 
    sPos.push(dname.length + 1);
    return sPos;	
}

// Function removing the specified letter in a string
function RemoveLetterInString(dname, dletter){
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if (dname[i] != dletter) {
        	nString += dname[i];
        }   
    }
    return nString;
}

// Function replacing the specified letter in a string by the second letter
function ReplaceLetterInString(dname, rletter, nletter){
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if (dname[i] == rletter) {
            nString += nletter;
        }
        else {
            nString += dname[i];
        }
    }
    return nString;
}

// Function cleaning a name: remove , and / from a string
function CleanName(dname) {
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if ((dname[i] == ",") || (dname[i] == "/")) {
            nString += "";
        }
        else {
            nString += dname[i];
        }
    }
    return nString;
}

// Function cleaning a date format: remove "-" and ":" and " " from a string
function CleanDate(dname) {
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if ((dname[i] == "-") || (dname[i] == ":") || (dname[i] == " ")) {
            nString += "";
        }
        else {
            nString += dname[i];
        }
    }
    return nString;
}

// Function returning the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var extension = fName.toString().substring(dotpos[0]+1, fName.length);
    return extension;
}

// Function returning a filename without the extension:
function removeFileExtension(fName){
	var dotpos = PositionsOfLetterInString(fName, '.');
	var cleanName = fName.toString().substring(0, dotpos[0]);
	return cleanName;
}

// *******************************
// ***** End of my functions *****
// *******************************

// this function is called to find if the current author of a document exists in the actual list 
// of users and groups in GCdocs, in order to assign it to an existing user, or assign it to a
// default migration user. This function searches on a sorted array, using a binary search.
const userLookup = (GCDocsUG, userID, fullname, start, end) => {			
	
	// console.log('Lookingup : ' + fullname + ' (' + userID + ') in a list of ' + GCDocsUG.length + ' users');
	
	const middle = Math.floor((start + end)/2);

	if (userID.toLowerCase() == GCDocsUG[middle].username.toLowerCase()) {
		// add check on 'last, first' name too to eliminate different users with same userID
		if (fullname.toLowerCase() == (GCDocsUG[middle].lastname.toLowerCase() + ', ' + GCDocsUG[middle].firstname.toLowerCase())) {
			return GCDocsUG[middle].username;
		}
		else {
			return 'EKMEmigrationUser';
		}
		
	}
	if ((end - 1) === start) {
		return 'EKMEmigrationUser';
	}
	if (userID.toLowerCase() > GCDocsUG[middle].username.toLowerCase() ) {
		return userLookup(GCDocsUG, userID, fullname, middle, end);
	}
	if (userID.toLowerCase() < GCDocsUG[middle].username.toLowerCase() ) {
		return userLookup(GCDocsUG, userID, fullname, start, middle);
	}		
};

// this function is called to find the real file name of a document and if it exists 
// in the actual list of files from RDIMS,  in order to connect the existing file to the
// imported document. If the file doesn't exist, this document number won't be imported
// and it will be added to the list of documents with no files.
// This function searches on a sorted array, using a binary search.
const realFile = (fileList, calculatedFileName, start, end) => {
	const middle = Math.floor((start + end)/2);
	
	if (removeFileExtension(fileList[middle].name).toLowerCase() == removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			// uncomment the following 3 lines to copy files to an "upload" directory to move only the needed
			// files to the Content Server upload directory (when the Upload directory is set and used by OI):
			//var fSource = filesListJSON[middle].directory + '/' + fileList[middle].name;
			//var fDestination = './destination/upload/' + fileList[middle].name;
			//fs.createReadStream(fSource).pipe(fs.createWriteStream(fDestination));
			return (fileList[middle].name);
	}
	if ((end - 1) === start) {
		return 'noFile';
	}
	if (removeFileExtension(fileList[middle].name.toLowerCase()) < removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			return realFile(fileList, calculatedFileName, middle, end);
	}
	if (removeFileExtension(fileList[middle].name.toLowerCase()) > removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			return realFile(fileList, calculatedFileName, start, middle);
	}	
};

// function to find the min version of a document.
// need to improve as this filter doesn't seem to be good for performance...
function minVersion(allDocuments, aDocNum) {
		var versMin = 100;
		for (var iDocs = 0 ; iDocs < allDocuments.length ; iDocs++) {
			if (allDocuments[iDocs].docnumber == aDocNum){
				if (allDocuments[iDocs].version < versMin) {
					versMin = allDocuments[iDocs].version;
				}
			}
		}
		return versMin;
	}

// function to clean up the date from SQL/JSON to a proper format for the object importer:
// SQL / JSON format: 2018-06-08 18:31:56.000
// required by Object Importer: YYYYMMDDHHMMSS ==> 20180608183156
function dateToOIFormat(date) {
	var formatedDate = "";
	formatedDate = removeFileExtension(CleanDate(date));
	return formatedDate;
}


// this function builds the list of all documents with proper data to build the import xml
function buildDocList(documents){
	var allDocuments = [];
	// loop through the list of all documents:
	for (var docs = 0 ; docs < documents.length ; docs++) {
		// progress lines...
		 process.stdout.write('\x1Bc');
		 console.log('...processing object ' + (docs + 1) + ' of ' + documents.length);
		// initializes each parts of edocsconvert.js objects:
		var oneDocument = {};
		edocs.reset();
		edocs.addNumber(documents[docs].docnumber);
		edocs.addVersion(documents[docs].version);
		edocs.addSubVersion(documents[docs].subversion);
		edocs.addExtension(documents[docs].extension);
		
		// only proceed if current doc number is not in the "do not import" list:
		if (doNotimportList.indexOf(Number(documents[docs].docnumber)) == -1) {
			// calculate the potential file names from document numbers:
			var enhFilename = edocs.num2DOCSEnh();
			var unixFilename = edocs.Num2DOCSunix();
			// check if the file exists and return its full name and path if so or "noFile" if not,
			// start with enhanced (most common) and only if not found test UNIX file name.
			var realEnhFile = "noFile";
			var realUnixFile = "noFile";
			realEnhFile = realFile(filesListJSON, enhFilename, 0, FListLen-1);
			if (realEnhFile == "noFile") {
				realUnixFile = realFile(filesListJSON, unixFilename, 0, FListLen-1);
			}
		
			// populate the properties of one document used to build the xml node:
		
			// - find the minimum version of the document to later know if this document should
			//   be created or a version added:
			oneDocument.minVersion = minVersion(documentsJSON, documents[docs].docnumber);
		
			// - file name: check if a unix or enhanced file was found and use its path and name, 
			//  otherwise use "noFile" if no file exists for this document number:
			if (realEnhFile != "noFile") {
				oneDocument.file = realEnhFile;
			} else if (realUnixFile != "noFile") {
				oneDocument.file = realUnixFile;
			} else {
				oneDocument.file = "noFile";
			}
		
			// - document number:
			oneDocument.docnumber = documents[docs].docnumber;
			// - creator: keeping the value from EKME before lookup to populate the EKME category
			// - author: check if the user exists in GCdocs or use a generic import user:
			oneDocument.creator = documents[docs].authorfullname + ' (' + documents[docs].author + ')';
			oneDocument.author = userLookup(GCdocsUGJSON , documents[docs].author, documents[docs].authorfullname, 0, UGlen-1);
			oneDocument.externalAuthor = documents[docs].authorexternal;
			// - modifiedby: keeping the value from EKME before lookup to populate the EKME category
			// - modifiedGCdocs: check if the user exists in GCdocs or use a generic import user:
			oneDocument.modifiedby = documents[docs].modifiedbyfullname + ' (' + documents[docs].modifiedby + ')';
			oneDocument.modifiedGCdocs = userLookup(GCdocsUGJSON , documents[docs].modifiedby, documents[docs].modifiedbyfullname, 0, UGlen-1);
		
			// - version
			oneDocument.version = documents[docs].version;
			oneDocument.subversion = documents[docs].subversion;
			var subVersion = "";
			if (documents[docs].subversion != "!") {
				subVersion = documents[docs].subversion;
			}
			oneDocument.versiondesc = documents[docs].versiondesc + ' - Version: ' + documents[docs].version + subVersion + '' +' - by: ' + oneDocument.modifiedby;
		
			// - description (if no description, add a generic one)
			if (documents[docs].filecode == "") {
				oneDocument.filecode = 'n/a';
			} else {
				oneDocument.filecode = documents[docs].filecode;
			}
			if (documents[docs].description == "") {
				oneDocument.description = 'Imported from EKME - File code: ' + oneDocument.filecode + ' ';
				}
			else {
				oneDocument.description = documents[docs].description + ' - File code: ' + oneDocument.filecode + ' ';
			} 
			// - destination folder (removes trailing ":" and all of them if multiple)
			oneDocument.location = documents[docs].destinationFolder.replace(/:+$/, "");
			// - title: append # and document number to all documents imported from RDIMS
			oneDocument.title = documents[docs].title + ' EKME ' + documents[docs].docnumber;
			oneDocument.title = oneDocument.title.replace(/:/," ");
			// - other straightforward metadata:
			// The modified date cannot be earlier than the create date:
			if (dateToOIFormat(documents[docs].modified) >= dateToOIFormat(documents[docs].created)) {
				oneDocument.modified = dateToOIFormat(documents[docs].modified);
			} else {
				oneDocument.modified = dateToOIFormat(documents[docs].created);
			}
			oneDocument.modifiedReal = dateToOIFormat(documents[docs].modified);
			oneDocument.modifiedvers = dateToOIFormat(documents[docs].modifiedvers);
			oneDocument.created = dateToOIFormat(documents[docs].created);
			oneDocument.createdby = documents[docs].author;
			oneDocument.doctype = documents[docs].doctype;
			oneDocument.classif = documents[docs].classif;
		
			allDocuments.push(oneDocument);
		} else {
			notImported += 1;
		}	
	}
	return allDocuments;
}

// this function builds the main nodes for all documents in the documents array:
function buildXML(documents) {
	// initialize the returned array:
	var nodeArray = [];
	// loops through all documents to import:
	for (var iDoc = 0; iDoc < documents.length; iDoc++) {		
		var nodeType = 'document';
		// in case of oldest version, we create the document, otherwise, we add a version
		// Make sure the source data is sorted by docnumber and then version number.
		if (documents[iDoc].file != 'noFile'){ // we found a corresponding file
			totalfilesProcessed = totalfilesProcessed + 1;
			if (documents[iDoc].version == documents[iDoc].minVersion && documents[iDoc].subversion == "!") { // first version
				 var nodeObject = {
						node: {
							location: documents[iDoc].location,
							file: documents[iDoc].file,
							title: { '#text': documents[iDoc].title, '@language': langCodeEn},
							owner: documents[iDoc].author,
							createdby: documents[iDoc].author,
							created: documents[iDoc].created,
							modified: documents[iDoc].modified,
							description: {'#text': documents[iDoc].description, '@language': langCodeEn},
							category: {
								attribute: [
									{ '#text': documents[iDoc].docnumber, '@name': "EKME Document Number" },
									{ '#text': documents[iDoc].creator, '@name': "EKME Creator" },
									{ '#text': documents[iDoc].doctype, '@name': "EKME Document Type" },
									{ '#text': documents[iDoc].filecode, '@name': "EKME File Code" },
									{ '#text': documents[iDoc].modifiedby, '@name': "EKME Modified by" },
									{ '#text': documents[iDoc].modifiedReal, '@name': "EKME Last Modified Date" },
									{ '#text': documents[iDoc].externalAuthor, '@name': "EKME External Author" },
									{ '#text': documents[iDoc].classif, '@name': "EKME Security Classification" },
									],
								'@name': "Content Server Categories:DFO Business Categories:EKME",
							},
							// acl: buildACLnode(documents[iDoc].docnumber, EKMEGroupsACLJSON),
							'@type': nodeType,
							'@action': "create",
							} 
					};
			} else { // not first version, we add a new version instead of creating a document
			// need to check if "Add Title to Location” check box is unchecked in settings (then this code is fine), 
			// otherwise need to separate the title from location and add <title> as a separate attribute,
			// this happens only for adding a version or updating a document, not with 'create'.
			// descriptions of versions does not support "language" attribute.
					var nodeObject = {
						node: {
							location: documents[iDoc].location + ':' + documents[iDoc].title,
							file: documents[iDoc].file,
							modified: documents[iDoc].modifiedvers,
							createdby: documents[iDoc].modifiedGCdocs,
							created: documents[iDoc].modifiedvers,
							description: documents[iDoc].versiondesc,
							'@type': nodeType,
							'@action': "addversion",
							}
					};
			}
			nodeArray.push(nodeObject);
		}
		else { // no real file was found for this document number -> add to list of files not found
			var noFileObject = {
				docnumber: documents[iDoc].docnumber
			};
			fileNotFound.push(noFileObject);
			totalfileNotFound = totalfileNotFound + 1;
		}
	}
	return nodeArray;
}

// main calls to the 2 functions: 
// - build all documents list from the JSON source:
allDocumentsList =  buildDocList(documentsJSON);


// - build the xml array from the previous document list:
xmlObjectElement = buildXML(allDocumentsList);

// writing our elements in the xml file using the XML object:
var ele = xmlObjectImporter.ele(xmlObjectElement);


// write the xml variable result to multiple files of 1000 nodes each, 
// which will be used to perform the object importer action in GCdocs.

console.log("Number of documents not imported: " + notImported);

// First open the <xml> oi file:
var DestinationFileName = "./destination/oiEKME_" + cuttOffDate + "_" + iterationRun + ".xml";
fs.writeFile(DestinationFileName, '<?xml version="1.0" encoding="utf-8"?>\r\n', function(err) {
	if(err) {
		return console.log(err);
	}
});


// then write the file
fs.appendFile(DestinationFileName, xmlObjectImporter.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the XML object importer file is saved! - number of processed files: " + totalfilesProcessed);
});

// write the list of files not found to a log:
fs.appendFile(ErrorFileName, JSON.stringify(fileNotFound, null, 2), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of files not found is saved! - number of files not found: " + totalfileNotFound);
});

// end timestamp used to calculate the time spent processing.
const timeend = Date.now();
// Calculate the time spent processing and display it
const timespent = timeend - timestart;
console.log('Time spent processing ' + documentsJSON.length + 
' documents: ' + timespent / 1000 + ' seconds');