// BOOT ORDER: loaded by server after combat and economy
// READS: GameEvent[], entity states
// WRITES: commentary output lines (broadcast to clients)

import {
  GameEvent,
  GameEventType,
  CommentaryTier,
} from "@fist/shared";

import { GAME_CONSTANTS } from "@fist/shared";

export type Voice =
  | "PROFESSIONAL_CASTER"
  | "FIGHT_PROMOTER"
  | "STREET_COMMENTATOR"
  | "HISTORIAN"
  | "STREAM_CHAT";

export interface CommentaryLine {
  voice: Voice;
  text: string;
  tier: CommentaryTier;
  isViralClip: boolean;
  clipCaption: string | null;
}

export type NarrativeState =
  | "underdog_rise"
  | "unstoppable_monster"
  | "technical_masterclass"
  | "desperate_survival"
  | "public_execution"
  | "viral_moment"
  | "tragic_collapse"
  | "redemption_arc";

var LINES: Partial<Record<Voice, Partial<Record<GameEventType, string[]>>>> = {
  PROFESSIONAL_CASTER: {
    unit_kill:             ["And he is down.", "Clean finish.", "That is a KO."],
    career_drop:           ["Career state declining. Significant.", "He has dropped a tier."],
    trainee_exit:          ["The trainee has thrown in the towel.", "That young man is done for today."],
    crit_hit:              ["Flush hit. Perfect contact.", "That landed clean."],
    comeback:              ["He is finding his range again.", "A shift in momentum here."],
    career_recovery:       ["He is earning his way back.", "Tier recovery. He is fighting back."],
    cage_control_achieved: ["Center control established.", "They own the middle."],
    proc_chain:            ["Status effect applied.", "Compound pressure now."],
    bleed_out:             ["The bleed is doing serious work here.", "He cannot stop the damage."],
    last_unit_alive:       ["One unit remaining.", "Everything is on the line now."],
  },
  FIGHT_PROMOTER: {
    unit_kill:             ["THAT IS WHAT I PAID FOR!", "SOMEBODY STOP THE FIGHT!", "YYYESSS!"],
    career_drop:           ["HE IS FALLING APART!", "The wheels are coming OFF!"],
    trainee_exit:          ["THE KID IS DONE!", "THROW THE TOWEL! IT IS OVER!"],
    crit_hit:              ["OHHHHHH!", "THAT IS THE SHOT!", "GOODNIGHT!"],
    comeback:              ["HE IS BACK BABY!", "DO NOT COUNT HIM OUT!"],
    career_recovery:       ["THE COMEBACK IS REAL!", "HE CLAWED HIS WAY BACK!"],
    cage_control_achieved: ["THEY OWN THIS FIGHT NOW! THEY OWN THE MIDDLE!"],
    proc_chain:            ["IT IS RAINING HITS!", "HE CANNOT MISS!"],
    bleed_out:             ["THE BLOOD!", "HE IS LEAKING OUT THERE!"],
    last_unit_alive:       ["ONE MAN STANDING!"],
  },
  STREET_COMMENTATOR: {
    unit_kill:             ["Yo he is out.", "Bro got folded.", "He is sleep."],
    career_drop:           ["Bro he is shook right now.", "He lost his whole swag."],
    trainee_exit:          ["He walked. He actually just walked.", "Nah he said I am good."],
    crit_hit:              ["YOOO.", "Bruh that was nasty.", "He caught him."],
    comeback:              ["He back tho.", "Nah do not sleep on him."],
    career_recovery:       ["Wait he is back?", "Bro said nah I got this."],
    cage_control_achieved: ["They got the middle locked down.", "Nobody is getting through."],
    proc_chain:            ["He is bleeding out here.", "It is getting ugly."],
    bleed_out:             ["That cut is bad bro.", "He is leaking."],
    last_unit_alive:       ["It is just him now.", "One left."],
  },
  HISTORIAN: {
    unit_kill:             ["A decisive finish, in the tradition of the great ones.", "History records another KO."],
    career_drop:           ["Even legends have fallen this way.", "The demotion is brutal but the sport demands it."],
    trainee_exit:          ["The youngest have always been expendable.", "He gave what he could. The mat remembers."],
    crit_hit:              ["Pure Ali footwork paying off.", "A Karelin-level transfer of force."],
    comeback:              ["Every champion has survived this moment.", "The great ones find a way."],
    career_recovery:       ["A return from the depths.", "He has earned back his standing."],
    cage_control_achieved: ["Territorial dominance. The oldest strategy in combat."],
    proc_chain:            ["Going full Sakuraba. Psychological warfare."],
    bleed_out:             ["The bleed tells the story now.", "The cutwork of old masters could have prevented this."],
    last_unit_alive:       ["One warrior remains. As it has always ended."],
  },
  STREAM_CHAT: {
    unit_kill:             ["HE DEAD", "LMAOOOO", "GG", "OMEGALUL", "F"],
    career_drop:           ["HE DROPPED??", "WAIT WHAT", "NOOOO", "DEVOLVED LMAO"],
    trainee_exit:          ["HE QUIT LMAOOO", "BYE", "TRAINEE NO", "THREW THE TOWEL"],
    crit_hit:              ["CLIP THAT", "WHAT", "POGGERS", "INSANE"],
    comeback:              ["HE BACK???", "WAIT WAIT WAIT", "NO WAY"],
    career_recovery:       ["WAIT HE LEVELED UP", "GLOW UP", "REDEMPTION ARC REAL"],
    cage_control_achieved: ["CAGE CONTROL", "THEY GOT MIDDLE", "ITS OVER"],
    proc_chain:            ["BLEED STACK LOL", "PROC CITY", "ITS CHAOS"],
    bleed_out:             ["BLEED OUT LMAOOO", "HE LEAKING"],
    last_unit_alive:       ["1v EVERYONE", "LAST ONE"],
  },
};

export class CommentaryEngine {
  private voices: Voice[] = [
    "PROFESSIONAL_CASTER",
    "FIGHT_PROMOTER",
    "STREET_COMMENTATOR",
    "HISTORIAN",
    "STREAM_CHAT",
  ];

  private voiceIndex: number = 0;
  private cooldowns: Partial<Record<CommentaryTier, number>> = {};
  private narrativeState: NarrativeState = "viral_moment";
  private recentLines: string[] = [];

  processEvents(events: GameEvent[], deltaS: number): CommentaryLine[] {
    var output: CommentaryLine[] = [];

    (Object.keys(this.cooldowns) as CommentaryTier[]).forEach((tier) => {
      var cd = this.cooldowns[tier];
      if (cd !== undefined) {
        this.cooldowns[tier] = Math.max(0, cd - deltaS);
      }
    });

    events.forEach((event) => {
      var tier = this.getEventTier(event.type);
      if (!tier) return;
      var cdSeconds = GAME_CONSTANTS.COMMENTARY_COOLDOWNS_S[tier];
      if ((this.cooldowns[tier] ?? 0) > 0) return;
      var line = this.generateLine(event, tier);
      if (!line) return;
      this.cooldowns[tier] = cdSeconds;
      output.push(line);
      if (tier === CommentaryTier.T3 || tier === CommentaryTier.T4 || tier === CommentaryTier.T5) {
        this.voiceIndex = (this.voiceIndex + 1) % this.voices.length;
      }
    });

    return output;
  }

  private generateLine(event: GameEvent, tier: CommentaryTier): CommentaryLine | null {
    var voice = this.voices[this.voiceIndex];
    var voiceLines = LINES[voice];
    if (!voiceLines) return null;
    var eventLines = voiceLines[event.type];
    if (!eventLines || eventLines.length === 0) return null;
    var text = eventLines[Math.floor(Math.random() * eventLines.length)];
    var attempts = 0;
    while (this.recentLines.includes(text) && attempts < eventLines.length) {
      text = eventLines[Math.floor(Math.random() * eventLines.length)];
      attempts++;
    }
    this.recentLines.push(text);
    if (this.recentLines.length > 10) this.recentLines.shift();
    var isViralClip = tier === CommentaryTier.T3 || tier === CommentaryTier.T4 || tier === CommentaryTier.T5;
    var clipCaption = isViralClip ? this.getViralCaption(event) : null;
    return { voice, text, tier, isViralClip, clipCaption };
  }

  private getViralCaption(event: GameEvent): string {
    switch (event.type) {
      case "unit_kill":       return "FIGHTER JUST GOT DROPPED #FIST #Worldstar";
      case "career_drop":     return "HE WAS A CHAMPION LAST MATCH #FIST #Worldstar";
      case "trainee_exit":    return "HE IS DONE. THAT IS IT. HE IS DONE. #FIST #Worldstar";
      case "comeback":        return "THIS GUY FOUGHT HIS WAY BACK FROM NOTHING #FIST #Worldstar";
      case "proc_chain":      return "IT IS CHAOS IN THE ARENA #FIST #Worldstar";
      case "last_unit_alive": return "ONE LEFT. EVERYBODY ELSE IS GONE. #FIST #Worldstar";
      default:                return "YOU NEED TO SEE THIS #FIST #Worldstar";
    }
  }

  private getEventTier(type: GameEventType): CommentaryTier | null {
    var T1: GameEventType[] = ["crit_hit", "bling_harvested", "proc_chain"];
    var T2: GameEventType[] = ["career_drop", "career_recovery", "cage_control_achieved"];
    var T3: GameEventType[] = ["unit_kill", "trainee_exit", "bleed_out"];
    var T4: GameEventType[] = ["comeback", "comeback_arc", "champion_at_risk"];
    var T5: GameEventType[] = ["match_end", "confidence_collapse", "last_unit_alive"];
    if (T1.includes(type)) return CommentaryTier.T1;
    if (T2.includes(type)) return CommentaryTier.T2;
    if (T3.includes(type)) return CommentaryTier.T3;
    if (T4.includes(type)) return CommentaryTier.T4;
    if (T5.includes(type)) return CommentaryTier.T5;
    return null;
  }

  updateNarrative(state: NarrativeState): void {
    this.narrativeState = state;
  }
}
