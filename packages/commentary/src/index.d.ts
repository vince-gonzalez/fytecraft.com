import { GameEvent, CommentaryTier } from "@fist/shared";
export type Voice = "PROFESSIONAL_CASTER" | "FIGHT_PROMOTER" | "STREET_COMMENTATOR" | "HISTORIAN" | "STREAM_CHAT";
export interface CommentaryLine {
    voice: Voice;
    text: string;
    tier: CommentaryTier;
    isViralClip: boolean;
    clipCaption: string | null;
}
export type NarrativeState = "underdog_rise" | "unstoppable_monster" | "technical_masterclass" | "desperate_survival" | "public_execution" | "viral_moment" | "tragic_collapse" | "redemption_arc";
export declare class CommentaryEngine {
    private voices;
    private voiceIndex;
    private cooldowns;
    private narrativeState;
    private recentLines;
    processEvents(events: GameEvent[], deltaS: number): CommentaryLine[];
    private generateLine;
    private getViralCaption;
    private getEventTier;
    updateNarrative(state: NarrativeState): void;
}
//# sourceMappingURL=index.d.ts.map