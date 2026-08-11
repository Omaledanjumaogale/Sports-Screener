// Public API + internal persistence for the AI Predictor.
// Public queries/mutations are read/write for the predictor UI. Internal
// mutations (marked `internal`) are called only by the SMOA orchestrator.

import { query, mutation, action, internalMutation, internalAction, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { watTodayKey } from './scrapers/sources';

const sportId = v.union(
  v.literal('football'),
  v.literal('basketball'),
  v.literal('tennis'),
  v.literal('rally'),
  v.literal('hockey'),
  v.literal('baseball'),
  v.literal('americanfootball'),
  v.literal('rugby'),
  v.literal('cricket'),
  v.literal('mma'),
  v.literal('volleyball')
);

const dayStatus = v.union(
  v.literal('pending'),
  v.literal('refreshing'),
  v.literal('ready'),
  v.literal('partial'),
  v.literal('stale'),
  v.literal('error')
);

const runStatus = v.union(
  v.literal('pending'),
  v.literal('running'),
  v.literal('complete'),
  v.literal('error')
);

// ── Per-sport keyword fingerprints ────────────────────────────────────────────
// Each entry is a list of WORD-BOUNDARY phrases that POSITIVELY identify a
// match as belonging to that sport. A match must contain at least one of these
// to be admitted into that sport's tab. Keywords use word boundaries (\b) so
// generic substrings like "over", "liga", "cup" cannot cause false rejections.
// Generic/common English words (over, test, cup final, etc.) are intentionally
// NOT present here — they create cross-sport false negatives.
const SPORT_KEYWORDS: Record<string, { positive: RegExp[]; strongExclusive: RegExp[] }> = {
  football: {
    strongExclusive: [/\bpremier league\b/i, /\bla liga\b/i, /\bserie a\b(?!.*basket)/i, /\bbundesliga\b/i, /\bligue 1\b/i, /\bchampions league\b/i, /\beuropa league\b/i, /\bconference league\b/i, /\befl championship\b/i, /\bleague one\b/i, /\bleague two\b/i, /\beredivisie\b/i, /\bprimeira liga\b/i, /\bsuper lig\b/i, /\bliga mx\b/i, /\bcopa libertadores\b/i, /\bcopa america\b/i, /\bfa cup\b/i, /\befl cup\b/i, /\bdfb pokal\b/i, /\bcopa del rey\b/i, /\bcoppa italia\b/i, /\bscottish premiership\b/i, /\bbelgian pro league\b/i, /\ballsvenskan\b/i, /\beliteserien\b/i, /\bdanish superliga\b/i, /\bswiss super league\b/i, /\bgreek super league\b/i, /\baustrian bundesliga\b/i, /\bbrazil serie a\b/i, /(?<!volleyball )\bnations league\b/i, /\bafrica cup of nations\b/i, /\barsenal\b/i, /\bchelsea\b/i, /\bliverpool\b/i, /\breal madrid\b(?!.*basket)/i, /\bfc barcelona\b/i, /\bfc bayern\b/i, /\bjuventus\b/i, /\binter milan\b/i, /\bac milan\b/i, /\bparis sg\b/i, /\btottenham\b/i, /\bmanchester united\b/i, /\bmanchester city\b/i, /\baston villa\b/i, /\bbrighton hove\b/i, /\bcrystal palace\b/i, /\bwest ham\b/i, /\bnewcastle united\b/i, /\bleicester city\b/i, /\bleeds united\b/i, /\bnottingham forest\b/i, /\batletico madrid\b/i, /\bsevilla\b/i, /\bvillarreal\b/i, /\bnapoli\b/i, /\bas roma\b/i, /\blazio\b/i, /\batalanta\b/i, /\bfiorentina\b/i, /\bmonaco\b/i, /\blille osc\b/i, /\bmarseille\b/i, /\bolympique lyon\b/i, /\brennes\b/i, /\boriginal dortmund\b/i, /\bleipzig\b/i, /\bleverkusen\b/i, /\beintracht frankfurt\b/i, /\bbenfica\b/i, /\bporto\b/i, /\bsporting cp\b/i, /\bajax\b/i, /\bfeyenoord\b/i, /\bpsv eindhoven\b/i, /\bceltic fc\b/i, /\brangers fc\b/i, /\bnpfl\b/i, /\bmls\b(?!.*basket)/i, /\bsoccer\b/i, /\bfootball\b(?!.*(american|rugby|australian))/i],
    positive: [/\bpremier league\b/i, /\bla liga\b/i, /\bserie a\b/i, /\bbundesliga\b/i, /\bligue 1\b/i, /\bligue 2\b/i, /\bchampions league\b/i, /\beuropa league\b/i, /\bconference league\b/i, /\bchampionship\b/i, /\bleague one\b/i, /\bleague two\b/i, /\beredivisie\b/i, /\bprimeira liga\b/i, /\bsuper lig\b/i, /\bliga mx\b/i, /\bmls\b/i, /\bnpfl\b/i, /\bcopa libertadores\b/i, /\bcopa america\b/i, /\bfa cup\b/i, /\befl cup\b/i, /\bdfb pokal\b/i, /\bcopa del rey\b/i, /\bcoppa italia\b/i, /\bsoccer\b/i, /\bfootball\b/i, /\barsenal\b/i, /\bchelsea\b/i, /\bliverpool\b/i, /\bman city\b/i, /\bmanchester\b/i, /\breal madrid\b/i, /\bbarcelona\b/i, /\bbayern\b/i, /\bjuventus\b/i, /\binter milan\b/i, /\bac milan\b/i, /\bpsg\b/i, /\bparis sg\b/i, /\btottenham\b/i, /\beverton\b/i, /\bdortmund\b/i, /\bnapoli\b/i, /\broma\b/i, /\bbenfica\b/i, /\bporto\b/i, /\bsporting\b/i, /\bajax\b/i, /\bfeyenoord\b/i, /\bpsv\b/i, /\bceltic\b/i, /\bnewcastle\b/i, /\baston villa\b/i, /\bwest ham\b/i, /\bbrighton\b/i, /\bwolves\b/i, /\bfulham\b/i, /\bbrentford\b/i, /\bcrystal palace\b/i, /\bleicester\b/i, /\bsouthampton\b/i, /\bleeds\b/i, /\bnottingham\b/i, /\bsevilla\b/i, /\bvillarreal\b/i, /\breal sociedad\b/i, /\bbetis\b/i, /\bgetafe\b/i, /\bvalencia\b/i, /\bosasuna\b/i, /\blazio\b/i, /\batalanta\b/i, /\bfiorentina\b/i, /\btorino\b/i, /\bbologna\b/i, /\bmonaco\b/i, /\blille\b/i, /\bmarseille\b/i, /\blyon\b/i, /\brennes\b/i, /\bnice\b/i, /\bleipzig\b/i, /\bleverkusen\b/i, /\bfrankfurt\b/i, /\bwolfsburg\b/i, /\bgladbach\b/i, /\bscottish premiership\b/i, /\bbelgian pro league\b/i, /\bturkish super lig\b/i, /\ballsvenskan\b/i, /\beliteserien\b/i, /\bdanish superliga\b/i, /\bswiss super league\b/i, /\bgreek super league\b/i, /\baustrian bundesliga\b/i, /\bbrazil serie a\b/i,    /\bargentina primera\b/i, /\bchile primera\b/i, /\befl\b/i, /(?<!volleyball )\bnations league\b/i, /\bcup of nations\b/i,
    // Extended global country coverage
    /\bvirsliga\b/i, /\ba lyga\b/i, /\bmeistriliiga\b/i, /\berovnuli\b/i, /\bgirabola\b/i, /\bmoçambola\b/i, /\blinafoot\b/i, /\belite one\b/i, /\bkenya premier league\b/i, /\buganda premier league\b/i, /\bzambia super league\b/i, /\bzimbabwe premier\b/i, /\bethiopian premier\b/i, /\birish premier division\b/i, /\bnifl\b/i, /\bwelsh premier\b/i, /\bmaltese premier\b/i, /\bgibraltar\b/i, /\balbanian superliga\b/i, /\bbosnian premier\b/i, /\bkosovo superleague\b/i, /\buzbekistan super league\b/i, /\bmalaysia super league\b/i, /\bindonesia liga\b/i, /\bsingapore premier\b/i, /\bhong kong premier\b/i, /\biraqi premier\b/i, /\bjordan pro league\b/i, /\bkuwait premier\b/i, /\boman pro league\b/i, /\biranian\b(?!.*(tennis|basket))/i]
  },
  basketball: {
    strongExclusive: [/\bnba\b/i, /\beuroleague\b(?!.*(soccer|football))/i, /\bwnba\b/i, /\bncaab\b/i, /\bacb\b/i, /\bliga acb\b/i, /\bcba\b/i, /\bpba\b/i, /\bfiba\b/i, /\bbasketball\b/i, /\blnb pro\b/i, /\bceltics\b/i, /\blakers\b/i, /\bwarriors\b/i, /\bbucks\b/i, /\bbulls\b/i, /\bheat\b/i, /\bknicks\b/i, /\bnets\b/i, /\b76ers\b/i, /\bclippers\b/i, /\bsuns\b/i, /\bmavericks\b/i, /\bnuggets\b/i, /\braptors\b/i, /\bhawks\b/i, /\bpacers\b/i, /\bhornets\b/i, /\bwizards\b/i, /\bpistons\b/i, /\bcavaliers\b/i, /\bthunder\b/i, /\btrail blazers\b/i, /\bgrizzlies\b/i, /\npelicans\b/i, /\bspurs\b/i, /\brockets\b/i, /\bjazz nba\b/i, /\btimberwolves\b/i, /\bkings\b/i, /\borlando magic\b/i, /\bolympiacos basket\b/i, /\breal madrid basket\b/i, /\bfenerbahce basket\b/i, /\banadolu efes\b/i, /\bpanathinaikos basket\b/i, /\bmaccabi tel aviv\b/i, /\bcska moscow basket\b/i, /\balba berlin basket\b/i, /\bbaskonia\b/i, /\bvalencia basket\b/i, /\bvirtus bologna\b/i],
    positive: [/\bnba\b/i, /\beuroleague\b/i, /\bwnba\b/i, /\bncaab\b/i, /\bacb\b/i, /\bliga acb\b/i, /\bcba\b/i, /\bpba\b/i, /\blnb pro\b/i, /\bfiba\b/i, /\bbasketball\b/i, /\bceltics\b/i, /\blakers\b/i, /\bwarriors\b/i, /\bbucks\b/i, /\bbulls\b/i, /\bheat\b/i, /\bknicks\b/i, /\bnets\b/i, /\b76ers\b/i, /\bclippers\b/i, /\bsuns\b/i, /\bmavericks\b/i, /\bnuggets\b/i, /\braptors\b/i, /\bhawks\b/i, /\bpacers\b/i, /\bhornets\b/i, /\bwizards\b/i, /\bpistons\b/i, /\bcavaliers\b/i, /\bthunder\b/i, /\btrail blazers\b/i, /\bgrizzlies\b/i, /\npelicans\b/i, /\bspurs\b/i, /\brockets\b/i, /\bjazz\b/i, /\btimberwolves\b/i, /\bkings\b/i, /\bmagic\b/i, /\bolympiacos\b/i, /\breal madrid basket\b/i, /\bfenerbahce\b/i, /\banadolu efes\b/i, /\bpanathinaikos\b/i, /\bmaccabi\b/i, /\bcska moscow\b/i, /\balba berlin\b/i,    /\bbaskonia\b/i, /\bvalencia basket\b/i, /\bzenit\b/i, /\bvirtus bologna\b/i,
    // Extended global basketball coverage
    /\bknights basket\b/i, /\bbbl\b(?!.*(cricket|big bash))/i, /\bbnxt\b/i, /\bkorisliiga\b/i, /\bbasketligan\b/i, /\bliga unike\b/i, /\bnbb\b/i, /\blnpb\b/i, /\bbsn\b/i, /\bligat haal\b/i, /\bbsl\b/i, /\ba1 ethniki\b/i, /\bvtb\b/i, /\bliga endesa\b/i, /\blba\b/i, /\blega basket\b/i, /\bsuperliga argentina\b/i, /\bnbl canada\b/i, /\btbl\b/i, /\bturkish basketball\b/i, /\bfiba europe cup\b/i, /\bbasketball champions league\b/i]
  },
  tennis: {
    strongExclusive: [/\batp tour\b/i, /\bwta tour\b/i, /\bgrand slam\b/i, /\bwimbledon\b/i, /\bus open tennis\b/i, /\bfrench open\b/i, /\baustralian open\b/i, /\broland garros\b/i, /\bmasters 1000\b/i, /\batp 250\b/i, /\batp 500\b/i, /\batp finals\b/i, /\bwta finals\b/i, /\btennis\b/i, /\bcarlos alcaraz\b/i, /\bjannik sinner\b/i, /\bnovak djokovic\b/i, /\balexander zverev\b/i, /\bdaniil medvedev\b/i, /\biga swiatek\b/i, /\baryna sabalenka\b/i, /\belena rybakina\b/i, /\bjessica pegula\b/i, /\bcoco gauff\b/i, /\bsimona halep\b/i, /\bnaomi osaka\b/i, /\broger federer\b/i, /\brafael nadal\b/i, /\bandy murray\b/i, /\bmatteo berrettini\b/i, /\bstefanos tsitsipas\b/i, /\bcasper ruud\b/i, /\bholger rune\b/i, /\bcameron norrie\b/i, /\btaylor fritz\b/i, /\bfrances tiafoe\b/i, /\bnick kyrgios\b/i, /\bkhachanov\b/i, /\bhubert hurkacz\b/i, /\balexander bublik\b/i, /\bfelix auger aliassime\b/i],
    positive: [/\batp\b/i, /\bwta\b/i, /\bgrand slam\b/i, /\bwimbledon\b/i, /\bus open\b/i, /\bfrench open\b/i, /\baustralian open\b/i, /\broland garros\b/i, /\bmasters 1000\b/i, /\batp tour\b/i, /\bwta tour\b/i, /\balcaraz\b/i, /\bsinner\b/i, /\bdjokovic\b/i, /\bzverev\b/i, /\bmedvedev\b/i, /\bswiatek\b/i, /\bsabalenka\b/i, /\brybakina\b/i, /\bpegula\b/i, /\bgauff\b/i, /\bhalep\b/i, /\bosaka\b/i, /\bfederer\b/i, /\bnadal\b/i, /\bmurray\b/i, /\bberrettini\b/i, /\btsitsipas\b/i, /\bruud\b/i, /\brune\b/i, /\bnorrie\b/i, /\bfritz\b/i, /\btiafoe\b/i, /\bkyrgios\b/i, /\bkhachanov\b/i, /\bhurkacz\b/i, /\bbublik\b/i,    /\bauger aliassime\b/i, /\btennis\b/i, /\batp 250\b/i, /\batp 500\b/i, /\bwta 125\b/i, /\bdavis cup\b/i, /\bbillie jean king\b/i, /\bunited cup\b/i, /\blaver cup\b/i, /\bnext gen finals\b/i, /\batp finals\b/i, /\bwta finals\b/i]
  },
  rally: {
    strongExclusive: [/\bittf\b/i, /\bwtt series\b/i, /\btable tennis\b/i, /\bping pong\b/i, /\btt cup\b/i, /\bworld table tennis\b/i, /\bworld table tennis championships\b/i, /\bfelix lebrun\b/i, /\balexis lebrun\b/i, /\btomokazu harimoto\b/i, /\bfan zhendong\b/i, /\bma long\b/i, /\bwang chuqin\b/i, /\btimo boll\b/i, /\bdimitrij ovtcharov\b/i, /\bsun yingsha\b/i, /\bchen meng\b/i, /\bwong chun ting\b/i, /\bhugo calderano\b/i, /\bquadri aruna\b/i, /\btruls moregard\b/i, /\bdarko jorgic\b/i, /\bdang qiu\b/i, /\bpatrick franziska\b/i, /\bwang manyu\b/i, /\blin gaoyuan\b/i, /\bliang jingkun\b/i, /\bliam pitchford\b/i, /\bbernhard filus\b/i, /\bvladimir samsonov\b/i],
    positive: [/\bittf\b/i, /\bwtt\b/i, /\btable tennis\b/i, /\bping pong\b/i, /\btt cup\b/i, /\bworld table tennis\b/i, /\blebrun\b/i, /\bharimoto\b/i, /\bzhendong\b/i, /\bma long\b/i, /\bfan zhendong\b/i, /\btimo boll\b/i, /\bovtcharov\b/i, /\bchuqin\b/i, /\bwang chuqin\b/i, /\byingsha\b/i, /\bsun yingsha\b/i, /\bchen meng\b/i, /\bcalderano\b/i, /\baruna\b/i, /\bmoregard\b/i, /\bjorgic\b/i, /\bqiu\b/i, /\bfranziska\b/i, /\bmanyu\b/i, /\blin gaoyuan\b/i, /\bliang jingkun\b/i,    /\bpitchford\b/i, /\bfilus\b/i, /\bsamsonov\b/i, /\btoth\b/i, /\bwtt champions\b/i, /\bwtt contender\b/i, /\bwtt star contender\b/i, /\beurope top 16\b/i, /\bittf world tour\b/i]
  },
  hockey: {
    strongExclusive: [/\bnhl\b/i, /\bkhl\b/i, /\bshl hockey\b/i, /\bliiga\b/i, /\bahl hockey\b/i, /\bdel hockey\b/i, /\bice hockey\b/i, /\bprague extraliga\b/i, /\bnational league switzerland\b/i, /\bnhl bruins\b/i, /\bnhl canadiens\b/i, /\btoronto maple leafs\b/i, /\bnew york rangers\b/i, /\bedmonton oilers\b/i, /\bcalgary flames\b/i, /\bvancouver canucks\b/i, /\bottawa senators\b/i, /\bwinnipeg jets\b/i, /\bcolorado avalanche\b/i, /\bst louis blues\b/i, /\bminnesota wild\b/i, /\bnashville predators\b/i, /\bdallas stars\b/i, /\bchicago blackhawks\b/i, /\bdetroit red wings\b/i, /\bpittsburgh penguins\b/i, /\bphiladelphia flyers\b/i, /\bnew jersey devils\b/i, /\bnew york islanders\b/i, /\bbuffalo sabres\b/i, /\bwashington capitals\b/i, /\bcarolina hurricanes\b/i, /\bflorida panthers\b/i, /\btampa bay lightning\b/i, /\barizona coyotes\b/i, /\bsan jose sharks\b/i, /\banahiem ducks\b/i, /\bla kings\b/i, /\bseattle kraken\b/i, /\bvegas golden knights\b/i, /\bcska hockey\b/i, /\bska hockey\b/i],
    positive: [/\bnhl\b/i, /\bkhl\b/i, /\bshl\b/i, /\bliiga\b/i, /\bahl\b/i, /\bdel\b/i, /\bczech extraliga\b/i, /\bnl switzerland\b/i, /\bice hockey\b/i, /\bhockey\b(?!.*(rugby|field))/i, /\bbruins\b/i, /\bcanadiens\b/i, /\bmaple leafs\b/i, /\brangers\b/i, /\boilers\b/i, /\bflames\b/i, /\bcanucks\b/i, /\bsenators\b/i, /\bjets\b/i, /\bavalanche\b/i, /\bblues\b/i, /\bwild\b/i, /\bpredators\b/i, /\bstars\b/i, /\bblackhawks\b/i, /\bred wings\b/i, /\bpenguins\b/i, /\bflyers\b/i, /\bdevils\b/i, /\bislanders\b/i, /\bsabres\b/i, /\bcapitals\b/i, /\bhurricanes\b/i, /\bpanthers\b/i, /\blightning\b/i, /\bcoyotes\b/i, /\bsharks\b/i, /\bducks\b/i, /\bkings\b/i, /\bkraken\b/i, /\bgolden knights\b/i,    /\bcska\b/i, /\bska\b/i, /\bchampions hockey league\b/i, /\balps hockey league\b/i, /\bechl\b/i, /\bsphl\b/i, /\bmestis\b/i, /\bhockeyettan\b/i, /\bohL\b/i, /\bQMJHL\b/i, /\bwhl hockey\b/i, /\bbelarusian extraliga\b/i, /\bkazakhstan hockey\b/i]
  },
  baseball: {
    strongExclusive: [/\bmlb\b/i, /\bnpb baseball\b/i, /\bkbo baseball\b/i, /\bmilb\b/i, /\bbaseball\b/i, /\bnew york yankees\b/i, /\bboston red sox\b/i, /\blos angeles dodgers\b/i, /\bsan francisco giants\b/i, /\bchicago cubs\b/i, /\bchicago white sox\b/i, /\bnew york mets\b/i, /\bhouston astros\b/i, /\btoronto blue jays\b/i, /\btampa bay rays\b/i, /\boakland athletics\b/i, /\bseattle mariners\b/i, /\blos angeles angels\b/i, /\btexas rangers\b/i, /\bphiladelphia phillies\b/i, /\batlanta braves\b/i, /\bmiami marlins\b/i, /\bwashington nationals\b/i, /\bst louis cardinals\b/i, /\bmilwaukee brewers\b/i, /\bcincinnati reds\b/i, /\bpittsburgh pirates\b/i, /\bsan diego padres\b/i, /\bcolorado rockies\b/i, /\barizona diamondbacks\b/i, /\bdetroit tigers\b/i, /\bkansas city royals\b/i, /\bminnesota twins\b/i, /\bcleveland guardians\b/i, /\bbaltimore orioles\b/i, /\blvbp\b/i, /\blmb\b/i],
    positive: [/\bmlb\b/i, /\bnpb\b/i, /\bkbo\b/i, /\bmilb\b/i, /\bbaseball\b/i, /\byankees\b/i, /\bred sox\b/i, /\bdodgers\b/i, /\bgiants\b/i, /\bcubs\b/i, /\bwhite sox\b/i, /\bmets\b/i, /\bastros\b/i, /\bblue jays\b/i, /\brays\b/i, /\bathletics\b/i, /\bmariners\b/i, /\bangels\b/i, /\brangers\b/i, /\bphillies\b/i, /\bbraves\b/i, /\bmarlins\b/i, /\bnationals\b/i, /\bcardinals\b/i, /\bbrewers\b/i, /\breds\b/i, /\bpirates\b/i, /\bpadres\b/i, /\brockies\b/i, /\bdiamondbacks\b/i, /\btigers\b/i, /\broyals\b/i, /\btwins\b/i, /\bguardians\b/i, /\borioles\b/i,    /\blvbp\b/i, /\blmb\b/i, /\baustralian baseball\b/i, /\bserie del caribe\b/i, /\bcaribbean series\b/i, /\bpremier12\b/i, /\batlantic league\b/i, /\bfrontier league\b/i, /\bcuban national series\b/i]
  },
  americanfootball: {
    strongExclusive: [/\bnfl\b/i, /\bncaaf\b/i, /\bxfl\b/i, /\bcfl\b/i, /\bsuper bowl\b/i, /\bamerican football\b/i, /\bkc chiefs\b/i, /\bphiladelphia eagles\b/i, /\bdallas cowboys\b/i, /\bsan francisco 49ers\b/i, /\bbaltimore ravens\b/i, /\bbuffalo bills\b/i, /\bcincinnati bengals\b/i, /\bpittsburgh steelers\b/i, /\bcleveland browns\b/i, /\bnew york jets\b/i, /\bnew england patriots\b/i, /\bmiami dolphins\b/i, /\bhouston texans\b/i, /\bjaguars\b/i, /\bindianapolis colts\b/i, /\btennessee titans\b/i, /\blas vegas raiders\b/i, /\blos angeles chargers\b/i, /\bdenver broncos\b/i, /\bgreen bay packers\b/i, /\bminnesota vikings\b/i, /\bchicago bears\b/i, /\bdetroit lions\b/i, /\btampa bay buccaneers\b/i, /\batlanta falcons\b/i, /\bnew orleans saints\b/i, /\bcarolina panthers\b/i, /\blos angeles rams\b/i, /\bseattle seahawks\b/i, /\barizona cardinals nfl\b/i, /\bwashington commanders\b/i, /\bny giants nfl\b/i],
    positive: [/\bnfl\b/i, /\bncaaf\b/i, /\bxfl\b/i, /\bcfl\b/i, /\bsuper bowl\b/i, /\bamerican football\b/i, /\bchiefs\b/i, /\beagles\b/i, /\bcowboys\b/i, /\b49ers\b/i, /\bravens\b/i, /\bbills\b/i, /\bbengals\b/i, /\bsteelers\b/i, /\bbrowns\b/i, /\bjets\b/i, /\bpatriots\b/i, /\bdolphins\b/i, /\btexans\b/i, /\bjaguars\b/i, /\bcolts\b/i, /\btitans\b/i, /\braiders\b/i, /\bchargers\b/i, /\bbroncos\b/i, /\bpackers\b/i, /\bvikings\b/i, /\bbears\b/i, /\blions\b/i, /\bbuccaneers\b/i, /\bfalcons\b/i, /\bsaints\b/i, /\bpanthers\b/i, /\brams\b/i, /\bseahawks\b/i, /\bcardinals\b(?!.*(baseball|soccer))/i, /\bcommanders\b/i,    /\bgiants nfl\b/i, /\bgrey cup\b/i, /\busfl\b/i, /\bncaa fcs\b/i, /\barena football\b/i, /\beuropean league of football\b/i]
  },
  rugby: {
    strongExclusive: [/\bsix nations\b/i, /\ball blacks\b/i, /\bspringboks\b/i, /\bwallabies\b/i, /\btop 14 rugby\b/i, /\bsuper rugby pacific\b/i, /\bpremiership rugby\b/i, /\burc rugby\b/i, /\bpro14\b/i, /\brugby world cup\b/i, /\brugby league\b/i, /\brugby union\b/i, /\brugby international\b/i, /\benglish premiership rugby\b/i, /\bstade toulousain\b/i, /\bleinster rugby\b/i, /\bmunster rugby\b/i, /\bexeter chiefs\b/i, /\bsaracens rugby\b/i, /\bbath rugby\b/i, /\bnorthampton saints\b/i, /\bbristol bears\b/i, /\bdhl stormers\b/i, /\bvodacom bulls\b/i, /\bemirates lions\b/i, /\bcell c sharks\b/i, /\bhighlanders rugby\b/i, /\bchiefs rugby\b/i, /\bcrusaders rugby\b/i, /\bblues rugby\b/i, /\brugby\b/i],
    positive: [/\brugby\b/i, /\bsix nations\b/i, /\ball blacks\b/i, /\bspringboks\b/i, /\bwallabies\b/i, /\btop 14\b/i, /\bsuper rugby\b/i, /\bpremiership rugby\b/i, /\burc\b/i, /\bpro14\b/i, /\bworld cup rugby\b/i, /\brugby league\b/i, /\brugby union\b/i, /\brugby international\b/i, /\benglish premiership\b/i, /\bnew zealand\b(?!.*(cricket|soccer|tennis))/i, /\bsouth africa\b(?!.*(cricket|soccer|tennis))/i, /\baustralia\b(?!.*(cricket|soccer|tennis|baseball))/i, /\bireland\b(?!.*(soccer))/i, /\bscotland\b(?!.*(soccer))/i, /\bwales\b(?!.*(soccer))/i, /\bfrance rugby\b/i, /\bengland rugby\b/i, /\bargentina rugby\b/i, /\bfiji\b(?!.*(soccer))/i, /\bsamoa\b(?!.*(soccer))/i, /\btonga\b(?!.*(soccer))/i, /\bjapan rugby\b/i, /\bstade toulousain\b/i, /\bleinster\b/i, /\bmunster\b/i, /\bexeter chiefs\b/i, /\bsaracens\b/i, /\bbath rugby\b/i, /\bnorthampton\b/i, /\bbristol rugby\b/i, /\bstormers\b/i, /\bbulls rugby\b/i, /\blions rugby\b/i, /\bsharks rugby\b/i, /\bhighlanders\b/i, /\bchiefs rugby\b/i, /\bcrusaders\b/i,    /\bblues rugby\b/i, /\bpro d2\b/i, /\bsuper rugby americas\b/i, /\bchallenge cup\b/i, /\bstate of origin\b/i, /\bsuper league rugby\b/i, /\bjapan league one\b/i, /\bmajor league rugby\b/i, /\bcurrie cup\b/i]
  },
  cricket: {
    strongExclusive: [/\bcricket\b/i, /\bipl\b/i, /\bbig bash league\b/i, /\bthe hundred\b/i, /\btest match\b/i, /\bodi cricket\b/i, /\bt20 international\b/i, /\bpsl cricket\b/i, /\bbbl\b/i, /\bbcci\b/i, /\bicc cricket\b/i, /\bsuper league cricket\b/i, /\bmumbai indians\b/i, /\bchennai super kings\b/i, /\broyal challengers\b/i, /\bsunrisers hyderabad\b/i, /\bkolkata knight riders\b/i, /\bdelhi capitals\b/i, /\brajasthan royals\b/i, /\bpunjab kings\b/i, /\bwicket\b/i, /\binning\b/i, /\bt20 world cup\b/i, /\bcricket world cup\b/i, /\btest cricket\b/i, /\bbowler\b/i, /\bbatsman\b/i, /\bwicketkeeper\b/i],
    positive: [/\bcricket\b/i, /\bipl\b/i, /\bbig bash\b/i, /\bhundred\b(?!.*(over under o u total goals points games sets rounds))/i, /\btest match\b/i, /\btest cricket\b/i, /\bodi\b/i, /\bt20 international\b/i, /\bpsl\b/i, /\bbbl\b/i, /\bcricketer\b/i, /\bbcci\b/i, /\bicc\b/i, /\bwicket\b/i, /\binning\b/i, /\bsuper league cricket\b/i, /\bmumbai indians\b/i, /\bchennai super kings\b/i, /\broyal challengers\b/i, /\bsunrisers\b/i, /\bkolkata knight\b/i, /\bdelhi capitals\b/i, /\brajasthan royals\b/i, /\bpunjab kings\b/i, /\bmajor league cricket\b/i, /\bglobal t20\b/i, /\bsuper smash\b/i, /\bcounty championship\b/i, /\bone day cup\b/i, /\bsheffield shield\b/i, /\branji trophy\b/i, /\bsyed mushtaq\b/i, /\bcpl\b/i, /\blpl\b/i, /\bbpl\b/i, /\bsa20\b/i, /\bilt20\b/i, /\bnepal premier\b/i]
  },
  mma: {
    strongExclusive: [/\bufc\b/i, /\bbellator mma\b/i, /\bpfl mma\b/i, /\bone championship mma\b/i, /\bmixed martial arts\b/i, /\bislam makhachev\b/i, /\bilia topuria\b/i, /\brose namajunas\b/i, /\balex pereira\b/i, /\bisrael adesanya\b/i, /\bjon jones\b/i, /\bfrancis ngannou\b/i, /\bdustin poirier\b/i, /\bjustin gaethje\b/i, /\balexander volkanovski\b/i, /\bmax holloway\b/i, /\bsean strickland\b/i, /\bdricus du plessis\b/i, /\btom aspinall\b/i, /\bjan blachowicz\b/i, /\bglover teixeira\b/i, /\bjiri prochazka\b/i, /\bmagomed ankalaev\b/i, /\bkhamzat chimaev\b/i, /\bcolby covington\b/i, /\bleon edwards\b/i, /\bkamaru usman\b/i, /\bchampionship fight\b/i, /\bufc fight night\b/i, /\bppv mma\b/i, /\bmma\b/i],
    positive: [/\bufc\b/i, /\bbellator\b/i, /\bpfl\b/i, /\bone championship\b/i, /\bmma\b/i, /\bmixed martial arts\b/i, /\bmakhachev\b/i, /\btopuria\b/i, /\bnamajunas\b/i, /\bpereira\b/i, /\badesanya\b/i, /\bjones\b(?!.*(american football nfl))/i, /\bngannou\b/i, /\bpoirier\b/i, /\bgaethje\b/i, /\bvolkanovski\b/i, /\bholloway\b/i, /\bstrickland\b/i, /\bdu plessis\b/i, /\baspinall\b/i, /\bblachowicz\b/i, /\bteixeira\b/i, /\bprochazka\b/i, /\bprocházka\b/i, /\bankalaev\b/i, /\bchimaev\b/i, /\bcovington\b/i, /\bedwards\b/i, /\busman\b/i, /\bchampionship fight\b/i,    /\bfight night\b/i, /\bcage warriors\b/i, /\bksw\b/i, /\brizin\b/i, /\bbrave cf\b/i, /\baca\b/i, /\blfa\b/i]
  },
  volleyball: {
    strongExclusive: [/\bvnl\b/i, /\bfivb\b/i, /\bcev champions league volleyball\b/i, /\bvolleyball nations league\b/i, /\bvolleyball world championship\b/i, /\bsuperlega volleyball\b/i, /\bsuperleague volleyball\b/i, /\bbrazil superliga volleyball\b/i, /\bitaly serie a1 volleyball\b/i, /\brussian superleague volleyball\b/i, /\bturkish volleyball\b/i, /\bvolleyball\b/i],
    positive: [/\bvolleyball\b/i, /\bvnl\b/i, /\bfivb\b/i, /\bsuperlega\b/i, /\bsuperleague volleyball\b/i, /\bcev champions league\b/i, /\bbrazil superliga\b/i, /\bvolleyball nations league\b/i, /\bworld championship volleyball\b/i,    /\bitaly serie a1 volleyball\b/i, /\brussian superleague\b/i, /\bturkish volleyball\b/i, /\bsultanlar ligi\b/i, /\bcev cup\b/i, /\bcev challenge cup\b/i, /\bserie a2 volleyball\b/i, /\bchinese volleyball\b/i, /\bkorean v-league\b/i, /\bargentine volleyball\b/i]
  }
};

const SERVER_SPORT_LEAGUES: Record<string, string[]> = {
  football: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Eredivisie', 'FA Cup', 'Europa League', 'Europa', 'Conference League', 'Championship', 'League One', 'League Two', 'EFL Cup', 'Serie B', 'Segunda Division', 'Segunda', 'Bundesliga 2', 'Ligue 2', 'Primeira Liga', 'Super Lig', 'Liga MX', 'MLS', 'Scottish Premiership', 'Copa Libertadores', 'Copa America', 'World Cup', 'Nations League', 'NPFL', 'Ekstraklasa', 'Czech First League', 'Croatian First League', 'Serbian SuperLiga', 'Romanian Liga 1', 'Hungarian NB I', 'Bulgarian First League', 'Slovak Super Liga', 'Slovenian Prva Liga', 'Veikkausliiga', 'Besta deild', 'Cyprus First Division', 'Israeli Premier League', 'Russian Premier League', 'Ukrainian Premier League', 'Kazakhstan Premier League', 'Chinese Super League', 'J1 League', 'J2 League', 'K League', 'A-League', 'Indian Super League', 'Saudi Pro League', 'UAE Pro League', 'Qatar Stars League', 'Egyptian Premier League', 'Botola', 'Tunisian Ligue', 'Algerian Ligue 1', 'Nigerian Premier League', 'Ghana Premier League', 'South African Premiership', 'USL Championship', 'Liga de Expansion', 'Brazil Serie B', 'Primera Nacional', 'Peru Liga 1', 'Paraguay Primera', 'Uruguay Primera', 'Ecuador Liga Pro', 'Bolivia Primera', 'Colombia Primera', 'Irish Premier Division', 'NIFL Premiership', 'Welsh Premier League', 'Latvian Virsliga', 'Lithuanian A Lyga', 'Estonian Meistriliiga', 'Belarusian Premier League', 'Moldovan Super Liga', 'Georgian Erovnuli Liga', 'Armenian Premier League', 'Azerbaijan Premier League', 'Kosovo Superleague', 'Maltese Premier League', 'Gibraltar', 'Luxembourg National Division', 'Albanian Superliga', 'Bosnian Premier League', 'North Macedonia', 'Montenegro First League', 'Kenya Premier League', 'Uganda Premier League', 'Tanzania', 'Zambia Super League', 'Angola Girabola', 'Ethiopian Premier League', 'Ivory Coast', 'DR Congo', 'Cameroon Elite One', 'Senegal Ligue 1', 'Iraqi Premier League', 'Jordan Pro League', 'Kuwait Premier League', 'Oman Pro League', 'Bahrain', 'Hong Kong Premier League', 'Singapore Premier League', 'Malaysia Super League', 'Indonesia Liga 1', 'Philippines Football League', 'Mongolia', 'Uzbekistan Super League', 'Kyrgyzstan', 'Myanmar National League', 'Papua New Guinea', 'Fiji'],
  basketball: ['NBA', 'EuroLeague', 'ACB', 'Liga ACB', 'LNB Pro A', 'LNB Pro B', 'LNB', 'WNBA', 'NCAAB', 'CBA', 'PBA', 'FIBA', 'Basketball Champions League', 'EuroCup', 'ABA Liga', 'Ligat Haal', 'BSL', 'Greek Basket League', 'A1 Ethniki', 'VTB', 'NBL', 'KBL', 'B.League', 'G League', 'Liga Endesa', 'LBA', 'Lega Basket', 'BNXT', 'BBL', 'Superliga Argentina', 'NBB', 'LNBP', 'LPB', 'BSN', 'Korisliiga', 'Basketligan', 'Liga Unike', 'FIBA Europe Cup', 'NBL Canada', 'TBL', 'Turkish Basketball', 'NCAA'],
  tennis: ['ATP', 'WTA', 'Grand Slam', 'Masters 1000', 'ATP Tour', 'WTA Tour', 'Wimbledon', 'Australian Open', 'French Open', 'Roland Garros', 'US Open', 'ATP 250', 'ATP 500', 'WTA 125', 'Davis Cup', 'Billie Jean King Cup', 'United Cup', 'Laver Cup', 'Next Gen Finals', 'ATP Finals', 'WTA Finals'],
  rally: ['ITTF', 'WTT', 'World Table Tennis', 'Table Tennis', 'TT Cup', 'WTT Series', 'WTT Champions', 'WTT Contender', 'WTT Star Contender', 'Europe Top 16', 'ITTF World Tour'],
  hockey: ['NHL', 'KHL', 'SHL', 'Liiga', 'AHL', 'DEL', 'Extraliga', 'Swiss National League', 'Czech Extraliga', 'Slovak Extraliga', 'ICEHL', 'Alps Hockey League', 'ECHL', 'SPHL', 'Mestis', 'Hockeyettan', 'Champions Hockey League', 'VHL', 'HockeyAllsvenskan', 'GET Ligaen', 'Metal Ligaen', 'Ligue Magnus', 'DEL2', 'NCAA Hockey', 'OHL', 'QMJHL', 'WHL', 'Belarusian Extraliga', 'Kazakhstan Hockey'],
  baseball: ['MLB', 'NPB', 'KBO', 'MiLB', 'World Baseball Classic', 'CPBL', 'LIDOM', 'LBPRC', 'LVBP', 'LMB', 'Serie del Caribe', 'Caribbean Series', 'ABL', 'Australian Baseball League', 'Premier12', 'Atlantic League', 'Frontier League', 'NCAA Baseball', 'Cuban National Series'],
  americanfootball: ['NFL', 'NCAAF', 'CFL', 'XFL', 'Super Bowl', 'Grey Cup', 'USFL', 'NCAA FCS', 'Arena Football', 'European League of Football'],
  rugby: ['Six Nations', 'Rugby Championship', 'Premiership Rugby', 'Top 14', 'Super Rugby', 'Super Rugby Pacific', 'World Cup Rugby', 'URC', 'Pro14', 'Rugby World Cup', 'Champions Cup', 'Japan League One', 'Major League Rugby', 'Currie Cup', 'NPC', 'NRL', 'Pro D2', 'Super Rugby Americas', 'Challenge Cup', 'State of Origin', 'Super League Rugby'],
  cricket: ['Test', 'ODI', 'T20', 'IPL', 'Big Bash League', 'Big Bash', 'The Hundred', 'World Cup Cricket', 'Cricket World Cup', 'Super League', 'PSL', 'BBL', 'BCCI', 'ICC', 'T20 World Cup', 'Caribbean Premier League', 'Lanka Premier League', 'Bangladesh Premier League', 'Nepal Premier League', 'SA20', 'ILT20', 'Major League Cricket', 'MLC', 'Super Smash', 'County Championship', 'One Day Cup', 'Sheffield Shield', 'Ranji Trophy'],
  mma: ['UFC', 'Bellator', 'PFL', 'ONE Championship', 'ONE', 'MMA', 'Cage Warriors', 'KSW', 'Rizin', 'Brave CF', 'ACA', 'LFA', 'Fight Night', 'UFC Fight Night'],
  volleyball: ['FIVB', 'VNL', 'CEV', 'CEV Champions League', 'SuperLega', 'Superleague', 'Volleyball Nations League', 'Volleyball World Championship', 'Serie A1', 'Serie A2', 'Turkish League', 'Sultanlar Ligi', 'Russian Superleague', 'Polish PlusLiga', 'CEV Cup', 'CEV Challenge Cup', 'NCAA Volleyball', 'Brazilian Superliga', 'Korean V-League', 'Chinese Volleyball League', 'Ligue A', 'Volleyball Bundesliga', 'Efeler Ligi']
};

const SERVER_LEAGUE_NORMALIZE: Record<string, string> = {
  'serie a tim': 'Serie A', 'laliga': 'La Liga', 'la liga santander': 'La Liga',
  'premier': 'Premier League', 'epl': 'Premier League', 'english premier league': 'Premier League',
  'bundesliga 1': 'Bundesliga', '1. bundesliga': 'Bundesliga', 'ligue 1 uber eats': 'Ligue 1',
  'champs': 'Champions League', 'ucl': 'Champions League',
  'uel': 'Europa League', 'europa': 'Europa League',
  'conference': 'Conference League', 'uecl': 'Conference League',
  'mls major league soccer': 'MLS', 'major league soccer': 'MLS',
  'nba regular season': 'NBA', 'nba playoffs': 'NBA',
  'euroleague basketball': 'EuroLeague', 'turkish airlines euroleague': 'EuroLeague'
};

export function serverCanonicalizeLeague(rawLeague: string, sportId?: string): string {
  const raw = String(rawLeague || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (SERVER_LEAGUE_NORMALIZE[key]) return SERVER_LEAGUE_NORMALIZE[key];
  if (sportId && SERVER_SPORT_LEAGUES[sportId]) {
    const pool = SERVER_SPORT_LEAGUES[sportId];
    const match = pool.find((canon) => key.includes(canon.toLowerCase()) || canon.toLowerCase().includes(key));
    if (match) return match;
  }
  return raw;
}

export function serverLeagueBelongsToSport(league: string, sportId: string): boolean {
  const normalized = serverCanonicalizeLeague(league, sportId).toLowerCase();
  if (!normalized) return true;
  const pool = SERVER_SPORT_LEAGUES[sportId] || [];
  if (pool.length === 0) return true;
  const match = pool.some((canon) => {
    const cl = canon.toLowerCase();
    return normalized.includes(cl) || cl.includes(normalized);
  });
  if (match) return true;
  const others = Object.keys(SERVER_SPORT_LEAGUES).filter((s) => s !== sportId);
  for (const other of others) {
    const otherPool = SERVER_SPORT_LEAGUES[other] || [];
    const clash = otherPool.some((canon) => {
      const cl = canon.toLowerCase();
      if (cl.length < 4) return false;
      return normalized.includes(cl);
    });
    if (clash) return false;
  }
  return true;
}

/**
 * Returns true when a match genuinely belongs to `sportId`.
 * Uses THREE gates, evaluated in this priority order:
 *  1. TYPED-API BYPASS: the match arrived via a typed API source that already
 *     performed sport filtering upstream — trust it (no keyword check).
 *  2. STRONG POSITIVE MATCH: the league/team text matches a STRONG EXCLUSIVE
 *     keyword for this sport (word-bounded, disambiguated). If yes, accept
 *     WITHOUT running the cross-sport negative gate — this avoids false
 *     negatives on generic substrings (e.g. "over" in cricket ≠ football O/U).
 *  3. BALANCED CHECK: (a) POSITIVE — at least one POSITIVE keyword of this
 *     sport matches (word-bounded). (b) NEGATIVE — NO other sport's STRONG
 *     EXCLUSIVE keyword matches. A non-zero "other sport" score does NOT
 *     reject when the own positive count is already ≥ 1 — both scores are
 *     compared instead of blindly rejecting on the first foreign hit.
 */
export function matchBelongsToSport(
  m: { league?: string; homeTeam?: string; awayTeam?: string; source?: string },
  sportId: string,
  opts?: { trustTypedApi?: boolean }
): boolean {
  const text = `${m.league || ''} ${m.homeTeam || ''} ${m.awayTeam || ''}`.toLowerCase();
  const kw = SPORT_KEYWORDS[sportId];
  if (!kw) return false;
  // Typed APIs (OddsPapi/SharpAPI/…) already filter by sport upstream, so their
  // rows are trusted WITHOUT keyword checks. This MUST be disabled when
  // re-classifying cached rows across sports (the migrate/purge flows) —
  // otherwise every LiveAPI tennis/hockey/baseball row "is a football match"
  // and gets dragged into the football tab.
  const fromTypedApi = /^(LiveAPI|TheSportsDB|BallDontLie|SportsData|OddsPapi|SharpAPI)/i.test(m.source ?? '');

  if (fromTypedApi && opts?.trustTypedApi !== false) return true;

  const matchesAny = (patterns: RegExp[]): boolean => patterns.some((re) => re.test(text));

  if (matchesAny(kw.strongExclusive)) return true;

  const ownPositive = matchesAny(kw.positive);
  if (!ownPositive) return false;

  for (const [sid, otherKw] of Object.entries(SPORT_KEYWORDS)) {
    if (sid === sportId) continue;
    if (matchesAny(otherKw.strongExclusive)) return false;
  }
  return true;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  score: number;
  normalizedHome: string;
  normalizedAway: string;
  normalizedLeague: string;
  fixtureFormat: 'team_vs_team' | 'player_vs_player' | 'unknown';
}

const CANONICAL_TEAM_MAP: Record<string, string> = {
  'man utd': 'Manchester United', 'man united': 'Manchester United', 'man utd.': 'Manchester United',
  'man city': 'Manchester City', 'man. city': 'Manchester City',
  'tottenham': 'Tottenham Hotspur', 'spurs': 'Tottenham Hotspur',
  'liverpool': 'Liverpool FC', 'arsenal': 'Arsenal FC', 'chelsea': 'Chelsea FC',
  'newcastle': 'Newcastle United', 'newcastle utd': 'Newcastle United',
  'aston villa': 'Aston Villa', 'brighton': 'Brighton & Hove Albion',
  'west ham': 'West Ham United', 'crystal palace': 'Crystal Palace FC',
  'leicester': 'Leicester City', 'leeds': 'Leeds United',
  'nottingham': 'Nottingham Forest', 'notts forest': 'Nottingham Forest',
  'wolves': 'Wolverhampton Wanderers', 'brentford': 'Brentford FC',
  'fulham': 'Fulham FC', 'everton': 'Everton FC',
  'real madrid': 'Real Madrid CF', 'barca': 'FC Barcelona', 'barcelona': 'FC Barcelona',
  'atletico': 'Atlético Madrid', 'atletico madrid': 'Atlético Madrid',
  'sevilla': 'Sevilla FC', 'villarreal': 'Villarreal CF', 'valencia': 'Valencia CF',
  'bayern': 'Bayern München', 'bayern munich': 'Bayern München', 'fcb': 'Bayern München',
  'dortmund': 'Borussia Dortmund', 'bvb': 'Borussia Dortmund',
  'leipzig': 'RB Leipzig', 'leverkusen': 'Bayer Leverkusen',
  'frankfurt': 'Eintracht Frankfurt', 'wolfsburg': 'VfL Wolfsburg',
  'juventus': 'Juventus FC', 'juve': 'Juventus FC', 'inter': 'FC Internazionale',
  'inter milan': 'FC Internazionale', 'ac milan': 'AC Milan', 'milan': 'AC Milan',
  'napoli': 'SSC Napoli', 'roma': 'AS Roma', 'lazio': 'SS Lazio',
  'atalanta': 'Atalanta BC', 'fiorentina': 'ACF Fiorentina', 'bologna': 'Bologna FC',
  'psg': 'Paris Saint-Germain', 'paris sg': 'Paris Saint-Germain',
  'paris saint germain': 'Paris Saint-Germain', 'monaco': 'AS Monaco',
  'marseille': 'Olympique de Marseille', 'lyon': 'Olympique Lyonnais',
  'lille': 'LOSC Lille', 'rennes': 'Stade Rennais FC',
  'benfica': 'SL Benfica', 'porto': 'FC Porto', 'sporting': 'Sporting CP',
  'sporting cp': 'Sporting CP',
  'ajax': 'AFC Ajax', 'feyenoord': 'Feyenoord Rotterdam', 'psv': 'PSV Eindhoven',
  'psv eindhoven': 'PSV Eindhoven',
  'celtic': 'Celtic FC', 'rangers': 'Rangers FC',
  'lakers': 'Los Angeles Lakers', 'la lakers': 'Los Angeles Lakers',
  'celtics': 'Boston Celtics', 'boston celtics': 'Boston Celtics',
  'warriors': 'Golden State Warriors', 'gs warriors': 'Golden State Warriors',
  'bulls': 'Chicago Bulls', 'heat': 'Miami Heat',
  'knicks': 'New York Knicks', 'nets': 'Brooklyn Nets',
  '76ers': 'Philadelphia 76ers', 'sixers': 'Philadelphia 76ers',
  'clippers': 'LA Clippers', 'la clippers': 'Los Angeles Clippers',
  'suns': 'Phoenix Suns', 'mavericks': 'Dallas Mavericks', 'mavs': 'Dallas Mavericks',
  'nuggets': 'Denver Nuggets', 'raptors': 'Toronto Raptors',
  'hawks': 'Atlanta Hawks', 'pacers': 'Indiana Pacers',
  'hornets': 'Charlotte Hornets', 'wizards': 'Washington Wizards',
  'pistons': 'Detroit Pistons', 'cavaliers': 'Cleveland Cavaliers', 'cavs': 'Cleveland Cavaliers',
  'thunder': 'Oklahoma City Thunder', 'okc thunder': 'Oklahoma City Thunder',
  'blazers': 'Portland Trail Blazers', 'trail blazers': 'Portland Trail Blazers',
  'grizzlies': 'Memphis Grizzlies', 'pelicans': 'New Orleans Pelicans',
  'sa spurs': 'San Antonio Spurs', 'rockets': 'Houston Rockets',
  'jazz': 'Utah Jazz', 'timberwolves': 'Minnesota Timberwolves', 'twolves': 'Minnesota Timberwolves',
  'kings': 'Sacramento Kings', 'magic': 'Orlando Magic',
  'yankees': 'New York Yankees', 'ny yankees': 'New York Yankees',
  'red sox': 'Boston Red Sox', 'boston red sox': 'Boston Red Sox',
  'dodgers': 'Los Angeles Dodgers', 'la dodgers': 'Los Angeles Dodgers',
  'giants': 'San Francisco Giants', 'sf giants': 'San Francisco Giants',
  'cubs': 'Chicago Cubs', 'white sox': 'Chicago White Sox',
  'mets': 'New York Mets', 'ny mets': 'New York Mets',
  'astros': 'Houston Astros', 'blue jays': 'Toronto Blue Jays',
  'rays': 'Tampa Bay Rays', 'athletics': 'Oakland Athletics', 'a\u2019s': 'Oakland Athletics',
  'mariners': 'Seattle Mariners', 'angels': 'Los Angeles Angels',
  'tx rangers': 'Texas Rangers',
  'phillies': 'Philadelphia Phillies', 'braves': 'Atlanta Braves',
  'marlins': 'Miami Marlins', 'nationals': 'Washington Nationals',
  'cardinals': 'St. Louis Cardinals', 'brewers': 'Milwaukee Brewers',
  'reds': 'Cincinnati Reds', 'pirates': 'Pittsburgh Pirates',
  'padres': 'San Diego Padres', 'rockies': 'Colorado Rockies',
  'diamondbacks': 'Arizona Diamondbacks', 'd-backs': 'Arizona Diamondbacks',
  'tigers': 'Detroit Tigers', 'royals': 'Kansas City Royals',
  'twins': 'Minnesota Twins', 'guardians': 'Cleveland Guardians',
  'orioles': 'Baltimore Orioles',
  'bruins': 'Boston Bruins', 'canadiens': 'Montréal Canadiens', 'habs': 'Montréal Canadiens',
  'maple leafs': 'Toronto Maple Leafs', 'leafs': 'Toronto Maple Leafs',
  'rangers hockey': 'New York Rangers', 'ny rangers': 'New York Rangers',
  'oilers': 'Edmonton Oilers', 'flames': 'Calgary Flames',
  'canucks': 'Vancouver Canucks', 'senators': 'Ottawa Senators',
  'jets': 'Winnipeg Jets', 'avalanche': 'Colorado Avalanche',
  'blues': 'St. Louis Blues', 'wild': 'Minnesota Wild',
  'predators': 'Nashville Predators', 'preds': 'Nashville Predators',
  'stars': 'Dallas Stars', 'blackhawks': 'Chicago Blackhawks',
  'red wings': 'Detroit Red Wings', 'penguins': 'Pittsburgh Penguins',
  'flyers': 'Philadelphia Flyers', 'devils': 'New Jersey Devils',
  'islanders': 'New York Islanders', 'sabres': 'Buffalo Sabres',
  'capitals': 'Washington Capitals', 'caps': 'Washington Capitals',
  'hurricanes': 'Carolina Hurricanes', 'canes': 'Carolina Hurricanes',
  'panthers': 'Florida Panthers', 'lightning': 'Tampa Bay Lightning',
  'coyotes': 'Arizona Coyotes', 'sharks': 'San Jose Sharks',
  'ducks': 'Anaheim Ducks', 'kings hockey': 'Los Angeles Kings',
  'kraken': 'Seattle Kraken', 'golden knights': 'Vegas Golden Knights',
  'chiefs': 'Kansas City Chiefs', 'kc chiefs': 'Kansas City Chiefs',
  'eagles': 'Philadelphia Eagles', 'cowboys': 'Dallas Cowboys', 'dal cowboys': 'Dallas Cowboys',
  '49ers': 'San Francisco 49ers', 'sf 49ers': 'San Francisco 49ers',
  'ravens': 'Baltimore Ravens', 'bills': 'Buffalo Bills',
  'bengals': 'Cincinnati Bengals', 'steelers': 'Pittsburgh Steelers',
  'browns': 'Cleveland Browns', 'ny jets': 'New York Jets',
  'patriots': 'New England Patriots', 'ne patriots': 'New England Patriots',
  'dolphins': 'Miami Dolphins', 'texans': 'Houston Texans',
  'jaguars': 'Jacksonville Jaguars', 'colts': 'Indianapolis Colts',
  'titans': 'Tennessee Titans', 'raiders': 'Las Vegas Raiders',
  'chargers': 'Los Angeles Chargers', 'broncos': 'Denver Broncos',
  'packers': 'Green Bay Packers', 'vikings': 'Minnesota Vikings',
  'bears': 'Chicago Bears', 'lions nfl': 'Detroit Lions',
  'buccaneers': 'Tampa Bay Buccaneers', 'bucs': 'Tampa Bay Buccaneers',
  'falcons': 'Atlanta Falcons', 'saints': 'New Orleans Saints',
  'panthers nfl': 'Carolina Panthers', 'rams': 'Los Angeles Rams',
  'seahawks': 'Seattle Seahawks', 'cardinals nfl': 'Arizona Cardinals',
  'commanders': 'Washington Commanders', 'giants nfl': 'New York Giants'
};

const INDIVIDUAL_SPORTS = new Set(['tennis', 'mma', 'rally']);
const TEAM_SPORTS = new Set([
  'football', 'basketball', 'hockey', 'baseball', 'americanfootball',
  'rugby', 'cricket', 'volleyball'
]);

export function normalizeName(raw: string): string {
  let n = String(raw || '').trim();
  const key = n.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (CANONICAL_TEAM_MAP[key]) return CANONICAL_TEAM_MAP[key];
  n = n.replace(/\s+FC$/i, '').replace(/^FC\s+/i, '').replace(/\s+CF$/i, '').replace(/\s+SC$/i, '').replace(/\s+AC$/i, '').replace(/\s+SS$/i, '').replace(/\s+AS$/i, '').replace(/\s+RB$/i, '').replace(/\s+VfL$/i, '').replace(/\s+SV$/i, '');
  return n.trim();
}

/**
 * Runs a multi-point fixture validation (formatting, naming, sport-fit,
 * matchup sanity). Returns a detailed report so the orchestrator can log or
 * discard invalid rows before they reach the cache.
 */
export function validateFixture(
  m: { league?: string; homeTeam?: string; awayTeam?: string; source?: string },
  sportId: string
): ValidationResult {
  const issues: string[] = [];
  let score = 0;

  const homeRaw = String(m.homeTeam || '').trim();
  const awayRaw = String(m.awayTeam || '').trim();
  const leagueRaw = String(m.league || '').trim();

  if (!homeRaw) issues.push('homeTeam empty');
  if (!awayRaw) issues.push('awayTeam empty');
  if (homeRaw && homeRaw === awayRaw) issues.push('homeTeam equals awayTeam');

  const normalizedHome = homeRaw ? normalizeName(homeRaw) : '';
  const normalizedAway = awayRaw ? normalizeName(awayRaw) : '';
  const normalizedLeague = leagueRaw ? serverCanonicalizeLeague(leagueRaw, sportId) : '';

  if (normalizedHome && normalizedHome.length < 2) issues.push('homeTeam too short');
  if (normalizedAway && normalizedAway.length < 2) issues.push('awayTeam too short');
  if (normalizedHome && normalizedHome.length > 50) issues.push('homeTeam too long');
  if (normalizedAway && normalizedAway.length > 50) issues.push('awayTeam too long');

  // Reject odd-shaped names (e.g. "2.10", "10 on NGA") so a team or player
  // is never displayed against a decimal odd instead of a real opponent.
  const homeLooksOdd = /^\d{1,3}(?:\.\d{1,3})?$/.test(homeRaw) || /^\d{1,3}\s+on\s+\S+/i.test(homeRaw);
  const awayLooksOdd = /^\d{1,3}(?:\.\d{1,3})?$/.test(awayRaw) || /^\d{1,3}\s+on\s+\S+/i.test(awayRaw);
  if (homeLooksOdd) issues.push('homeTeam looks like an odds value, not a name');
  if (awayLooksOdd) issues.push('awayTeam looks like an odds value, not a name');
  if (homeLooksOdd || awayLooksOdd) score = Math.max(0, score - 6);

  if (normalizedHome) score += 5;
  if (normalizedAway) score += 5;
  if (normalizedHome !== homeRaw) score += 1;
  if (normalizedAway !== awayRaw) score += 1;

  let fixtureFormat: ValidationResult['fixtureFormat'] = 'unknown';
  if (INDIVIDUAL_SPORTS.has(sportId)) {
    fixtureFormat = 'player_vs_player';
    score += 3;
  } else if (TEAM_SPORTS.has(sportId)) {
    fixtureFormat = 'team_vs_team';
    score += 3;
  }

  if (normalizedLeague) {
    score += 2;
    if (normalizedLeague !== leagueRaw) score += 1;
    if (serverLeagueBelongsToSport(normalizedLeague, sportId)) {
      score += 3;
    } else {
      issues.push(`league "${normalizedLeague}" belongs to another sport category`);
      score = Math.max(0, score - 4);
    }
  } else {
    issues.push('league empty or missing');
  }

  if (matchBelongsToSport({ league: normalizedLeague, homeTeam: normalizedHome, awayTeam: normalizedAway, source: m.source }, sportId)) {
    score += 10;
  } else {
    issues.push('fixture does not fingerprint for this sport');
    score = Math.max(0, score - 5);
  }

  const BAD_PATTERNS = [
    /^(home|away|home team|away team|team a|team b|tbd|tba|to be|unknown|pending)$/i,
    /^(group|pool|stage|round|matchday|game ?week|week ?\d+)$/i,
    /^(prediction|predictions|preview|analysis|result|results|score|live)$/i,
    /^(stats|statistics|odds|bet|bets|market|markets)$/i,
    /^(standings|table|leaderboard|ranking)$/i,
    /^(login|register|sign ?in|sign ?up|my account)$/i,
    /^(bonus|promo|promotion|offer|claim|deposit)$/i
  ];
  const badHome = BAD_PATTERNS.some((re) => re.test(homeRaw));
  const badAway = BAD_PATTERNS.some((re) => re.test(awayRaw));
  if (badHome) { issues.push('homeTeam matches a non-fixture keyword'); score = Math.max(0, score - 4); }
  if (badAway) { issues.push('awayTeam matches a non-fixture keyword'); score = Math.max(0, score - 4); }

  // Hard rejects: a team/player rendered against a decimal odd (the "name vs
  // odd" bug) and empty/duplicate names can never be shown, whatever the score.
  const oddShaped = homeLooksOdd || awayLooksOdd;
  const emptyOrDup = !homeRaw || !awayRaw || homeRaw === awayRaw;
  const tooShort = (normalizedHome && normalizedHome.length < 2) || (normalizedAway && normalizedAway.length < 2);

  return {
    valid: score >= 10 && !oddShaped && !emptyOrDup && !tooShort,
    issues,
    score,
    normalizedHome,
    normalizedAway,
    normalizedLeague,
    fixtureFormat
  };
}

// Backwards-compatible helper. Re-classification of already-cached rows MUST
// NOT trust typed-API sources (a tennis row from LiveAPI is still tennis), so
// the strict keyword gate is used.
export function isFootballMatch(m: { league?: string; homeTeam?: string; awayTeam?: string; source?: string }): boolean {
  return matchBelongsToSport(m, 'football', { trustTypedApi: false });
}

// ── Public queries ────────────────────────────────────────────────────────────

export const getDay = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

export const listMatches = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    const raw = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('asc')
      .collect();

    return raw.filter((m) => {
      if (!matchBelongsToSport(m, args.sportId)) return false;
      if (m.league && !serverLeagueBelongsToSport(m.league, args.sportId)) return false;
      return true;
    });
  }
});

// Range view for the AI Predictor date picker: every cached match for a sport
// whose cache day falls inside [fromDay, toDay]. Matches are stored under their
// dayKey (the day the agent ran for), NOT their kickoff startTime.
export const listMatchesInRange = query({
  args: { sportId, fromDay: v.string(), toDay: v.string() },
  handler: async (ctx, args) => {
    const raw = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).gte('dayKey', args.fromDay).lte('dayKey', args.toDay))
      .order('asc')
      .collect();

    return raw.filter((m) => {
      if (!matchBelongsToSport(m, args.sportId)) return false;
      if (m.league && !serverLeagueBelongsToSport(m.league, args.sportId)) return false;
      return true;
    });
  }
});

// Day-cache status for every day in a window (inclusive dayKey bounds). Lets the
// homepage show which of the 1–7 days actually have cached data/verdicts.
export const listDaysInRange = query({
  args: { sportId, fromDay: v.string(), toDay: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).gte('dayKey', args.fromDay).lte('dayKey', args.toDay))
      .order('asc')
      .collect();
  }
});

export const getVerdict = query({
  args: { dayKey: v.string(), matchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorVerdicts')
      .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', args.matchId))
      .first();
  }
});

export const getDailyPnlSummary = query({
  args: { dayKey: v.string(), filter: v.optional(v.union(v.literal('ALL'), v.literal('MONEYLINE'), v.literal('SPREAD'), v.literal('TOTAL'))) },
  handler: async (ctx, args) => {
    const filter = args.filter ?? 'ALL';
    return await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day_filter', (q) => q.eq('dayKey', args.dayKey).eq('filter', filter))
      .first();
  }
});

export const saveDailyPnlSummary = mutation({
  args: {
    dayKey: v.string(),
    filter: v.union(v.literal('ALL'), v.literal('MONEYLINE'), v.literal('SPREAD'), v.literal('TOTAL')),
    overallWinRatePct: v.number(),
    overallUnitsPnl: v.number(),
    overallRoiPct: v.number(),
    rows: v.any()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day_filter', (q) => q.eq('dayKey', args.dayKey).eq('filter', args.filter))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        overallWinRatePct: args.overallWinRatePct,
        overallUnitsPnl: args.overallUnitsPnl,
        overallRoiPct: args.overallRoiPct,
        rows: args.rows,
        updatedAt: now
      });
      return existing._id;
    } else {
      return await ctx.db.insert('aiPredictorStats', {
        dayKey: args.dayKey,
        filter: args.filter,
        overallWinRatePct: args.overallWinRatePct,
        overallUnitsPnl: args.overallUnitsPnl,
        overallRoiPct: args.overallRoiPct,
        rows: args.rows,
        updatedAt: now
      });
    }
  }
});

export const updateMatchResult = mutation({
  args: {
    matchId: v.string(),
    dayKey: v.string(),
    finalScore: v.string(),
    status: v.optional(
      v.union(v.literal('upcoming'), v.literal('inplay'), v.literal('finished'))
    )
  },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query('predictorMatches')
      .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', args.matchId))
      .first();
    if (!match) {
      throw new Error(`Match not found: ${args.dayKey}/${args.matchId}`);
    }
    await ctx.db.patch(match._id, {
      finalScore: args.finalScore,
      status: args.status ?? 'finished',
      oddsSnapshot: {
        ...(match.oddsSnapshot ?? {}),
        finalScore: args.finalScore
      }
    });
    return { dayKey: args.dayKey, matchId: args.matchId, finalScore: args.finalScore, status: args.status ?? 'finished' };
  }
});

export const getActiveRun = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorRuns')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

// ── Public mutation: user-triggered refresh ───────────────────────────────────

export const startRefresh = mutation({
  args: { sportId, dayKey: v.string(), incremental: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incremental = args.incremental ?? false;
    const runId = `run_${incremental ? 'inc_' : ''}${args.sportId}_${args.dayKey}_${now}`;

    const existing = await ctx.db
      .query('predictorRuns')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();

    if (existing && existing.status === 'running') return { runId: existing.runId, alreadyRunning: true };

    await ctx.db.insert('predictorRuns', {
      runId,
      dayKey: args.dayKey,
      sportId: args.sportId,
      progress: 0,
      stage: 'Queued',
      status: 'running',
      startedAt: now,
      updatedAt: now
    });

    await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first()
      .then(async (day) => {
        if (day) {
          await ctx.db.patch(day._id, { status: 'refreshing', runId, updatedAt: now });
        } else {
          await ctx.db.insert('predictorDays', {
            dayKey: args.dayKey,
            sportId: args.sportId,
            status: 'refreshing',
            expiresAt: now + 24 * 60 * 60 * 1000,
            runId,
            cap: 1200,
            sourcesUsed: [],
            createdAt: now,
            updatedAt: now
          });
        }
      });

    // Fire-and-forget: kick off the orchestrator without blocking the mutation.
    // If scheduling fails (e.g. the internal action is missing/not deployed),
    // degrade the run/day to 'error' gracefully instead of 500-ing the mutation.
    try {
      if (incremental) {
        await ctx.scheduler.runAfter(0, internal.predictorOrchestrator.runIncrementalRefreshInternal, {
          sportId: args.sportId,
          dayKey: args.dayKey,
          runId
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.predictorOrchestrator.runRefreshInternal, {
          sportId: args.sportId,
          dayKey: args.dayKey,
          runId
        });
      }
    } catch (err: any) {
      console.error('[predictor] failed to schedule refresh:', err?.message || err);
      await ctx.db
        .query('predictorRuns')
        .withIndex('by_runId', (q) => q.eq('runId', runId))
        .first()
        .then(async (run) => {
          if (run) {
            await ctx.db.patch(run._id, {
              status: 'error',
              stage: 'Failed',
              message: String(err?.message || err).slice(0, 300),
              completedAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        });
      await ctx.db
        .query('predictorDays')
        .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
        .order('desc')
        .first()
        .then(async (day) => {
          if (day) {
            await ctx.db.patch(day._id, { status: 'error', message: String(err?.message || err).slice(0, 300), updatedAt: Date.now() });
          }
        });
    }

    return { runId, alreadyRunning: false };
  }
});

// ── Internal mutations (orchestrator-only) ────────────────────────────────────

export const updateRun = internalMutation({
  args: {
    runId: v.string(),
    progress: v.number(),
    stage: v.string(),
    status: v.optional(runStatus),
    message: v.optional(v.string()),
    completedAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('predictorRuns')
      .withIndex('by_runId', (q) => q.eq('runId', args.runId))
      .first();
    if (!run) return;
    await ctx.db.patch(run._id, {
      progress: Math.max(0, Math.min(100, Math.round(args.progress))),
      stage: args.stage,
      status: args.status ?? run.status,
      message: args.message ?? run.message,
      completedAt: args.completedAt ?? run.completedAt,
      updatedAt: Date.now()
    });
  }
});

export const upsertDay = internalMutation({
  args: {
    sportId,
    dayKey: v.string(),
    status: dayStatus,
    runId: v.optional(v.string()),
    cap: v.optional(v.number()),
    sourcesUsed: v.optional(v.array(v.string())),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        runId: args.runId ?? existing.runId,
        cap: args.cap ?? existing.cap,
        sourcesUsed: args.sourcesUsed ?? existing.sourcesUsed,
        message: args.message,
        lastRefreshAt: args.status === 'ready' || args.status === 'partial' ? now : existing.lastRefreshAt,
        updatedAt: now
      });
      return existing._id;
    }
    return await ctx.db.insert('predictorDays', {
      dayKey: args.dayKey,
      sportId: args.sportId,
      status: args.status,
      runId: args.runId,
      cap: args.cap ?? 1200,
      sourcesUsed: args.sourcesUsed ?? [],
      message: args.message,
      expiresAt: now + 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const replaceMatches = internalMutation({
  args: {
    sportId,
    dayKey: v.string(),
    matches: v.array(
      v.object({
        matchId: v.string(),
        league: v.string(),
        homeTeam: v.string(),
        awayTeam: v.string(),
        startTime: v.number(),
        source: v.string(),
        marketsAvailable: v.array(v.string()),
        scopes: v.any(),
        dataQuality: v.optional(v.string())
      })
    )
  },
  handler: async (ctx, args) => {
    // Carry live scoreline state across refreshes: replaceMatches wipes and
    // re-inserts the day's rows, so without this every refresh would reset
    // already-finished matches back to 'upcoming' with no final score until
    // the next 5-minute score sync re-fetches them.
    const existing = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .collect();
    const prior = new Map<string, (typeof existing)[number]>();
    for (const m of existing) {
      prior.set(m.matchId, m);
      await ctx.db.delete(m._id);
    }

    const now = Date.now();
    for (const m of args.matches) {
      const old = prior.get(m.matchId);
      await ctx.db.insert('predictorMatches', {
        dayKey: args.dayKey,
        sportId: args.sportId,
        matchId: m.matchId,
        league: m.league,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        startTime: m.startTime,
        source: m.source,
        marketsAvailable: m.marketsAvailable,
        scopes: m.scopes,
        dataQuality: m.dataQuality ?? 'verified',
        status: old?.status ?? 'upcoming',
        finalScore: old?.finalScore,
        oddsSnapshot: old?.oddsSnapshot,
        createdAt: now
      });
    }
    return args.matches.length;
  }
});

export const insertVerdicts = internalMutation({
  args: {
    dayKey: v.string(),
    sportId,
    verdicts: v.array(
      v.object({
        matchId: v.string(),
        agentsRun: v.array(v.string()),
        citations: v.array(v.string()),
        floor: v.number(),
        scopeSummary: v.string(),
        llmUsed: v.optional(v.boolean()),
        llmProvider: v.optional(v.string()),
        aiReport: v.optional(v.any())
      })
    )
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const vv of args.verdicts) {
      const existing = await ctx.db
        .query('predictorVerdicts')
        .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', vv.matchId))
        .first();
      const aiReport =
        vv.aiReport && typeof vv.aiReport === 'object'
          ? vv.aiReport
          : {
              verdictSummary: vv.scopeSummary,
              valueAssessment: '',
              riskWarning: '',
              tacticalRecommendation: '',
              crossCheckAnalysis: '',
              crossCheckSteps: [],
              top3Selections: [],
              punterEdge: '',
              bookmakerBiasNote: '',
              stakeAdvice: ''
            };
      const patch = {
        aiReport,
        llmUsed: vv.llmUsed ?? (vv.aiReport ? true : false),
        llmProvider: vv.llmProvider ?? '',
        updatedAt: now
      };
      if (existing) {
        await ctx.db.patch(existing._id, { ...patch, agentsRun: vv.agentsRun, citations: vv.citations });
      } else {
        await ctx.db.insert('predictorVerdicts', {
          dayKey: args.dayKey,
          sportId: args.sportId,
          matchId: vv.matchId,
          ...patch,
          agentsRun: vv.agentsRun,
          citations: vv.citations
        });
      }
    }
    return args.verdicts.length;
  }
});

export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const oldDays = await ctx.db
      .query('predictorDays')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoff))
      .collect();
    for (const d of oldDays) await ctx.db.delete(d._id);

    const oldMatches = await ctx.db
      .query('predictorMatches')
      .collect()
      .then((items) => items.filter((m) => m.dayKey < cutoff));
    for (const m of oldMatches) await ctx.db.delete(m._id);

    const oldVerdicts = await ctx.db
      .query('predictorVerdicts')
      .collect()
      .then((items) => items.filter((v) => v.dayKey < cutoff));
    for (const v of oldVerdicts) await ctx.db.delete(v._id);

    const oldStats = await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoff))
      .collect();
    for (const s of oldStats) await ctx.db.delete(s._id);

    const oldRuns = await ctx.db
      .query('predictorRuns')
      .collect()
      .then((items) => items.filter((r) => r.dayKey < cutoff));
    for (const r of oldRuns) await ctx.db.delete(r._id);

    return oldDays.length + oldMatches.length + oldVerdicts.length;
  }
});

// Wipe EVERY cached predictor row (matches, verdicts, days, runs, stats) so a
// full re-seed rebuilds from the current scraper/parser code. Used after league
// fallback fixes to purge rows misbranded with a fake league (e.g. every
// unknown football fixture labelled 'Premier League' → "England - Premier
// League" for an Argentina match).
// Drain one predictor table in bounded batches. Invoke once per table so each
// function call stays under Convex's per-function read limit (4096 reads / 16 MB)
// — predictorMatches alone can hold thousands of rows.
export const purgeAllPredictorData = internalMutation({
  args: {
    table: v.union(
      v.literal('predictorMatches'),
      v.literal('predictorVerdicts'),
      v.literal('predictorDays'),
      v.literal('predictorRuns'),
      v.literal('aiPredictorStats')
    ),
    // Verdict rows carry large aiReport blobs — a smaller batch keeps each
    // function call under the 16 MB read limit.
    batchSize: v.optional(v.number()),
    // Optional dayKey scope: only delete rows for one day (verdict blobs are
    // huge, so per-day scoped deletion keeps each call well under the limits).
    dayKey: v.optional(v.string())
  },
  handler: async (ctx, args): Promise<{ table: string; deleted: number }> => {
    const batch = args.batchSize ?? 400;
    let deleted = 0;
    const base = ctx.db.query(args.table as any);
    const indexedDay =
      args.dayKey && (args.table === 'predictorVerdicts' || args.table === 'predictorMatches');
    for (;;) {
      const rows = indexedDay
        ? await base
            .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey as any))
            .take(batch)
        : await base.take(batch);
      if (rows.length === 0) break;
      for (const r of rows) await ctx.db.delete(r._id);
      deleted += rows.length;
    }
    return { table: args.table, deleted };
  }
});

// Internal entry used by the orchestrator's incremental refresh to rebuild
// verdicts from the ALREADY-CACHED matches+scopes (no new API or LLM spend).
export const getCachedMatches = internalQuery({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('asc')
      .collect();
  }
});

// Internal action entry used by the midnight cron (Emeka Obi's cache cycle).
export const purgeAndMarkStale = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const deleted = await ctx.runMutation(internal.predictor.purgeOld, {});
    return { deleted };
  }
});

// ── Bootstrap actions: seed today's cache for all sports when DB is empty ─────

const ALL_SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball', 'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'] as const;
type AnySSport = typeof ALL_SPORTS[number];

// Internal: seed a specific sport for today. Called by seedAllSports.
export const seedSportForToday = internalAction({
  args: { sportId: v.union(
    v.literal('football'), v.literal('basketball'), v.literal('tennis'),
    v.literal('rally'), v.literal('hockey'), v.literal('baseball'),
    v.literal('americanfootball'), v.literal('rugby'), v.literal('cricket'),
    v.literal('mma'), v.literal('volleyball')
  )},
  handler: async (ctx, args): Promise<{ ok: boolean; kept: number }> => {
    const dayKey = watTodayKey();
    // Check if already cached for today — skip if fresh (status ready/partial/refreshing).
    const existing = await ctx.runQuery(internal.predictor.getDayInternal, {
      sportId: args.sportId as AnySSport,
      dayKey
    });
    if (existing && (existing.status === 'ready' || existing.status === 'partial' || existing.status === 'refreshing')) {
      console.log(`[Bootstrap] ${args.sportId} already cached for ${dayKey} (${existing.status}), skipping.`);
      return { ok: true, kept: 0 };
    }
    // Kick the full pipeline via the orchestrator.
    const result: any = await ctx.runAction(internal.predictorOrchestrator.runRefreshInternal, {
      sportId: args.sportId as AnySSport,
      dayKey,
      floor: 52
    });
    return { ok: result?.ok ?? false, kept: result?.kept ?? 0 };
  }
});

// Internal query to check a predictor day without going through public API.
export const getDayInternal = internalQuery({
  args: { sportId: v.union(
    v.literal('football'), v.literal('basketball'), v.literal('tennis'),
    v.literal('rally'), v.literal('hockey'), v.literal('baseball'),
    v.literal('americanfootball'), v.literal('rugby'), v.literal('cricket'),
    v.literal('mma'), v.literal('volleyball')
  ), dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

// Internal: stagger-seed all 11 sports for today with a 15-second gap between each.
export const seedAllSports = internalAction({
  args: {},
  handler: async (ctx): Promise<{ seeded: number }> => {
    const dayKey = new Date().toISOString().slice(0, 10);
    console.log(`[Bootstrap] Seeding all sports for ${dayKey}…`);
    let seeded = 0;
    const sports: AnySSport[] = [...ALL_SPORTS];
    for (const sp of sports) {
      try {
        await ctx.runAction(internal.predictor.seedSportForToday, { sportId: sp });
        seeded++;
        // Stagger: wait 15 seconds between sports so the LLM/API providers
        // are not hammered simultaneously by 6 parallel pipeline runs.
        await new Promise((r) => setTimeout(r, 15_000));
      } catch (err: any) {
        console.error(`[Bootstrap] Failed to seed ${sp}:`, err?.message || err);
      }
    }
    return { seeded };
  }
});

// Public action: UI-callable — bootstraps today's data for all 11 sports.
// Safe to call multiple times; already-fresh days are skipped.
export const bootstrapToday = action({
  args: {},
  handler: async (ctx): Promise<{ seeded: number; message: string }> => {
    const result: any = await ctx.runAction(internal.predictor.seedAllSports, {});
    return {
      seeded: result?.seeded ?? 0,
      message: `Bootstrap started for ${result?.seeded ?? 0} sport(s). Data will populate over the next few minutes.`
    };
  }
});

const NON_FOOTBALL_SPORTS = ['basketball', 'tennis', 'rally', 'hockey', 'baseball', 'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'] as const;

// Mutation to move all football matches stored under any non-football sport into Football ('football').
// Merges non-duplicates into football and deletes duplicates from the non-football sports.
export const migrateNonFootballMatchesToFootball = mutation({
  args: {},
  handler: async (ctx) => {
    let migrated = 0;
    let deleted = 0;
    let totalExamined = 0;

    for (const sp of NON_FOOTBALL_SPORTS) {
      const sportMatches = await ctx.db
        .query('predictorMatches')
        .withIndex('by_sport_day', (q) => q.eq('sportId', sp as any))
        .collect();

      totalExamined += sportMatches.length;

      for (const m of sportMatches) {
        if (isFootballMatch(m)) {
          const existingFootballMatches = await ctx.db
            .query('predictorMatches')
            .withIndex('by_sport_day', (q) => q.eq('sportId', 'football').eq('dayKey', m.dayKey))
            .collect();

          const dup = existingFootballMatches.find(
            (f) => f.matchId === m.matchId || (f.homeTeam.toLowerCase() === m.homeTeam.toLowerCase() && f.awayTeam.toLowerCase() === m.awayTeam.toLowerCase())
          );

          if (dup) {
            await ctx.db.delete(m._id);
            deleted++;
          } else {
            await ctx.db.patch(m._id, { sportId: 'football' });
            migrated++;
          }

          const verdict = await ctx.db
            .query('predictorVerdicts')
            .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
            .first();

          if (verdict && verdict.sportId === sp) {
            await ctx.db.patch(verdict._id, { sportId: 'football' });
          }
        }
      }
    }

    return { migrated, deleted, totalExamined };
  }
});

export const migrateNonFootballMatchesInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    let migrated = 0;
    let deleted = 0;
    let totalExamined = 0;

    for (const sp of NON_FOOTBALL_SPORTS) {
      const sportMatches = await ctx.db
        .query('predictorMatches')
        .withIndex('by_sport_day', (q) => q.eq('sportId', sp as any))
        .collect();

      totalExamined += sportMatches.length;

      for (const m of sportMatches) {
        if (isFootballMatch(m)) {
          const existingFootballMatches = await ctx.db
            .query('predictorMatches')
            .withIndex('by_sport_day', (q) => q.eq('sportId', 'football').eq('dayKey', m.dayKey))
            .collect();

          const dup = existingFootballMatches.find(
            (f) => f.matchId === m.matchId || (f.homeTeam.toLowerCase() === m.homeTeam.toLowerCase() && f.awayTeam.toLowerCase() === m.awayTeam.toLowerCase())
          );

          if (dup) {
            await ctx.db.delete(m._id);
            deleted++;
          } else {
            await ctx.db.patch(m._id, { sportId: 'football' });
            migrated++;
          }

          const verdict = await ctx.db
            .query('predictorVerdicts')
            .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
            .first();

          if (verdict && verdict.sportId === sp) {
            await ctx.db.patch(verdict._id, { sportId: 'football' });
          }
        }
      }
    }

    return { migrated, deleted, totalExamined };
  }
});

// ── Purge wrongly-cached matches from any sport tab ───────────────────────────
// Scans every cached match under `sportId` and deletes any that fail the
// two-gate matchBelongsToSport check.
export const purgeWrongSportMatches = mutation({
  args: {
    sportId: v.union(
      v.literal('football'), v.literal('basketball'), v.literal('tennis'),
      v.literal('rally'), v.literal('hockey'), v.literal('baseball'),
      v.literal('americanfootball'), v.literal('rugby'), v.literal('cricket'),
      v.literal('mma'), v.literal('volleyball')
    )
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId))
      .collect();

    let deleted = 0;
    let kept = 0;
    for (const m of all) {
      // Strict gate (trustTypedApi: false) — a LiveAPI tennis row cached under
      // football must NOT survive just because its source name matches.
      if (!matchBelongsToSport(m, args.sportId, { trustTypedApi: false })) {
        await ctx.db.delete(m._id);
        const verdict = await ctx.db
          .query('predictorVerdicts')
          .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
          .first();
        if (verdict) await ctx.db.delete(verdict._id);
        deleted++;
      } else {
        kept++;
      }
    }
    return { sportId: args.sportId, examined: all.length, deleted, kept };
  }
});

export const purgeWrongSportMatchesInternal = internalMutation({
  args: {
    sportId: v.union(
      v.literal('football'), v.literal('basketball'), v.literal('tennis'),
      v.literal('rally'), v.literal('hockey'), v.literal('baseball'),
      v.literal('americanfootball'), v.literal('rugby'), v.literal('cricket'),
      v.literal('mma'), v.literal('volleyball')
    )
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId))
      .collect();

    let deleted = 0;
    for (const m of all) {
      if (!matchBelongsToSport(m, args.sportId, { trustTypedApi: false })) {
        await ctx.db.delete(m._id);
        const verdict = await ctx.db
          .query('predictorVerdicts')
          .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
          .first();
        if (verdict) await ctx.db.delete(verdict._id);
        deleted++;
      }
    }
    return { deleted, examined: all.length };
  }
});
