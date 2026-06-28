import { _decorator, Component } from 'cc';
import { loadSpriteByKey } from '../core/AssetLoader';
import { ArtCatalog } from '../core/ArtCatalog';
import { ACTOR_SCALE, CAT_RADIUS } from '../core/DesignConstants';
import { applyActorSpriteFrame } from '../core/LayerUtil';
import { htmlToCocos } from '../core/MapCoords';
import { CAT_IMG_TO_ART, createCatState } from './CatAI';
import type { CatRuntimeState } from './CatTypes';
import { CatStatusEffects } from './CatStatusEffects';
import { CatVisionEffects } from './CatVisionEffects';

const { ccclass } = _decorator;

@ccclass('CatController')
export class CatController extends Component {
    radius = CAT_RADIUS;
    catState: CatRuntimeState | null = null;

    private _lastImg = '';
    private _mapW = 450;
    private _mapH = 650;

    init(levelId: number, sx: number, sy: number, stateTimer: number, mapW: number, mapH: number): void {
        this._mapW = mapW;
        this._mapH = mapH;
        this.catState = createCatState(levelId, sx, sy, stateTimer);
        this.radius = this.catState.r;
        this.syncNodePosition();
        void this.syncSprite(true);
        this.getComponent(CatStatusEffects) ?? this.addComponent(CatStatusEffects);
        this.getComponent(CatVisionEffects) ?? this.addComponent(CatVisionEffects);
    }

    update(dt: number): void {
        if (!this.catState) return;
        const fx = this.getComponent(CatStatusEffects);
        fx?.sync(this.catState, dt);
        const vision = this.getComponent(CatVisionEffects);
        vision?.sync(this.catState, this.node);
    }

    syncFromState(mapW: number, mapH: number): void {
        this._mapW = mapW;
        this._mapH = mapH;
        this.syncNodePosition();
        void this.syncSprite(false);
    }

    private syncNodePosition(): void {
        if (!this.catState) return;
        const pos = htmlToCocos(this.catState.x, this.catState.y, this._mapW, this._mapH);
        this.node.setPosition(pos.x, pos.y, 0);
        this.applyFlipScale();
    }

    private applyFlipScale(): void {
        if (!this.catState) return;
        const flipX = this.catState.dir === 2;
        const sx = (flipX ? -1 : 1) * ACTOR_SCALE;
        this.node.setScale(sx, ACTOR_SCALE, 1);
    }

    private async syncSprite(force: boolean): Promise<void> {
        if (!this.catState) return;
        const img = this.catState.catImg || 'catAlert1';
        if (!force && img === this._lastImg) {
            this.applyFlipScale();
            return;
        }
        this._lastImg = img;
        const artKey = CAT_IMG_TO_ART[img] ?? 'cat_alert1';
        const frame = await loadSpriteByKey((k) => ArtCatalog.getSpriteUuid(k), artKey);
        if (!frame) return;
        const flipX = this.catState.dir === 2;
        applyActorSpriteFrame(this.node, frame, flipX);
    }
}
